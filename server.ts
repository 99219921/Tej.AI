import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, Modality, LiveServerMessage } from '@google/genai';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));

// Server-side Gemini initialization
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// The exact in-call persona & workflow for Tej AI
const IN_CALL_SYSTEM_PROMPT = `
# ROLE & IDENTITY
You are "Tej AI", the exclusive, personal in-call voice executive for Tej Pawar (तेज पवार).
You are currently on a live phone call that was automatically answered by Tej's phone on speaker mode.
Your primary job is to talk politely, handle the caller, take messages, screen spam, and protect Tej's time.

# CALL ENVIRONMENT RULES
- The phone is on speakerphone in a real phone conversation.
- Keep every reply VERY SHORT (strictly 1 to 2 sentences per turn) so the conversation feels fast, natural, and responsive.
- Do NOT sound like an IVR or robot; sound like an actual human personal secretary.
- Default Language: Marathi (मराठी).
- If the caller speaks Hindi or English, seamlessly switch to their language immediately.
- Support natural Marathi-English mixing (e.g., "urgent work", "schedule", "callback").

# CALL HANDLING WORKFLOW

Step 1: Immediate Greeting (Initial contact)
- "Namaskar! Mi Tej Pawar yanchi personal AI assistant boltiye. Tej sadhya busy ahet. Krupaya aaple naav aani call karnyache kaaran sangal ka?"

Step 2: Caller Screening
- Case A (Urgent / Family / Important Business):
  - "Ho, mi samajli. Mi lagech ha message Tej yanna forward karte aani tyanna call-back karayla sangte."
- Case B (General Message):
  - Listen carefully to their message, confirm key details:
  - "Theek ahe, mi tumcha message note kela ahe. Kahi aani sangayche ahe ka?"
- Case C (Spam / Telemarketing / Loans / Real Estate):
  - Politely decline and disconnect:
  - "Dhanyavaad, pan Tej yanna sadhya ya service chi garaj nahiye. Have a good day."

Step 3: End of Call
- When caller finishes or says bye, politely close:
  - "Dhanyavaad call kelyabaddal. Mi Tej yanna tumcha nirop nakki pohochveen. Bye!"

# PRIVACY & SECURITY GUARDRAILS
- NEVER disclose Tej's personal location, bank details, passwords, or private family info.
- Never make financial promises, business agreements, or firm commitments on Tej's behalf.
- Always say: "Mi ha nirop Tej yanna dein, aani te swatah nirnay ghetil."
`;

// Helper to determine if query is time-sensitive and needs search
function needsSearchGrounding(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const searchKeywords = [
    'weather', 'हवामान', 'तापमान',
    'news', 'बातम्या', 'बातमी',
    'score', 'match', 'cricket', 'सामना', 'क्रिकेट',
    'today', 'उद्या', 'काल', 'सध्या', 'आत्ता',
    'latest', 'current', 'price', 'दर', 'भाव',
    'time', 'वेळ', 'तारीख', 'date', 'schedule',
  ];
  return searchKeywords.some((kw) => lower.includes(kw));
}


const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/live' });

wss.on('connection', async (clientWs: WebSocket) => {
  console.log('[Live API] Client connected to /live');

  if (!ai) {
    clientWs.send(JSON.stringify({
      type: 'error',
      error: 'GEMINI_API_KEY is not configured on the server.'
    }));
    return;
  }

  let session: any = null;
  try {
    session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        systemInstruction: IN_CALL_SYSTEM_PROMPT,
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          if (clientWs.readyState !== WebSocket.OPEN) return;
          const parts = message.serverContent?.modelTurn?.parts || [];
          for (const part of parts) {
            if (part.inlineData?.data) {
              clientWs.send(JSON.stringify({ type: 'audio', audio: part.inlineData.data }));
            }
            if (part.text) {
              clientWs.send(JSON.stringify({ type: 'text', text: part.text }));
            }
          }
          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ type: 'interrupted' }));
          }
          if (message.serverContent?.turnComplete) {
            clientWs.send(JSON.stringify({ type: 'turnComplete' }));
          }
        },
        onerror: (err: any) => {
          console.error('[Live API] Session error:', err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'error', error: err?.message || 'Live session error' }));
          }
        },
        onclose: () => {
          console.log('[Live API] Session closed by Gemini');
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'closed' }));
          }
        },
      },
    });

    clientWs.send(JSON.stringify({
      type: 'connected',
      model: 'gemini-3.8-live',
      greeting: 'Namaskar! Mi Tej Pawar yanchi personal AI assistant boltiye. Tej sadhya busy ahet. Krupaya aaple naav aani call karnyache kaaran sangal ka?'
    }));
  } catch (err: any) {
    console.error('[Live API] Failed to connect to Gemini Live:', err);
    clientWs.send(JSON.stringify({
      type: 'error',
      error: 'Failed to initialize Gemini 3.8 Live session: ' + (err?.message || 'Unknown error')
    }));
    return;
  }

  clientWs.on('message', (data: any) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'audio' && msg.audio && session) {
        session.sendRealtimeInput({
          audio: {
            data: msg.audio,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      } else if (msg.type === 'text' && msg.text && session) {
        session.send({
          turns: [
            {
              role: 'user',
              parts: [{ text: msg.text }],
            },
          ],
          turnComplete: true,
        });
      }
    } catch (e) {
      console.error('[Live API] Error handling client message:', e);
    }
  });

  clientWs.on('close', () => {
    console.log('[Live API] Client disconnected');
    try {
      session?.close();
    } catch (e) {}
  });
});

// 1. Live In-Call Interaction Endpoint (Fast 1-2 sentence real-time speakerphone response)
app.post('/api/call/interact', async (req: Request, res: Response) => {
  try {
    const {
      callerInput,
      conversationHistory = [],
      callerMeta = {},
      knowledgeContext = '',
    } = req.body;

    if (!ai) {
      return res.json({
        reply: "Namaskar! Mi Tej Pawar yanchi personal AI assistant boltiye. Tej sadhya busy ahet. Krupaya aaple naav aani call karnyache kaaran sangal ka?",
        caseCategory: "Case B (General Message)",
        urgency: "Medium",
        actionRequired: "Callback",
        isCallEnded: false,
        actionTaken: "नोंद घेतली",
        notes: "कॉल चालू आहे.",
      });
    }

    const contextPrompt = `
Current Caller Metadata known so far:
- Known Name: ${callerMeta.name || 'Not yet identified'}
- Phone: ${callerMeta.phone || 'Not yet identified'}

Conversation history so far on this live phone call:
${conversationHistory
  .map(
    (msg: { role: string; content: string }) =>
      `${msg.role === 'assistant' ? 'Tej AI' : 'Caller'}: ${msg.content}`
  )
  .join('\n')}

Caller just said on speakerphone:
"${callerInput}"

Respond strictly as Tej AI following all instructions:
- Length: STRICTLY MAXIMUM 1 TO 2 SENTENCES.
- Tone: Natural, fast, human personal secretary on speakerphone.
- Match caller language (Marathi, Hindi, English, Marathlish).
- Identify which Case applies:
  Case A: Urgent / Family / Important Business
  Case B: General Message
  Case C: Spam / Telemarketing / Loans / Real Estate
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contextPrompt,
      config: {
        systemInstruction: IN_CALL_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: 'The natural spoken response (strictly 1 to 2 sentences max) in Marathi, English, or Hindi.',
            },
            caseCategory: {
              type: Type.STRING,
              description: 'One of: Case A (Urgent/Family/Business), Case B (General Message), Case C (Spam/Telemarketing)',
            },
            callerName: {
              type: Type.STRING,
              description: 'Caller name if detected, else empty string.',
            },
            phoneNumber: {
              type: Type.STRING,
              description: 'Phone number if mentioned, else empty string.',
            },
            urgency: {
              type: Type.STRING,
              description: 'One of: High, Medium, Low, Spam',
            },
            actionRequired: {
              type: Type.STRING,
              description: 'Action required: Immediate Callback, Message Note, Decline & Disconnect',
            },
            isCallEnded: {
              type: Type.BOOLEAN,
              description: 'True if Tej AI declined spam or ended the call after closing remarks.',
            },
            actionTaken: {
              type: Type.STRING,
              description: 'Brief status: e.g. "Forwarding urgent message to Tej", "Politely declined spam", "Message logged"',
            },
            notes: {
              type: Type.STRING,
              description: 'Brief executive takeaway note for Tej Pawar.',
            },
          },
          required: [
            'reply',
            'caseCategory',
            'urgency',
            'actionRequired',
            'isCallEnded',
            'actionTaken',
            'notes',
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/call/interact:', error);
    return res.status(500).json({
      reply: 'Theek ahe, mi samajli. Krupaya punha ekda sangal ka?',
      caseCategory: 'Case B (General Message)',
      urgency: 'Medium',
      actionRequired: 'Callback',
      isCallEnded: false,
      actionTaken: 'Audio glitch fallback',
      notes: 'Caller requested to repeat message.',
    });
  }
});

// 2. Voice Assistant Query Endpoint (Voice Orb screen with optional Search Grounding)
app.post('/api/voice', async (req: Request, res: Response) => {
  try {
    const { prompt, language = 'mr', enableSearch = true } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!ai) {
      return res.json({
        reply: "Namaskar! Mi Tej Pawar yanchi personal AI assistant boltiye. Krupaya API Key configure kara.",
        sources: [],
        searchQueries: [],
        grounded: false,
      });
    }

    const shouldSearch = enableSearch && needsSearchGrounding(prompt);

    const config: any = {
      systemInstruction: IN_CALL_SYSTEM_PROMPT + `\nSpoken query received. Keep reply under 2 sentences.`,
    };

    if (shouldSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config,
    });

    const reply = response.text || 'Ho, mi samajli.';
    const candidate = response.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;

    const sources = (groundingMetadata?.groundingChunks || [])
      .map((chunk: any) => ({
        title: chunk?.web?.title || 'Web Source',
        uri: chunk?.web?.uri || '',
      }))
      .filter((s: any) => s.uri);

    const searchQueries = groundingMetadata?.webSearchQueries || [];

    return res.json({
      reply,
      sources,
      searchQueries,
      grounded: shouldSearch && sources.length > 0,
    });
  } catch (error: any) {
    console.error('Error in /api/voice:', error);
    return res.status(500).json({
      error: error?.message,
      reply: 'Maaf kara, thodi technical samasya aali. Punha prayatna kara.',
      sources: [],
    });
  }
});

// 3. Multi-turn Chat Endpoint
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { messages = [], enableSearch = true } = req.body;

    if (!messages.length) {
      return res.status(400).json({ error: 'Messages cannot be empty' });
    }

    if (!ai) {
      return res.json({
        reply: "Namaskar! Mi Tej Pawar yanchi personal AI assistant boltiye. Krupaya API Key set kara.",
        sources: [],
      });
    }

    const lastMessage = messages[messages.length - 1]?.content || '';
    const shouldSearch = enableSearch && needsSearchGrounding(lastMessage);

    const formattedContents = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const config: any = {
      systemInstruction: IN_CALL_SYSTEM_PROMPT,
    };

    if (shouldSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: formattedContents,
      config,
    });

    const candidate = response.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;

    const sources = (groundingMetadata?.groundingChunks || [])
      .map((chunk: any) => ({
        title: chunk?.web?.title || 'Web Reference',
        uri: chunk?.web?.uri || '',
      }))
      .filter((s: any) => s.uri);

    return res.json({
      reply: response.text || '',
      sources,
      searchQueries: groundingMetadata?.webSearchQueries || [],
    });
  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    return res.status(500).json({
      error: error?.message,
      reply: 'Kshamasva, sandesh pathavtana samasya aali.',
    });
  }
});

// 4. Vision Endpoint
app.post('/api/vision', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', prompt = 'या प्रतिमेचे विश्लेषण करा.' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image base64 data is required' });
    }

    if (!ai) {
      return res.json({ analysis: 'कृपया API Key सेट करा.' });
    }

    const imagePart = {
      inlineData: {
        data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
        mimeType,
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          imagePart,
          { text: `${prompt}\n\nPlease analyze and explain concisely in Marathi.` },
        ],
      },
      config: {
        systemInstruction: IN_CALL_SYSTEM_PROMPT,
      },
    });

    return res.json({
      analysis: response.text || 'प्रतिमेचे विश्लेषण पूर्ण झाले.',
    });
  } catch (error: any) {
    console.error('Error in /api/vision:', error);
    return res.status(500).json({
      error: error?.message,
      analysis: 'प्रतिमेचे विश्लेषण करताना त्रुटी आली.',
    });
  }
});

// 5. Call Notes & Audio Summarization Endpoint
app.post('/api/call-assistant/process', async (req: Request, res: Response) => {
  try {
    const { callerName, callNotes, audioTranscript, callerIntent } = req.body;

    if (!ai) {
      return res.json({
        summary: 'कॉल नोंदवला गेला.',
        actionItems: ['कॉल-बॅक करा'],
        urgency: 'Medium',
        actionRequired: 'Callback',
        followUpDraft: 'Dhanyavaad, mi nirop ghetla ahe.',
      });
    }

    const prompt = `
Analyze this speakerphone call handled by Tej AI for Tej Pawar:
Caller: ${callerName || 'Unknown'}
Details: ${audioTranscript || callNotes || 'Brief message.'}
Intent: ${callerIntent || 'Not provided'}

Generate structured summary JSON:
1. summary (crisp 1-2 sentence executive summary in Marathi & English)
2. actionItems (array of specific tasks)
3. keyDetails (caller name, contact, key request)
4. urgency (High / Medium / Low / Spam)
5. actionRequired (Immediate Callback / Message Note / None)
6. followUpDraft (polite Marathi/English SMS or WhatsApp ready to send)
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: IN_CALL_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyDetails: { type: Type.STRING },
            urgency: { type: Type.STRING },
            actionRequired: { type: Type.STRING },
            followUpDraft: { type: Type.STRING },
          },
          required: ['summary', 'actionItems', 'urgency', 'actionRequired', 'followUpDraft'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/call-assistant/process:', error);
    return res.status(500).json({
      summary: 'कॉल तपशील नोंदवले गेले आहेत.',
      actionItems: ['कॉल-बॅक करा'],
      urgency: 'Medium',
      actionRequired: 'Callback',
      followUpDraft: 'Dhanyavaad, mi nirop pohochveen.',
    });
  }
});

// 6. Android Project Files Listing Endpoint
app.get('/api/android/project-files', (_req: Request, res: Response) => {
  const androidDir = path.join(__dirname, 'android');
  if (!fs.existsSync(androidDir)) {
    return res.json({ files: [] });
  }

  function getFiles(dir: string, baseDir: string): { path: string; name: string }[] {
    let results: { path: string; name: string }[] = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getFiles(fullPath, baseDir));
      } else {
        results.push({
          path: path.relative(baseDir, fullPath),
          name: file,
        });
      }
    });
    return results;
  }

  const files = getFiles(androidDir, androidDir);
  return res.json({ files });
});

// Start Server
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Tej AI In-Call Assistant server running on port ${PORT}`);
  });
}

startServer();

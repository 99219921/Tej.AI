import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Radio,
  Clock,
  Send,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { VoiceManager, soundEffects } from './utils/audio';

interface TranscriptItem {
  id: string;
  sender: 'caller' | 'assistant';
  text: string;
  timestamp: string;
}

export default function App() {
  // Call status states: 'waiting' (incoming call ready to answer) | 'connecting' | 'connected' | 'ended'
  const [callState, setCallState] = useState<'waiting' | 'connecting' | 'connected' | 'ended'>('connected');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [isSpeakerphoneOn, setIsSpeakerphoneOn] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState<boolean>(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Transcripts
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [textInput, setTextInput] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Audio Context & Streaming Refs
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const FIRST_GREETING =
    'Namaskar! Mi Tej Pawar yanchi personal AI assistant boltiye. Tej sadhya busy ahet. Krupaya aaple naav aani call karnyache kaaran sangal ka?';

  // Initialize Voices & Auto-Connect Call Engine on load
  useEffect(() => {
    VoiceManager.initVoices();

    // Auto-Connect Engine: Automatically initiate call connection on launch (simulating EXTRA_STATE_OFFHOOK)
    const autoConnectTimer = setTimeout(() => {
      startLiveAutoCall();
    }, 500);

    return () => {
      clearTimeout(autoConnectTimer);
      cleanupCallSession();
    };
  }, []);

  // Duration Timer
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (callState === 'waiting') setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Auto-scroll transcript container
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts, isAssistantSpeaking]);

  // Real-time Canvas Waveform Visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isActive = true;

    const renderWaveform = () => {
      if (!isActive) return;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      let dataArray: Uint8Array;
      let activeAnalyser = null;

      if (isAssistantSpeaking && outputAnalyserRef.current) {
        activeAnalyser = outputAnalyserRef.current;
      } else if (inputAnalyserRef.current && !isMuted) {
        activeAnalyser = inputAnalyserRef.current;
      }

      if (activeAnalyser) {
        const bufferLength = activeAnalyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        activeAnalyser.getByteFrequencyData(dataArray as any);

        const barCount = 36;
        const barWidth = Math.floor(width / barCount) - 2;

        for (let i = 0; i < barCount; i++) {
          const index = Math.floor((i / barCount) * (dataArray.length / 2));
          const value = dataArray[index] || 0;
          const percent = value / 255;
          const barHeight = Math.max(6, percent * (height - 10));
          const x = i * (barWidth + 2);
          const y = (height - barHeight) / 2;

          // Gradient color: Cyan/Teal for AI, Emerald for Caller
          const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
          if (isAssistantSpeaking) {
            grad.addColorStop(0, '#22d3ee'); // cyan-400
            grad.addColorStop(1, '#0284c7'); // sky-600
          } else {
            grad.addColorStop(0, '#34d399'); // emerald-400
            grad.addColorStop(1, '#0d9488'); // teal-600
          }

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 4);
          ctx.fill();
        }
      } else {
        // Idle gentle breathing wave
        const time = Date.now() / 300;
        const barCount = 36;
        const barWidth = Math.floor(width / barCount) - 2;

        for (let i = 0; i < barCount; i++) {
          const wave = Math.sin(time + i * 0.25);
          const barHeight = 8 + Math.abs(wave) * 12;
          const x = i * (barWidth + 2);
          const y = (height - barHeight) / 2;

          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 3);
          ctx.fill();
        }
      }

      animFrameRef.current = requestAnimationFrame(renderWaveform);
    };

    renderWaveform();

    return () => {
      isActive = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isAssistantSpeaking, isMuted, callState]);

  // Format Duration seconds -> MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Convert Float32Array to 16-bit PCM little-endian
  const floatTo16BitPCM = (float32Array: Float32Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  };

  // Play incoming 24kHz raw PCM chunk from Gemini Live
  const playLiveAudioChunk = useCallback((base64Pcm: string) => {
    if (!isSpeakerphoneOn) return;
    try {
      if (!outputAudioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const outCtx = new AudioCtx({ sampleRate: 24000 });
        const analyser = outCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.connect(outCtx.destination);
        outputAudioCtxRef.current = outCtx;
        outputAnalyserRef.current = analyser;
      }

      const ctx = outputAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const binaryStr = atob(base64Pcm);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.copyToChannel(float32Array, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Connect through AnalyserNode to speakerphone destination
      if (outputAnalyserRef.current) {
        source.connect(outputAnalyserRef.current);
      } else {
        source.connect(ctx.destination);
      }

      const currentTime = ctx.currentTime;
      const startTime = Math.max(currentTime, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;

      setIsAssistantSpeaking(true);
      source.onended = () => {
        if (ctx.currentTime >= nextPlayTimeRef.current - 0.05) {
          setIsAssistantSpeaking(false);
        }
      };
      audioQueueRef.current.push(source);
    } catch (err) {
      console.warn('Speaker audio playback error:', err);
    }
  }, [isSpeakerphoneOn]);

  // Clean up all live connections & audio nodes
  const cleanupCallSession = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (e) {}
      processorRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }

    audioQueueRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (e) {}
    });
    audioQueueRef.current = [];
    nextPlayTimeRef.current = 0;

    setIsAssistantSpeaking(false);
    setIsUserSpeaking(false);
  }, []);

  // AUTOMATIC CALL CONNECTION & SPEAKERPHONE ENGINE
  const startLiveAutoCall = async () => {
    setErrorMessage(null);
    setCallState('connecting');

    try {
      soundEffects.playConnectChime();

      // 1. Automatically route audio to SPEAKERPHONE
      setIsSpeakerphoneOn(true);

      // 2. Establish live Gemini Live API bi-directional audio WebSocket session
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[Tej AI Engine] Live WebSocket Connected');
        setCallState('connected');

        // 3. Instantly speak the first greeting aloud on speakerphone without waiting for caller input
        const greetingItem: TranscriptItem = {
          id: `greet-${Date.now()}`,
          sender: 'assistant',
          text: FIRST_GREETING,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setTranscripts([greetingItem]);

        // Speak aloud via Indian Marathi female voice
        setIsAssistantSpeaking(true);
        VoiceManager.speak(
          FIRST_GREETING,
          () => setIsAssistantSpeaking(true),
          () => setIsAssistantSpeaking(false),
          () => setIsAssistantSpeaking(false)
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'audio' && msg.audio) {
            playLiveAudioChunk(msg.audio);
          } else if (msg.type === 'text' && msg.text) {
            setTranscripts((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.sender === 'assistant' && !last.id.startsWith('greet-')) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: (last.text + ' ' + msg.text).trim() },
                ];
              } else {
                return [
                  ...prev,
                  {
                    id: Date.now().toString(),
                    sender: 'assistant',
                    text: msg.text,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  },
                ];
              }
            });
          } else if (msg.type === 'interrupted') {
            audioQueueRef.current.forEach((src) => {
              try {
                src.stop();
              } catch (e) {}
            });
            audioQueueRef.current = [];
            nextPlayTimeRef.current = 0;
            setIsAssistantSpeaking(false);
          } else if (msg.type === 'error') {
            console.error('[Gemini Live Error]:', msg.error);
            setErrorMessage(msg.error);
          }
        } catch (e) {
          console.error('[Tej AI Engine] Message parse error:', e);
        }
      };

      ws.onerror = (e) => {
        console.error('[Tej AI Engine] WebSocket Error:', e);
        setErrorMessage('Unable to connect to live Gemini server. Retrying...');
      };

      ws.onclose = () => {
        console.log('[Tej AI Engine] WebSocket closed');
        if (callState === 'connected') {
          handleEndCall();
        }
      };

      wsRef.current = ws;

      // 4. Connect Microphone Input directly to the Gemini Live streaming audio buffer
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputCtx;

      const inputAnalyser = inputCtx.createAnalyser();
      inputAnalyser.fftSize = 128;
      inputAnalyserRef.current = inputAnalyser;

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMuted) return;

        const inputChannelData = e.inputBuffer.getChannelData(0);

        // Calculate speech activity
        let sum = 0;
        for (let i = 0; i < inputChannelData.length; i++) {
          sum += inputChannelData[i] * inputChannelData[i];
        }
        const rms = Math.sqrt(sum / inputChannelData.length);
        setIsUserSpeaking(rms > 0.02);

        // Convert Float32 to 16-bit PCM little-endian
        const pcmBuffer = floatTo16BitPCM(inputChannelData);
        const bytes = new Uint8Array(pcmBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Audio = btoa(binary);

        // Stream raw PCM audio directly to live session
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'audio', audio: base64Audio }));
        }
      };

      source.connect(inputAnalyser);
      inputAnalyser.connect(processor);
      processor.connect(inputCtx.destination);

      // 5. Native Speech Recognition for live Caller speech transcription
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = 'mr-IN';
          recognition.continuous = true;
          recognition.interimResults = false;

          recognition.onresult = (evt: any) => {
            const lastResult = evt.results[evt.results.length - 1];
            if (lastResult && lastResult.isFinal) {
              const text = lastResult[0].transcript.trim();
              if (text) {
                setTranscripts((prev) => [
                  ...prev,
                  {
                    id: `caller-${Date.now()}`,
                    sender: 'caller',
                    text,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  },
                ]);
              }
            }
          };

          recognition.onerror = (err: any) => {
            console.warn('Speech recognition warning:', err);
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {
          console.warn('Speech recognition start note:', e);
        }
      }
    } catch (err: any) {
      console.error('Call auto-connect issue:', err);
      // Browser autoplay policy might require single user tap to capture mic/audio
      setErrorMessage(
        err?.message?.includes('Permission')
          ? 'Microphone permission required for speakerphone call.'
          : 'Tap "Answer Call" to activate speakerphone audio session.'
      );
      setCallState('waiting');
      cleanupCallSession();
    }
  };

  // Disconnect / Hang Up
  const handleEndCall = () => {
    soundEffects.playHangupBeep();
    VoiceManager.stop();
    cleanupCallSession();
    setCallState('ended');
  };

  // Manual caller message input (direct WebSocket turn)
  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const userText = textInput.trim();
    setTextInput('');

    // Add caller speech bubble
    setTranscripts((prev) => [
      ...prev,
      {
        id: `caller-${Date.now()}`,
        sender: 'caller',
        text: userText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    // Send text turn directly to Gemini Live API
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'text', text: userText }));
    } else {
      // Connect and send
      startLiveAutoCall().then(() => {
        setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'text', text: userText }));
          }
        }, 1200);
      });
    }
  };

  // Copy transcript message
  const copyTranscriptText = (item: TranscriptItem) => {
    navigator.clipboard.writeText(item.text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-slate-950">
      {/* 1. HEADER: "Tej AI - Automatic Call Assistant" */}
      <header className="sticky top-0 z-30 bg-[#070B14]/95 backdrop-blur-md border-b border-teal-500/20 px-4 py-3 sm:px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 via-emerald-400 to-cyan-400 p-0.5 flex items-center justify-center shadow-lg shadow-teal-500/30">
              <div className="w-full h-full bg-[#070B14] rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-teal-400" />
              </div>
            </div>
            <div>
              <h1 className="font-extrabold text-base sm:text-lg text-white tracking-tight flex items-center gap-2">
                Tej AI - Automatic Call Assistant
              </h1>
              <p className="text-[11px] text-slate-400">
                Official Voice Executive for <span className="text-teal-300 font-semibold">Tej Pawar</span> • Speakerphone Engine
              </p>
            </div>
          </div>

          {/* Call Duration Counter */}
          {callState === 'connected' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 font-mono text-xs text-slate-300">
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              <span>{formatTime(callDuration)}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Single Clean View */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-5">
        {/* Error notification if any */}
        {errorMessage && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            {callState !== 'connected' && (
              <button
                onClick={startLiveAutoCall}
                className="px-3 py-1 rounded-xl bg-teal-500 text-slate-950 font-bold hover:bg-teal-400 transition cursor-pointer"
              >
                Connect Speaker
              </button>
            )}
          </div>
        )}

        {/* 2. Center Stage Card: Status Badge + Large Voice Waveform / Listening Orb */}
        <div className="bg-gradient-to-b from-[#0F172E] to-[#0A1020] rounded-3xl border border-teal-500/25 p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center">
          {/* Ambient Glow */}
          <div
            className={`absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
              callState === 'connected' ? 'bg-emerald-500/20' : 'bg-slate-700/10'
            }`}
          />
          <div
            className={`absolute -bottom-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
              isAssistantSpeaking
                ? 'bg-cyan-500/25'
                : isUserSpeaking
                ? 'bg-emerald-500/25'
                : 'bg-teal-500/10'
            }`}
          />

          {/* STATUS BADGE: "CALL CONNECTED - LIVE AI ON SPEAKER" */}
          <div className="mb-4">
            {callState === 'connected' ? (
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black tracking-wider uppercase shadow-lg shadow-emerald-500/20 animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>CALL CONNECTED - LIVE AI ON SPEAKER</span>
              </div>
            ) : callState === 'connecting' ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold tracking-wider uppercase animate-pulse">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                <span>CONNECTING LIVE GEMINI STREAM...</span>
              </div>
            ) : callState === 'ended' ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold tracking-wider uppercase">
                <PhoneOff className="w-3.5 h-3.5" />
                <span>CALL DISCONNECTED</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold tracking-wider uppercase">
                <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                <span>INCOMING CALL DETECTED</span>
              </div>
            )}
          </div>

          {/* Large Active Voice Waveform / Listening Orb */}
          <div className="relative my-3 flex flex-col items-center justify-center">
            {/* Concentric Glow Ripples */}
            {callState === 'connected' && (
              <>
                <div
                  className={`absolute rounded-full border border-teal-500/30 transition-all duration-300 ${
                    isAssistantSpeaking
                      ? 'w-48 h-48 animate-ping opacity-35 bg-cyan-500/10'
                      : isUserSpeaking
                      ? 'w-44 h-44 animate-ping opacity-45 bg-emerald-500/10'
                      : 'w-40 h-40 opacity-20'
                  }`}
                />
                <div className="absolute w-36 h-36 rounded-full bg-teal-500/15 animate-pulse" />
              </>
            )}

            {/* Center Orb */}
            <div
              className={`relative z-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 ${
                callState === 'connected'
                  ? isAssistantSpeaking
                    ? 'bg-gradient-to-tr from-cyan-400 via-teal-500 to-blue-500 text-slate-950 shadow-cyan-400/50 ring-4 ring-cyan-400/40'
                    : isUserSpeaking
                    ? 'bg-gradient-to-tr from-emerald-400 to-teal-300 text-slate-950 shadow-emerald-400/50 ring-4 ring-emerald-400/40'
                    : isMuted
                    ? 'bg-gradient-to-tr from-slate-700 to-slate-800 text-slate-300 border-2 border-slate-600'
                    : 'bg-gradient-to-tr from-teal-500 to-emerald-600 text-slate-950 shadow-teal-500/40 ring-2 ring-teal-400/40'
                  : callState === 'connecting'
                  ? 'bg-gradient-to-tr from-cyan-600 to-teal-600 text-white animate-pulse'
                  : 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-slate-950 shadow-emerald-500/40'
              }`}
            >
              {callState === 'connected' ? (
                isAssistantSpeaking ? (
                  <>
                    <Volume2 className="w-10 h-10 sm:w-11 sm:h-11 mb-1 animate-bounce" />
                    <span className="text-[10px] font-black tracking-wider uppercase">Tej AI</span>
                  </>
                ) : isUserSpeaking ? (
                  <>
                    <Mic className="w-10 h-10 sm:w-11 sm:h-11 mb-1" />
                    <span className="text-[10px] font-black tracking-wider uppercase">Listening</span>
                  </>
                ) : isMuted ? (
                  <>
                    <MicOff className="w-10 h-10 sm:w-11 sm:h-11 mb-1 text-rose-300" />
                    <span className="text-[10px] font-black tracking-wider uppercase">Muted</span>
                  </>
                ) : (
                  <>
                    <Radio className="w-10 h-10 sm:w-11 sm:h-11 mb-1 animate-pulse" />
                    <span className="text-[10px] font-black tracking-wider uppercase">Live Speaker</span>
                  </>
                )
              ) : callState === 'connecting' ? (
                <>
                  <Sparkles className="w-10 h-10 sm:w-11 sm:h-11 mb-1 animate-spin" />
                  <span className="text-[10px] font-black tracking-wider uppercase">Connecting</span>
                </>
              ) : (
                <button
                  onClick={startLiveAutoCall}
                  className="w-full h-full rounded-full flex flex-col items-center justify-center cursor-pointer"
                >
                  <PhoneCall className="w-10 h-10 sm:w-11 sm:h-11 mb-1" />
                  <span className="text-[10px] font-black tracking-wider uppercase">Answer Call</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Canvas Frequency Waveform */}
          <div className="w-full max-w-md h-12 my-2 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={380}
              height={48}
              className="w-full h-full rounded-xl bg-[#090E1D]/80 border border-slate-800/80 px-2"
            />
          </div>

          {/* Status Context Subtitle */}
          <div className="text-center mt-1">
            <p className="text-sm font-semibold text-slate-200">
              {callState === 'connected'
                ? isAssistantSpeaking
                  ? 'Tej AI speaking on speakerphone (1-2 sentence Marathi response)...'
                  : isUserSpeaking
                  ? 'Caller is speaking... (Listening via speakerphone mic)'
                  : isMuted
                  ? 'Microphone muted. Tap mic to unmute.'
                  : 'Speakerphone active • Listening for caller in Marathi/Hindi/English'
                : callState === 'connecting'
                ? 'Routing call to speakerphone & initializing live Gemini session...'
                : callState === 'ended'
                ? 'Call disconnected. Tap restart below to initiate a new session.'
                : 'Incoming call ready. Auto-connecting speakerphone...'}
            </p>
          </div>

          {/* Call Controls: Red "End Call" Button & Toggles */}
          <div className="mt-5 flex items-center justify-center gap-3">
            {callState === 'connected' ? (
              <>
                {/* Red End Call Button */}
                <button
                  onClick={handleEndCall}
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-black tracking-wider uppercase flex items-center gap-2 shadow-xl shadow-red-600/30 transition transform hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End Call</span>
                </button>

                {/* Speaker Mute/Unmute */}
                <button
                  onClick={() => setIsSpeakerphoneOn(!isSpeakerphoneOn)}
                  className={`p-2.5 rounded-2xl border text-xs font-semibold transition cursor-pointer ${
                    isSpeakerphoneOn
                      ? 'bg-teal-500/15 border-teal-500/40 text-teal-300 hover:bg-teal-500/25'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                  title={isSpeakerphoneOn ? 'Speakerphone ON' : 'Speakerphone MUTED'}
                >
                  {isSpeakerphoneOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>

                {/* Mic Mute/Unmute */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-2.5 rounded-2xl border text-xs font-semibold transition cursor-pointer ${
                    !isMuted
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      : 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                  }`}
                  title={isMuted ? 'Mic Muted' : 'Mic Active'}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </>
            ) : (
              <button
                onClick={startLiveAutoCall}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 text-xs font-black tracking-wider uppercase flex items-center gap-2 shadow-xl shadow-emerald-500/30 transition transform hover:scale-105 active:scale-95 cursor-pointer"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Start / Re-Connect Call</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. Live Dual-Sided Transcription Box (Caller Speech <-> Tej AI Voice Reply) */}
        <div className="bg-[#0F172E] rounded-3xl border border-slate-800 p-5 flex flex-col flex-1 min-h-[340px] shadow-xl">
          {/* Box Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                Live Dual-Sided Transcription
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                ({transcripts.length} {transcripts.length === 1 ? 'turn' : 'turns'})
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400" /> Caller Speech
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-teal-400" /> Tej AI Voice Reply
              </span>
            </div>
          </div>

          {/* Conversation Feed */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[380px]">
            {transcripts.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4">
                <Radio className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
                <p className="text-xs text-slate-400 font-medium">
                  Connecting to speakerphone...
                </p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm font-marathi">
                  तेज एआय कॉल सुरू झाल्यावर लगेच मराठीमध्ये स्वागत करेल आणि कॉलरशी बोलेल.
                </p>
              </div>
            ) : (
              transcripts.map((item) => {
                const isAssistant = item.sender === 'assistant';
                return (
                  <div
                    key={item.id}
                    className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
                  >
                    {/* Speaker Header Label */}
                    <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400">
                      {isAssistant ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-teal-400" />
                          <span className="font-bold text-teal-300">Tej AI (Voice Reply)</span>
                          <span>•</span>
                          <span className="font-mono text-[10px]">{item.timestamp}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-mono text-[10px]">{item.timestamp}</span>
                          <span>•</span>
                          <span className="font-bold text-cyan-300">Caller (Speaker In)</span>
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        </>
                      )}
                    </div>

                    {/* Speech Bubble */}
                    <div
                      className={`relative group max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed ${
                        isAssistant
                          ? 'bg-[#131D38] text-white border border-teal-500/35 rounded-tl-sm shadow-md'
                          : 'bg-[#1E293B] text-slate-100 border border-cyan-500/30 rounded-tr-sm shadow-md'
                      }`}
                    >
                      <p className="font-medium whitespace-pre-wrap">{item.text}</p>

                      {/* Copy Action */}
                      <button
                        onClick={() => copyTranscriptText(item)}
                        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                        title="Copy text"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Quick Caller Speech Bar (Live WebSocket input) */}
          <form onSubmit={handleSendText} className="mt-4 pt-3 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Speak aloud on speakerphone or type caller words..."
              className="flex-1 bg-[#0A1020] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
            />
            <button
              type="submit"
              disabled={!textInput.trim()}
              className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-teal-500/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

// Audio Synthesizer, Sound Effects, and Marathi Indian Female Voice Manager for Tej AI

export interface VoiceOption {
  voice: SpeechSynthesisVoice;
  displayName: string;
  lang: string;
  isIndian: boolean;
  isFemale: boolean;
  isMarathi: boolean;
}

class SoundEffectsManager {
  private ctx: AudioContext | null = null;
  private ringtoneInterval: number | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Soft tone when assistant starts listening
  playMicStart() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (e) {
      console.warn(e);
    }
  }

  // Soft tone when voice query finishes processing
  playResponseReady() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.18); // C6

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch (e) {
      console.warn(e);
    }
  }

  // Search grounding retrieval ping
  playSearchPing() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.1); // G5

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      console.warn(e);
    }
  }

  // Realistic phone ringtone
  startRingtone() {
    this.stopRingtone();
    const playRingBurst = () => {
      try {
        const ctx = this.getContext();
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, ctx.currentTime);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + 1.2);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.3);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(ctx.currentTime);
        osc2.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 1.3);
        osc2.stop(ctx.currentTime + 1.3);
      } catch (e) {
        console.warn('AudioContext ringtone error:', e);
      }
    };

    playRingBurst();
    this.ringtoneInterval = window.setInterval(playRingBurst, 3000);
  }

  stopRingtone() {
    if (this.ringtoneInterval !== null) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
  }

  playConnectChime() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      console.warn(e);
    }
  }

  playHangupBeep() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, ctx.currentTime);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.warn(e);
    }
  }

  playUrgentAlert() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0.18, now + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.001, now + i * 0.08 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.25);
      });
    } catch (e) {
      console.warn(e);
    }
  }
}

export const soundEffects = new SoundEffectsManager();

// Indian Female Voice & Marathi Pronunciation Manager
export class VoiceManager {
  private static isSpeaking = false;
  private static cachedVoices: VoiceOption[] = [];
  private static selectedVoiceURI: string = '';
  private static speechRate: number = 1.0;
  private static speechPitch: number = 1.05;

  static initVoices(): Promise<VoiceOption[]> {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve([]);
        return;
      }

      const update = () => {
        const rawVoices = window.speechSynthesis.getVoices();
        const options: VoiceOption[] = rawVoices.map((v) => {
          const name = v.name.toLowerCase();
          const lang = v.lang.toLowerCase();

          const isMarathi = lang.includes('mr') || name.includes('marathi');
          const isHindi = lang.includes('hi') || name.includes('hindi');
          const isIndian =
            lang.includes('in') ||
            isMarathi ||
            isHindi ||
            name.includes('india') ||
            name.includes('veena') ||
            name.includes('swara') ||
            name.includes('heera') ||
            name.includes('lekha') ||
            name.includes('aditi');

          const isFemale =
            name.includes('female') ||
            name.includes('zira') ||
            name.includes('veena') ||
            name.includes('swara') ||
            name.includes('heera') ||
            name.includes('lekha') ||
            name.includes('aditi') ||
            name.includes('samantha') ||
            name.includes('kavya') ||
            (!name.includes('male') && (isMarathi || isHindi));

          let prefix = '';
          if (isMarathi) prefix = '🌸 Marathi • ';
          else if (isIndian && isFemale) prefix = '🇮🇳 Indian Female • ';
          else if (isIndian) prefix = '🇮🇳 Indian • ';
          else if (isFemale) prefix = '👩 Female • ';

          return {
            voice: v,
            displayName: `${prefix}${v.name} (${v.lang})`,
            lang: v.lang,
            isIndian,
            isFemale,
            isMarathi,
          };
        });

        // Sort priority: Marathi Female > Marathi > Indian Female > Indian > Others
        options.sort((a, b) => {
          const score = (v: VoiceOption) =>
            (v.isMarathi ? 100 : 0) +
            (v.isIndian ? 50 : 0) +
            (v.isFemale ? 30 : 0);
          return score(b) - score(a);
        });

        this.cachedVoices = options;
        if (!this.selectedVoiceURI && options.length > 0) {
          this.selectedVoiceURI = options[0].voice.voiceURI;
        }
        resolve(options);
      };

      const raw = window.speechSynthesis.getVoices();
      if (raw.length > 0) {
        update();
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          update();
        };
        setTimeout(update, 500);
      }
    });
  }

  static getVoices(): VoiceOption[] {
    return this.cachedVoices;
  }

  static setSelectedVoice(uri: string) {
    this.selectedVoiceURI = uri;
  }

  static getSelectedVoiceURI(): string {
    return this.selectedVoiceURI;
  }

  static setSpeed(rate: number) {
    this.speechRate = Math.max(0.5, Math.min(2.0, rate));
  }

  static getSpeed(): number {
    return this.speechRate;
  }

  static setPitch(pitch: number) {
    this.speechPitch = Math.max(0.5, Math.min(1.5, pitch));
  }

  static getPitch(): number {
    return this.speechPitch;
  }

  static speak(
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (err: any) => void
  ) {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      onEnd?.();
      return;
    }

    // Immediate interruption of previous speech
    window.speechSynthesis.cancel();

    // Strip markdown formatting symbols so TTS pronounces cleanly
    const cleanedText = text
      .replace(/\[\d+\]/g, '')
      .replace(/[*_#`~]/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (!cleanedText) {
      onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanedText);

    // Pick best voice
    let voiceToUse: SpeechSynthesisVoice | null = null;
    if (this.selectedVoiceURI) {
      const found = this.cachedVoices.find(
        (v) => v.voice.voiceURI === this.selectedVoiceURI
      );
      if (found) voiceToUse = found.voice;
    }

    if (!voiceToUse && this.cachedVoices.length > 0) {
      voiceToUse = this.cachedVoices[0].voice;
    }

    if (voiceToUse) {
      utterance.voice = voiceToUse;
      utterance.lang = voiceToUse.lang;
    } else {
      const isDevanagari = /[\u0900-\u097F]/.test(cleanedText);
      utterance.lang = isDevanagari ? 'mr-IN' : 'en-IN';
    }

    utterance.rate = this.speechRate;
    utterance.pitch = this.speechPitch;

    utterance.onstart = () => {
      this.isSpeaking = true;
      onStart?.();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      onEnd?.();
    };

    utterance.onerror = (e) => {
      this.isSpeaking = false;
      console.warn('Speech synthesis error:', e);
      onError?.(e);
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }

  static stop() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
  }

  static getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

export const SpeechManager = VoiceManager;

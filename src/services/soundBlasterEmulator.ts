/**
 * Sound Blaster 16 & Yamaha YM3812 (OPL2) FM Synthesizer Emulator
 * Emulates vintage 8-bit DMA PCM playback and 2-operator FM synthesis using Web Audio API.
 */

import { SoundBlasterConfig } from '../types/dos';

export class SoundBlasterEmulator {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private dacGain: GainNode | null = null;
  private oplGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private isMuted: boolean = false;
  private isRunningMusic: boolean = false;
  private musicTimer: number | null = null;
  private musicStep: number = 0;
  private config: SoundBlasterConfig;

  // Active FM voices
  private activeVoices: Array<{ osc: OscillatorNode; mod: OscillatorNode; gain: GainNode }> = [];

  constructor(config: SoundBlasterConfig) {
    this.config = config;
  }

  public updateConfig(newConfig: SoundBlasterConfig) {
    this.config = newConfig;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.config.volumeMaster / 100, this.audioCtx.currentTime);
    }
    if (this.oplGain && this.audioCtx) {
      this.oplGain.gain.setValueAtTime(this.config.volumeOpl / 100, this.audioCtx.currentTime);
    }
    if (this.dacGain && this.audioCtx) {
      this.dacGain.gain.setValueAtTime(this.config.volumeDac / 100, this.audioCtx.currentTime);
    }
  }

  public initAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      // Master Gain
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.config.volumeMaster / 100, this.audioCtx.currentTime);

      // DAC (8-bit PCM) Gain
      this.dacGain = this.audioCtx.createGain();
      this.dacGain.gain.setValueAtTime(this.config.volumeDac / 100, this.audioCtx.currentTime);
      this.dacGain.connect(this.masterGain);

      // OPL2 FM Gain
      this.oplGain = this.audioCtx.createGain();
      this.oplGain.gain.setValueAtTime(this.config.volumeOpl / 100, this.audioCtx.currentTime);
      this.oplGain.connect(this.masterGain);

      // Analyser for real-time oscilloscope
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    return this.audioCtx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.config.volumeMaster / 100, this.audioCtx.currentTime);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * Sound Blaster 8-Bit DAC PCM Sound Effects
   * Digitized audio with 8-bit quantization and vintage low-pass filter
   */
  public playDspSample(sampleType: 'engine' | 'jump' | 'laser' | 'coin' | 'explosion' | 'voice_ready') {
    const ctx = this.initAudioContext();
    const duration = sampleType === 'explosion' ? 0.6 : sampleType === 'engine' ? 0.15 : 0.25;
    const sampleRate = 11025; // Authentic 11kHz 8-bit SB sample rate
    const frameCount = Math.floor(sampleRate * duration);
    const audioBuffer = ctx.createBuffer(1, frameCount, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < frameCount; i++) {
      const t = i / sampleRate;
      let rawSample = 0;

      if (sampleType === 'jump') {
        // Classic rising square pitch + chirp
        const freq = 160 + 900 * (t / duration);
        rawSample = Math.sin(2 * Math.PI * freq * t) > 0 ? 0.7 : -0.7;
      } else if (sampleType === 'coin') {
        // Two-tone high chime (B5 -> E6)
        const freq = t < duration * 0.4 ? 987.77 : 1318.51;
        rawSample = Math.sin(2 * Math.PI * freq * t) * (1 - t / duration);
      } else if (sampleType === 'laser') {
        // Falling fast pitch chirp
        const freq = 1800 * Math.exp(-14 * t);
        rawSample = (Math.sin(2 * Math.PI * freq * t) + 0.3 * (Math.random() * 2 - 1)) * (1 - t / duration);
      } else if (sampleType === 'explosion') {
        // 8-bit noise with decaying envelope and rumble
        const noise = (Math.random() * 2 - 1);
        const rumble = Math.sin(2 * Math.PI * 65 * t);
        rawSample = (0.75 * noise + 0.25 * rumble) * Math.pow(1 - t / duration, 1.8);
      } else if (sampleType === 'engine') {
        // Motor engine hum (sawtooth with jitter)
        const freq = 90 + 30 * Math.sin(t * 50);
        rawSample = (2 * ((t * freq) % 1) - 1) * 0.8;
      } else if (sampleType === 'voice_ready') {
        // Formant synthesis for robotic digitized "Sound Blaster Ready"
        const f1 = 700 + 100 * Math.sin(t * 20);
        const f2 = 1800 + 200 * Math.cos(t * 15);
        const carrier = Math.sin(2 * Math.PI * 130 * t);
        rawSample = carrier * (Math.sin(2 * Math.PI * f1 * t) * 0.5 + Math.sin(2 * Math.PI * f2 * t) * 0.5);
      }

      // Replicate 8-bit quantization (256 discrete levels: -128..127)
      const quantized = Math.round(rawSample * 127) / 127;
      channelData[i] = quantized;
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    // Vintage Sound Blaster 2.0 / 16 low-pass filter (cuts high aliasing frequencies at ~4.5 kHz)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 4500;

    source.connect(filter);
    filter.connect(this.dacGain!);
    source.start();
  }

  /**
   * Yamaha YM3812 (OPL2) 2-Operator FM Note Trigger
   * Modulator frequency modulates the Carrier frequency with feedback
   */
  public playOplNote(carrierFreq: number, duration: number = 0.2, modRatio: number = 2.0, modIndex: number = 400) {
    if (!this.config.oplEnabled) return;
    const ctx = this.initAudioContext();
    const now = ctx.currentTime;

    // Carrier Oscillator
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(carrierFreq, now);

    // Modulator Oscillator
    const modulator = ctx.createOscillator();
    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(carrierFreq * modRatio, now);

    // Modulation Gain (sets FM depth)
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(modIndex, now);
    modGain.gain.exponentialRampToValueAtTime(10, now + duration);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    // Carrier Envelope Gain (ADSR)
    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0.001, now);
    // Attack: 15ms
    voiceGain.gain.linearRampToValueAtTime(0.35, now + 0.015);
    // Decay & Release
    voiceGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    carrier.connect(voiceGain);
    voiceGain.connect(this.oplGain!);

    modulator.start(now);
    carrier.start(now);

    modulator.stop(now + duration + 0.05);
    carrier.stop(now + duration + 0.05);
  }

  /**
   * Start authentic background retro OPL2 tracker music loop
   */
  public startOplMusic(genre: 'racer' | 'platformer' | 'shmup') {
    this.stopOplMusic();
    this.isRunningMusic = true;
    this.musicStep = 0;

    // Note patterns in Hz (Standard pentatonic & dorian video game patterns)
    const racerNotes = [
      130.81, 155.56, 174.61, 196.00, 233.08, 261.63, 196.00, 174.61,
      130.81, 130.81, 261.63, 233.08, 196.00, 174.61, 155.56, 116.54
    ];

    const platformerNotes = [
      261.63, 261.63, 0, 261.63, 0, 207.65, 261.63, 0,
      329.63, 0, 0, 0, 196.00, 0, 0, 0,
      220.00, 261.63, 329.63, 392.00, 329.63, 261.63, 220.00, 196.00
    ];

    const shmupNotes = [
      110.00, 110.00, 220.00, 110.00, 164.81, 146.83, 130.81, 110.00,
      123.47, 123.47, 246.94, 123.47, 185.00, 164.81, 146.83, 123.47
    ];

    const notes = genre === 'racer' ? racerNotes : genre === 'platformer' ? platformerNotes : shmupNotes;
    const intervalMs = genre === 'racer' ? 125 : genre === 'platformer' ? 140 : 110;

    this.musicTimer = window.setInterval(() => {
      if (!this.isRunningMusic || this.isMuted) return;
      const freq = notes[this.musicStep % notes.length];
      if (freq > 0) {
        this.playOplNote(freq, intervalMs / 1000 * 0.9, 2.0, 300);
        // Bass accompaniment every 4 beats
        if (this.musicStep % 4 === 0) {
          this.playOplNote(freq / 2, 0.25, 1.0, 150);
        }
      }
      this.musicStep++;
    }, intervalMs);
  }

  public stopOplMusic() {
    this.isRunningMusic = false;
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  public dispose() {
    this.stopOplMusic();
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}

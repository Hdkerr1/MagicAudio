/**
 * Real-time Web Audio API engine with mode switching and adjustable parameters.
 */
import { createSaturationCurve, createSoftClipCurve } from './dsp-utils';

export type PlaybackMode = 'slowed-reverb' | 'remix' | 'lofi' | null;

export interface ModeParams {
  'slowed-reverb': { speed: number; reverbMix: number; reverbDecay: number };
  'remix': { bass: number; presence: number; punch: number; hall: number };
  'lofi': { warmth: number; crackle: number; wobble: number; speed: number };
}

export const defaultParams: ModeParams = {
  'slowed-reverb': { speed: 0.85, reverbMix: 0.6, reverbDecay: 4 },
  'remix': { bass: 0.5, presence: 0.5, punch: 0.5 },
  'lofi': { warmth: 0.5, crackle: 0.3, wobble: 0.35, speed: 0.88 },
};

export interface EngineState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  mode: PlaybackMode;
}

function generateReverbIR(sampleRate: number, duration: number): AudioBuffer {
  const length = Math.ceil(sampleRate * duration);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const ir = ctx.createBuffer(2, length, sampleRate);
  const earlyTaps = [
    { time: 0.012, gain: 0.7 }, { time: 0.019, gain: 0.55 },
    { time: 0.026, gain: 0.48 }, { time: 0.035, gain: 0.4 },
    { time: 0.046, gain: 0.33 }, { time: 0.058, gain: 0.27 },
    { time: 0.073, gain: 0.2 }, { time: 0.091, gain: 0.15 },
    { time: 0.112, gain: 0.1 },
  ];
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let seed = ch === 0 ? 12345 : 67890;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };
    for (const tap of earlyTaps) {
      const idx = Math.floor(tap.time * sampleRate) + (ch * Math.floor(0.003 * sampleRate));
      if (idx < length) data[idx] += tap.gain * (0.85 + rand() * 0.15);
    }
    const decayRate = 2.2 / duration;
    for (let i = Math.floor(0.08 * sampleRate); i < length; i++) {
      const t = i / sampleRate;
      const decay = 0.6 * Math.exp(-t * decayRate * 1.8) + 0.4 * Math.exp(-t * decayRate * 0.7);
      const hfDamp = Math.exp(-t * 1.5);
      data[i] += (rand() * hfDamp + rand() * (1 - hfDamp) * 0.3) * decay * 0.16;
    }
  }
  return ir;
}

function createVinylNoiseBuffer(sampleRate: number, duration: number): AudioBuffer {
  const length = Math.ceil(sampleRate * duration);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const buf = ctx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let prev = 0;
    for (let i = 0; i < length; i++) {
      prev = (prev + (Math.random() * 2 - 1) * 0.015) * 0.997;
      data[i] = prev;
      if (Math.random() < 0.00004) {
        const bl = Math.floor(Math.random() * 3 + 2);
        const amp = Math.random() * 0.08 + 0.03;
        for (let j = 0; j < bl && i + j < length; j++) data[i + j] += (Math.random() * 2 - 1) * amp * (1 - j / bl);
      }
    }
  }
  return buf;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private currentMode: PlaybackMode = null;
  private isPlaying = false;
  private startedAt = 0;
  private pausedAt = 0;
  private onStateChange: ((state: EngineState) => void) | null = null;
  private rafId: number | null = null;
  private chainNodes: AudioNode[] = [];
  private noiseSource: AudioBufferSourceNode | null = null;
  private lfoNode: OscillatorNode | null = null;

  private params: ModeParams = JSON.parse(JSON.stringify(defaultParams));

  private liveNodes: {
    dryGain?: GainNode;
    wetGain?: GainNode;
    bassShelf?: BiquadFilterNode;
    presenceBoost?: BiquadFilterNode;
    parallelCompGain?: GainNode;
    noiseGain?: GainNode;
    midBoost?: BiquadFilterNode;
    lfoGain?: GainNode;
    bassWarmth?: BiquadFilterNode;
  } = {};

  async loadFile(file: File): Promise<void> {
    if (!this.ctx) this.ctx = new AudioContext();
    const arrayBuffer = await file.arrayBuffer();
    this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.pausedAt = 0;
    this.emitState();
  }

  setOnStateChange(cb: (state: EngineState) => void) { this.onStateChange = cb; }
  getAnalyser(): AnalyserNode | null { return this.analyser; }
  getAudioBuffer(): AudioBuffer | null { return this.audioBuffer; }
  getIsPlaying(): boolean { return this.isPlaying; }
  getMode(): PlaybackMode { return this.currentMode; }
  getParams(): ModeParams { return this.params; }

  getDuration(): number {
    if (!this.audioBuffer) return 0;
    let rate = 1;
    if (this.currentMode === 'slowed-reverb') rate = this.params['slowed-reverb'].speed;
    else if (this.currentMode === 'lofi') rate = this.params['lofi'].speed;
    return this.audioBuffer.duration / rate;
  }

  getCurrentTime(): number {
    if (!this.ctx || !this.isPlaying) return this.pausedAt;
    return this.pausedAt + (this.ctx.currentTime - this.startedAt);
  }

  setMode(mode: PlaybackMode) {
    const wasPlaying = this.isPlaying;
    const time = this.getCurrentTime();
    if (wasPlaying) this.stopSource();
    this.pausedAt = time;
    this.currentMode = mode;
    if (wasPlaying) this.play();
    this.emitState();
  }

  updateParam<M extends keyof ModeParams>(mode: M, key: keyof ModeParams[M], value: number) {
    (this.params[mode] as any)[key] = value;

    if (mode === 'slowed-reverb' && this.currentMode === 'slowed-reverb') {
      const p = this.params['slowed-reverb'];
      if (key === 'speed' && this.sourceNode) {
        this.sourceNode.playbackRate.setTargetAtTime(p.speed, this.ctx!.currentTime, 0.05);
      }
      if (key === 'reverbMix') {
        this.liveNodes.dryGain?.gain.setTargetAtTime(1 - p.reverbMix * 0.5, this.ctx!.currentTime, 0.05);
        this.liveNodes.wetGain?.gain.setTargetAtTime(p.reverbMix * 0.55, this.ctx!.currentTime, 0.05);
      }
    }

    if (mode === 'remix' && this.currentMode === 'remix') {
      const p = this.params['remix'];
      if (key === 'bass' && this.liveNodes.bassShelf) {
        this.liveNodes.bassShelf.gain.setTargetAtTime(p.bass * 6, this.ctx!.currentTime, 0.05);
      }
      if (key === 'presence' && this.liveNodes.presenceBoost) {
        this.liveNodes.presenceBoost.gain.setTargetAtTime(p.presence * 4, this.ctx!.currentTime, 0.05);
      }
      if (key === 'punch' && this.liveNodes.parallelCompGain) {
        this.liveNodes.parallelCompGain.gain.setTargetAtTime(p.punch * 0.5, this.ctx!.currentTime, 0.05);
      }
    }

    if (mode === 'lofi' && this.currentMode === 'lofi') {
      const p = this.params['lofi'];
      if (key === 'speed' && this.sourceNode) {
        this.sourceNode.playbackRate.setTargetAtTime(p.speed, this.ctx!.currentTime, 0.05);
      }
      if (key === 'warmth' && this.liveNodes.midBoost) {
        this.liveNodes.midBoost.gain.setTargetAtTime(p.warmth * 3, this.ctx!.currentTime, 0.05);
      }
      if (key === 'crackle' && this.liveNodes.noiseGain) {
        this.liveNodes.noiseGain.gain.setTargetAtTime(p.crackle * 0.015, this.ctx!.currentTime, 0.05);
      }
      if (key === 'wobble' && this.liveNodes.lfoGain) {
        this.liveNodes.lfoGain.gain.setTargetAtTime(p.wobble * 0.002, this.ctx!.currentTime, 0.05);
      }
    }
  }

  play() {
    if (!this.ctx || !this.audioBuffer) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.stopSource();
    this.buildChain();

    this.sourceNode = this.ctx.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;

    let rate = 1;
    if (this.currentMode === 'slowed-reverb') {
      rate = this.params['slowed-reverb'].speed;
    } else if (this.currentMode === 'lofi') {
      rate = this.params['lofi'].speed;
    }
    this.sourceNode.playbackRate.value = rate;

    const firstNode = this.chainNodes.length > 0 ? this.chainNodes[0] : this.analyser!;
    this.sourceNode.connect(firstNode);
    this.sourceNode.onended = () => {
      if (this.isPlaying) { this.isPlaying = false; this.pausedAt = 0; this.emitState(); }
    };

    const offset = this.pausedAt * rate;
    this.sourceNode.start(0, Math.min(offset, this.audioBuffer.duration - 0.01));
    this.startedAt = this.ctx.currentTime;
    this.isPlaying = true;
    this.startTick();
    this.emitState();
  }

  pause() {
    if (!this.isPlaying) return;
    this.pausedAt = this.getCurrentTime();
    this.stopSource();
    this.isPlaying = false;
    this.emitState();
  }

  seekTo(time: number) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) this.stopSource();
    this.pausedAt = Math.max(0, Math.min(time, this.getDuration()));
    if (wasPlaying) this.play();
    else this.emitState();
  }

  async exportProcessed(): Promise<Blob> {
    if (!this.audioBuffer) throw new Error('No audio loaded');
    const { processAudio } = await import('./index');
    const mode = this.currentMode || 'slowed-reverb';
    const { audioBufferToWav } = await import('./encode');
    const originalBlob = audioBufferToWav(this.audioBuffer);
    const file = new File([originalBlob], 'export.wav', { type: 'audio/wav' });
    return processAudio(file, mode, () => {});
  }

  destroy() {
    this.stopSource();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.ctx) this.ctx.close();
    this.ctx = null;
    this.audioBuffer = null;
  }

  private buildChain() {
    if (!this.ctx) return;
    this.chainNodes.forEach(n => n.disconnect());
    this.chainNodes = [];
    this.liveNodes = {};
    if (this.noiseSource) { try { this.noiseSource.stop(); } catch {} this.noiseSource = null; }
    if (this.lfoNode) { try { this.lfoNode.stop(); } catch {} this.lfoNode = null; }
    if (this.analyser) this.analyser.disconnect();
    if (this.gainNode) this.gainNode.disconnect();

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 0.9;

    switch (this.currentMode) {
      case 'slowed-reverb': this.buildSlowedReverbChain(); break;
      case 'remix': this.buildRemixChain(); break;
      case 'lofi': this.buildLoFiChain(); break;
    }

    const lastChain = this.chainNodes.length > 0 ? this.chainNodes[this.chainNodes.length - 1] : null;
    if (lastChain) lastChain.connect(this.analyser);
    this.analyser.connect(this.gainNode);
    this.gainNode.connect(this.ctx.destination);
  }

  private buildSlowedReverbChain() {
    const ctx = this.ctx!;
    const p = this.params['slowed-reverb'];

    const preHP = ctx.createBiquadFilter();
    preHP.type = 'highpass'; preHP.frequency.value = 250; preHP.Q.value = 0.5;

    const convolver = ctx.createConvolver();
    convolver.buffer = generateReverbIR(ctx.sampleRate, p.reverbDecay);

    const postLP = ctx.createBiquadFilter();
    postLP.type = 'lowpass'; postLP.frequency.value = 12000; postLP.Q.value = 0.5;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1 - p.reverbMix * 0.5;
    const wetGain = ctx.createGain();
    wetGain.gain.value = p.reverbMix * 0.55;

    this.liveNodes.dryGain = dryGain;
    this.liveNodes.wetGain = wetGain;

    const mixBus = ctx.createGain();
    mixBus.gain.value = 1.0;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8; comp.knee.value = 8; comp.ratio.value = 3;
    comp.attack.value = 0.01; comp.release.value = 0.25;

    const inputGain = ctx.createGain();
    inputGain.gain.value = 1.0;

    inputGain.connect(dryGain); dryGain.connect(mixBus);
    inputGain.connect(preHP); preHP.connect(convolver); convolver.connect(postLP);
    postLP.connect(wetGain); wetGain.connect(mixBus);
    mixBus.connect(comp);

    this.chainNodes = [inputGain, comp];
  }

  /**
   * Remix — clean, wide, punchy, radio-ready sound.
   * Musical EQ + parallel compression + transparent mastering.
   */
  private buildRemixChain() {
    const ctx = this.ctx!;
    const p = this.params['remix'];

    const inputGain = ctx.createGain();
    inputGain.gain.value = 1.0;

    // Sub rumble cut
    const subCut = ctx.createBiquadFilter();
    subCut.type = 'highpass'; subCut.frequency.value = 28; subCut.Q.value = 0.5;

    // Bass warmth shelf
    const bassShelf = ctx.createBiquadFilter();
    bassShelf.type = 'lowshelf'; bassShelf.frequency.value = 100;
    bassShelf.gain.value = p.bass * 6;
    this.liveNodes.bassShelf = bassShelf;

    // Clean up muddy region
    const mudCut = ctx.createBiquadFilter();
    mudCut.type = 'peaking'; mudCut.frequency.value = 400;
    mudCut.gain.value = -1.5; mudCut.Q.value = 1.2;

    // Presence
    const presenceBoost = ctx.createBiquadFilter();
    presenceBoost.type = 'peaking'; presenceBoost.frequency.value = 3000;
    presenceBoost.gain.value = p.presence * 4; presenceBoost.Q.value = 1.0;
    this.liveNodes.presenceBoost = presenceBoost;

    // Air shelf
    const airShelf = ctx.createBiquadFilter();
    airShelf.type = 'highshelf'; airShelf.frequency.value = 10000;
    airShelf.gain.value = 2;

    // Dry path
    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.7;

    // Parallel compression for punch
    const parallelComp = ctx.createDynamicsCompressor();
    parallelComp.threshold.value = -30; parallelComp.knee.value = 5;
    parallelComp.ratio.value = 8; parallelComp.attack.value = 0.002;
    parallelComp.release.value = 0.1;

    const parallelCompGain = ctx.createGain();
    parallelCompGain.gain.value = p.punch * 0.5;
    this.liveNodes.parallelCompGain = parallelCompGain;

    const mixBus = ctx.createGain();
    mixBus.gain.value = 1.0;

    // Master glue compression
    const masterComp = ctx.createDynamicsCompressor();
    masterComp.threshold.value = -8; masterComp.knee.value = 10;
    masterComp.ratio.value = 2.5; masterComp.attack.value = 0.01;
    masterComp.release.value = 0.2;

    // Very gentle console saturation
    const consoleSat = ctx.createWaveShaper();
    consoleSat.curve = createSaturationCurve(0.12) as Float32Array<ArrayBuffer>;
    consoleSat.oversample = '4x';

    // Transparent limiter
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.5; limiter.knee.value = 0.5;
    limiter.ratio.value = 20; limiter.attack.value = 0.0005;
    limiter.release.value = 0.05;

    // EQ chain
    inputGain.connect(subCut);
    subCut.connect(bassShelf);
    bassShelf.connect(mudCut);
    mudCut.connect(presenceBoost);
    presenceBoost.connect(airShelf);

    // Parallel compression split
    airShelf.connect(dryGain);
    dryGain.connect(mixBus);
    airShelf.connect(parallelComp);
    parallelComp.connect(parallelCompGain);
    parallelCompGain.connect(mixBus);

    // Master
    mixBus.connect(masterComp);
    masterComp.connect(consoleSat);
    consoleSat.connect(limiter);

    this.chainNodes = [inputGain, limiter];
  }

  /**
   * Lo-Fi — warm, slowed, nostalgic vintage sound.
   */
  private buildLoFiChain() {
    const ctx = this.ctx!;
    const p = this.params['lofi'];

    const inputGain = ctx.createGain();
    inputGain.gain.value = 1.0;

    // Wide vintage EQ
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 60; hp.Q.value = 0.5;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 13000; lp.Q.value = 0.5;

    const lp2 = ctx.createBiquadFilter();
    lp2.type = 'lowpass'; lp2.frequency.value = 11000; lp2.Q.value = 0.5;

    // Bass warmth
    const bassWarmth = ctx.createBiquadFilter();
    bassWarmth.type = 'lowshelf'; bassWarmth.frequency.value = 150;
    bassWarmth.gain.value = 1.5;
    this.liveNodes.bassWarmth = bassWarmth;

    // Warm mid presence
    const midBoost = ctx.createBiquadFilter();
    midBoost.type = 'peaking'; midBoost.frequency.value = 700;
    midBoost.gain.value = p.warmth * 3; midBoost.Q.value = 0.7;
    this.liveNodes.midBoost = midBoost;

    // Tape character dip
    const hiMidDip = ctx.createBiquadFilter();
    hiMidDip.type = 'peaking'; hiMidDip.frequency.value = 5000;
    hiMidDip.gain.value = -1; hiMidDip.Q.value = 0.8;

    // Very gentle tape saturation
    const sat = ctx.createWaveShaper();
    sat.curve = createSaturationCurve(0.15) as Float32Array<ArrayBuffer>;
    sat.oversample = '4x';

    // Subtle wow & flutter
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = 0.003;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.3;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = p.wobble * 0.002;
    lfo.connect(lfoGain); lfoGain.connect(delay.delayTime);
    lfo.start();
    this.lfoNode = lfo;
    this.liveNodes.lfoGain = lfoGain;

    // Gentle compression
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -15; comp.knee.value = 15; comp.ratio.value = 2;
    comp.attack.value = 0.025; comp.release.value = 0.25;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.93;

    // Very quiet vinyl noise
    if (this.audioBuffer) {
      const noiseBuf = createVinylNoiseBuffer(ctx.sampleRate, this.audioBuffer.duration + 10);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuf; noiseSource.loop = true;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = p.crackle * 0.015;
      this.liveNodes.noiseGain = noiseGain;

      const noiseLP = ctx.createBiquadFilter();
      noiseLP.type = 'lowpass'; noiseLP.frequency.value = 2500; noiseLP.Q.value = 0.5;
      const noiseHP = ctx.createBiquadFilter();
      noiseHP.type = 'highpass'; noiseHP.frequency.value = 250; noiseHP.Q.value = 0.5;

      noiseSource.connect(noiseHP); noiseHP.connect(noiseLP);
      noiseLP.connect(noiseGain); noiseGain.connect(masterGain);
      noiseSource.start();
      this.noiseSource = noiseSource;
    }

    // Signal chain
    inputGain.connect(hp);
    hp.connect(lp);
    lp.connect(lp2);
    lp2.connect(bassWarmth);
    bassWarmth.connect(midBoost);
    midBoost.connect(hiMidDip);
    hiMidDip.connect(delay);
    delay.connect(sat);
    sat.connect(comp);
    comp.connect(masterGain);

    this.chainNodes = [inputGain, masterGain];
  }

  private stopSource() {
    if (this.sourceNode) { try { this.sourceNode.stop(); } catch {} this.sourceNode.disconnect(); this.sourceNode = null; }
    if (this.noiseSource) { try { this.noiseSource.stop(); } catch {} this.noiseSource = null; }
    if (this.lfoNode) { try { this.lfoNode.stop(); } catch {} this.lfoNode = null; }
    this.isPlaying = false;
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  }

  private startTick() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    const tick = () => {
      if (!this.isPlaying) return;
      this.emitState();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private emitState() {
    this.onStateChange?.({
      isPlaying: this.isPlaying,
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
      mode: this.currentMode,
    });
  }
}

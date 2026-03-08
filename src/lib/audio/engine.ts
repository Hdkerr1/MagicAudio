/**
 * Real-time Web Audio API engine with mode switching and adjustable parameters.
 */
import { createSaturationCurve, createSoftClipCurve } from './dsp-utils';

export type PlaybackMode = 'slowed-reverb' | 'remix' | 'lofi' | null;

export interface ModeParams {
  'slowed-reverb': { speed: number; reverbMix: number; reverbDecay: number; spatial: number };
  'remix': { bass: number; presence: number; punch: number; hall: number; stereoWidth: number; spatial: number };
  'lofi': { warmth: number; crackle: number; wobble: number; speed: number; spatial: number };
}

export const defaultParams: ModeParams = {
  'slowed-reverb': { speed: 0.85, reverbMix: 0.6, reverbDecay: 4, spatial: 0.5 },
  'remix': { bass: 0.5, presence: 0.5, punch: 0.5, hall: 0.4, stereoWidth: 0.6, spatial: 0.5 },
  'lofi': { warmth: 0.5, crackle: 0.3, wobble: 0.35, speed: 0.88, spatial: 0.4 },
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

/**
 * Generate a large concert hall impulse response — spacious, warm, with distinct echoes.
 * Longer pre-delay + dense early reflections + smooth tail for that "hall" sound.
 */
function generateHallIR(sampleRate: number): AudioBuffer {
  const duration = 3.5; // Long hall tail
  const length = Math.ceil(sampleRate * duration);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const ir = ctx.createBuffer(2, length, sampleRate);

  // Hall early reflections — more spread out than room reverb, with pre-delay
  const earlyTaps = [
    { time: 0.025, gain: 0.6 },  { time: 0.038, gain: 0.5 },
    { time: 0.055, gain: 0.45 }, { time: 0.072, gain: 0.38 },
    { time: 0.095, gain: 0.32 }, { time: 0.120, gain: 0.26 },
    { time: 0.155, gain: 0.2 },  { time: 0.195, gain: 0.16 },
    { time: 0.240, gain: 0.12 }, { time: 0.300, gain: 0.08 },
    { time: 0.370, gain: 0.05 },
  ];

  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let seed = ch === 0 ? 54321 : 98765;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };

    // Early reflections with stereo spread
    for (const tap of earlyTaps) {
      const stereoOffset = ch * Math.floor(0.006 * sampleRate); // wider stereo than room
      const idx = Math.floor(tap.time * sampleRate) + stereoOffset;
      if (idx < length) {
        data[idx] += tap.gain * (0.8 + rand() * 0.2);
        // Add a secondary reflection for density
        const idx2 = idx + Math.floor(0.004 * sampleRate * (1 + rand() * 0.3));
        if (idx2 < length) data[idx2] += tap.gain * 0.3 * (0.8 + rand() * 0.2);
      }
    }

    // Dense diffuse tail — dual-decay (warm body + airy tail)
    const startSample = Math.floor(0.08 * sampleRate);
    for (let i = startSample; i < length; i++) {
      const t = i / sampleRate;
      // Dual decay: fast warm body + slow airy tail
      const bodyDecay = 0.55 * Math.exp(-t * 1.8);
      const tailDecay = 0.35 * Math.exp(-t * 0.8);
      const decay = bodyDecay + tailDecay;
      // HF damping for warmth (hall absorbs highs over distance)
      const hfDamp = 0.6 * Math.exp(-t * 2.0) + 0.4 * Math.exp(-t * 0.5);
      const sample = rand() * hfDamp + rand() * (1 - hfDamp) * 0.2;
      data[i] += sample * decay * 0.14;
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

/**
 * Build an immersive spatial / Dolby Atmos-like processing chain.
 * Uses cross-feed delays, HRTF-like filtering, and micro-reverb for 3D soundstage.
 * Returns { input, output } nodes to splice into the main chain.
 */
function buildSpatialChain(ctx: AudioContext, spatialAmount: number): {
  input: GainNode; output: GainNode; wetGain: GainNode;
} {
  const input = ctx.createGain();
  input.gain.value = 1.0;
  const output = ctx.createGain();
  output.gain.value = 1.0;

  // Dry path
  const dryGain = ctx.createGain();
  dryGain.gain.value = 1.0;
  input.connect(dryGain);
  dryGain.connect(output);

  // === Spatial wet path ===
  const wetGain = ctx.createGain();
  wetGain.gain.value = spatialAmount * 0.35;

  // Stereo cross-feed with HRTF-like delays (creates "around you" feeling)
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);

  // Left-to-right cross-feed with ITD (interaural time delay ~0.6ms)
  const crossDelayLR = ctx.createDelay(0.01);
  crossDelayLR.delayTime.value = 0.0006;
  const crossGainLR = ctx.createGain();
  crossGainLR.gain.value = 0.3;

  // Right-to-left cross-feed
  const crossDelayRL = ctx.createDelay(0.01);
  crossDelayRL.delayTime.value = 0.0008; // Slightly different for asymmetry
  const crossGainRL = ctx.createGain();
  crossGainRL.gain.value = 0.25;

  // HRTF-like filtering — slight high shelf cut on cross-feed (head shadow)
  const headShadowL = ctx.createBiquadFilter();
  headShadowL.type = 'lowpass'; headShadowL.frequency.value = 6000; headShadowL.Q.value = 0.5;
  const headShadowR = ctx.createBiquadFilter();
  headShadowR.type = 'lowpass'; headShadowR.frequency.value = 5500; headShadowR.Q.value = 0.5;

  // Pinna reflection simulation — subtle comb-like delay
  const pinnaDelayL = ctx.createDelay(0.005);
  pinnaDelayL.delayTime.value = 0.00018; // ~0.18ms pinna reflection
  const pinnaGainL = ctx.createGain();
  pinnaGainL.gain.value = 0.15;
  const pinnaDelayR = ctx.createDelay(0.005);
  pinnaDelayR.delayTime.value = 0.00022;
  const pinnaGainR = ctx.createGain();
  pinnaGainR.gain.value = 0.12;

  // Early spatial reflections (micro-reverb for envelopment)
  const spatialDelay1 = ctx.createDelay(0.1);
  spatialDelay1.delayTime.value = 0.012;
  const spatialGain1 = ctx.createGain();
  spatialGain1.gain.value = 0.18;

  const spatialDelay2 = ctx.createDelay(0.1);
  spatialDelay2.delayTime.value = 0.023;
  const spatialGain2 = ctx.createGain();
  spatialGain2.gain.value = 0.12;

  const spatialDelay3 = ctx.createDelay(0.1);
  spatialDelay3.delayTime.value = 0.037;
  const spatialGain3 = ctx.createGain();
  spatialGain3.gain.value = 0.08;

  // Spatial reflection LP (warm, distant feel)
  const spatialLP = ctx.createBiquadFilter();
  spatialLP.type = 'lowpass'; spatialLP.frequency.value = 8000; spatialLP.Q.value = 0.5;

  // === Routing ===
  input.connect(splitter);

  // Cross-feed L→R
  splitter.connect(crossDelayLR, 0);
  crossDelayLR.connect(headShadowL);
  headShadowL.connect(crossGainLR);
  crossGainLR.connect(merger, 0, 1); // L channel feeds into R

  // Cross-feed R→L
  splitter.connect(crossDelayRL, 1);
  crossDelayRL.connect(headShadowR);
  headShadowR.connect(crossGainRL);
  crossGainRL.connect(merger, 0, 0); // R channel feeds into L

  // Pinna reflections
  splitter.connect(pinnaDelayL, 0);
  pinnaDelayL.connect(pinnaGainL);
  pinnaGainL.connect(merger, 0, 0);

  splitter.connect(pinnaDelayR, 1);
  pinnaDelayR.connect(pinnaGainR);
  pinnaGainR.connect(merger, 0, 1);

  // Early spatial reflections for envelopment
  input.connect(spatialDelay1);
  spatialDelay1.connect(spatialGain1);
  spatialGain1.connect(spatialLP);

  input.connect(spatialDelay2);
  spatialDelay2.connect(spatialGain2);
  spatialGain2.connect(spatialLP);

  input.connect(spatialDelay3);
  spatialDelay3.connect(spatialGain3);
  spatialGain3.connect(spatialLP);

  spatialLP.connect(merger, 0, 0);
  spatialLP.connect(merger, 0, 1);

  merger.connect(wetGain);
  wetGain.connect(output);

  return { input, output, wetGain };
}

/**
 * Build Mid/Side stereo widening. Boosts the side (difference) channel.
 */
function buildStereoWidener(ctx: AudioContext, widthAmount: number): {
  input: GainNode; output: GainNode; sideGain: GainNode;
} {
  const input = ctx.createGain();
  input.gain.value = 1.0;
  const output = ctx.createGain();
  output.gain.value = 1.0;

  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);

  // Mid = (L+R)/2, Side = (L-R)/2
  // We reconstruct with boosted sides
  const midGain = ctx.createGain();
  midGain.gain.value = 0.7; // Slightly reduce mid for wider feel

  const sideGain = ctx.createGain();
  sideGain.gain.value = 0.5 + widthAmount * 1.0; // Boost sides

  // L = Mid + Side, R = Mid - Side
  // Using scriptless approach: duplicate channels with gain manipulation
  // Simpler approach: use delay-based widening + channel manipulation
  
  // Left channel processing
  const leftGain = ctx.createGain();
  leftGain.gain.value = 1.0;
  
  // Right channel processing  
  const rightGain = ctx.createGain();
  rightGain.gain.value = 1.0;

  // Subtle delay on one channel for Haas effect widening
  const haasDelay = ctx.createDelay(0.05);
  haasDelay.delayTime.value = 0.0003 + widthAmount * 0.012; // 0.3-12.3ms based on width

  // Side enhancement via allpass filters (phase-based widening)
  const allpassL = ctx.createBiquadFilter();
  allpassL.type = 'allpass'; allpassL.frequency.value = 800; allpassL.Q.value = 0.7;
  
  const allpassR = ctx.createBiquadFilter();
  allpassR.type = 'allpass'; allpassR.frequency.value = 1200; allpassR.Q.value = 0.7;

  input.connect(splitter);
  
  // Left: direct + allpass
  splitter.connect(leftGain, 0);
  splitter.connect(allpassL, 0);
  allpassL.connect(sideGain);

  // Right: Haas delayed + allpass
  splitter.connect(haasDelay, 1);
  haasDelay.connect(rightGain);
  splitter.connect(allpassR, 1);
  allpassR.connect(sideGain);

  leftGain.connect(merger, 0, 0);
  rightGain.connect(merger, 0, 1);
  sideGain.connect(merger, 0, 0);
  sideGain.connect(merger, 0, 1);

  merger.connect(output);

  return { input, output, sideGain };
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
    hallWetGain?: GainNode;
    noiseGain?: GainNode;
    midBoost?: BiquadFilterNode;
    lfoGain?: GainNode;
    bassWarmth?: BiquadFilterNode;
    // Spatial / stereo nodes
    spatialWetGain?: GainNode;
    stereoWidthGain?: GainNode; // side channel gain for M/S
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
      if (key === 'hall' && this.liveNodes.hallWetGain) {
        this.liveNodes.hallWetGain.gain.setTargetAtTime(p.hall * 0.45, this.ctx!.currentTime, 0.05);
      }
      if (key === 'stereoWidth' && this.liveNodes.stereoWidthGain) {
        this.liveNodes.stereoWidthGain.gain.setTargetAtTime(0.5 + p.stereoWidth * 1.0, this.ctx!.currentTime, 0.05);
      }
      if (key === 'spatial' && this.liveNodes.spatialWetGain) {
        this.liveNodes.spatialWetGain.gain.setTargetAtTime(p.spatial * 0.35, this.ctx!.currentTime, 0.05);
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
      if (key === 'spatial' && this.liveNodes.spatialWetGain) {
        this.liveNodes.spatialWetGain.gain.setTargetAtTime(p.spatial * 0.35, this.ctx!.currentTime, 0.05);
      }
    }

    // Slowed-reverb spatial
    if (mode === 'slowed-reverb' && this.currentMode === 'slowed-reverb') {
      if (key === 'spatial' && this.liveNodes.spatialWetGain) {
        const p = this.params['slowed-reverb'];
        this.liveNodes.spatialWetGain.gain.setTargetAtTime(p.spatial * 0.35, this.ctx!.currentTime, 0.05);
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

    // Spatial processing
    const spatial = buildSpatialChain(ctx, p.spatial);
    this.liveNodes.spatialWetGain = spatial.wetGain;
    comp.connect(spatial.input);

    this.chainNodes = [inputGain, spatial.output];
  }

  /**
   * Remix — hall reverb echo + punchy bass + instrument enhancement.
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

    // Body/instrument enhancement around 200Hz
    const bodyBoost = ctx.createBiquadFilter();
    bodyBoost.type = 'peaking'; bodyBoost.frequency.value = 200;
    bodyBoost.gain.value = 2; bodyBoost.Q.value = 1.0;

    // Clean up muddy region
    const mudCut = ctx.createBiquadFilter();
    mudCut.type = 'peaking'; mudCut.frequency.value = 400;
    mudCut.gain.value = -1.5; mudCut.Q.value = 1.2;

    // Instrument/vocal presence
    const presenceBoost = ctx.createBiquadFilter();
    presenceBoost.type = 'peaking'; presenceBoost.frequency.value = 3000;
    presenceBoost.gain.value = p.presence * 4; presenceBoost.Q.value = 1.0;
    this.liveNodes.presenceBoost = presenceBoost;

    // Air shelf
    const airShelf = ctx.createBiquadFilter();
    airShelf.type = 'highshelf'; airShelf.frequency.value = 10000;
    airShelf.gain.value = 2;

    // === Hall Reverb (convolver) ===
    const hallConvolver = ctx.createConvolver();
    hallConvolver.buffer = generateHallIR(ctx.sampleRate);

    // Pre-filter: cut lows from reverb send to keep bass clean
    const hallPreHP = ctx.createBiquadFilter();
    hallPreHP.type = 'highpass'; hallPreHP.frequency.value = 300; hallPreHP.Q.value = 0.5;

    // Post-filter: darken reverb tail for warmth
    const hallPostLP = ctx.createBiquadFilter();
    hallPostLP.type = 'lowpass'; hallPostLP.frequency.value = 8000; hallPostLP.Q.value = 0.5;

    const hallWetGain = ctx.createGain();
    hallWetGain.gain.value = p.hall * 0.45;
    this.liveNodes.hallWetGain = hallWetGain;

    // Dry path
    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.75;

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

    // Gentle console saturation
    const consoleSat = ctx.createWaveShaper();
    consoleSat.curve = createSaturationCurve(0.12) as Float32Array<ArrayBuffer>;
    consoleSat.oversample = '4x';

    // Transparent limiter
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.5; limiter.knee.value = 0.5;
    limiter.ratio.value = 20; limiter.attack.value = 0.0005;
    limiter.release.value = 0.05;

    // === Routing ===
    // EQ chain
    inputGain.connect(subCut);
    subCut.connect(bassShelf);
    bassShelf.connect(bodyBoost);
    bodyBoost.connect(mudCut);
    mudCut.connect(presenceBoost);
    presenceBoost.connect(airShelf);

    // Dry path → mix
    airShelf.connect(dryGain);
    dryGain.connect(mixBus);

    // Hall reverb send → mix
    airShelf.connect(hallPreHP);
    hallPreHP.connect(hallConvolver);
    hallConvolver.connect(hallPostLP);
    hallPostLP.connect(hallWetGain);
    hallWetGain.connect(mixBus);

    // Parallel compression → mix
    airShelf.connect(parallelComp);
    parallelComp.connect(parallelCompGain);
    parallelCompGain.connect(mixBus);

    // Master chain
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

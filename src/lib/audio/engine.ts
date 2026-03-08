/**
 * Real-time Web Audio API engine with mode switching and adjustable parameters.
 */
import { createSaturationCurve, createSoftClipCurve } from './dsp-utils';

export type PlaybackMode = 'slowed-reverb' | 'hard-bass' | 'lofi' | null;

export interface ModeParams {
  'slowed-reverb': { speed: number; reverbMix: number; reverbDecay: number };
  'hard-bass': { bassBoost: number; saturation: number; punch: number };
  'lofi': { warmth: number; crackle: number; wobble: number };
}

export const defaultParams: ModeParams = {
  'slowed-reverb': { speed: 0.85, reverbMix: 0.6, reverbDecay: 4 },
  'hard-bass': { bassBoost: 0.75, saturation: 0.7, punch: 0.6 },
  'lofi': { warmth: 0.6, crackle: 0.5, wobble: 0.5 },
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
      prev = (prev + (Math.random() * 2 - 1) * 0.05) * 0.98;
      data[i] = prev;
      if (Math.random() < 0.0003) {
        const bl = Math.floor(Math.random() * 6 + 2);
        const amp = Math.random() * 0.5 + 0.2;
        for (let j = 0; j < bl && i + j < length; j++) data[i + j] += (Math.random() * 2 - 1) * amp * (1 - j / bl);
      }
      if (Math.random() < 0.00005) data[i] += (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 0.4 + 0.2);
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

  // Current params
  private params: ModeParams = JSON.parse(JSON.stringify(defaultParams));

  // Live-adjustable node references
  private liveNodes: {
    // slowed-reverb
    dryGain?: GainNode;
    wetGain?: GainNode;
    // hard-bass
    bassGain?: GainNode;
    bassSaturator?: WaveShaperNode;
    punchGain?: GainNode;
    punchBoost?: BiquadFilterNode;
    // lofi
    noiseGain?: GainNode;
    midBoost?: BiquadFilterNode;
    lfoGain?: GainNode;
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
  getIsPlaying(): boolean { return this.isPlaying; }
  getMode(): PlaybackMode { return this.currentMode; }
  getParams(): ModeParams { return this.params; }

  getDuration(): number {
    if (!this.audioBuffer) return 0;
    const rate = this.currentMode === 'slowed-reverb' ? this.params['slowed-reverb'].speed : 1;
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

  /** Update a single parameter in real-time without rebuilding the chain */
  updateParam<M extends keyof ModeParams>(mode: M, key: keyof ModeParams[M], value: number) {
    (this.params[mode] as any)[key] = value;

    // Apply live updates to running nodes
    if (mode === 'slowed-reverb' && this.currentMode === 'slowed-reverb') {
      const p = this.params['slowed-reverb'];
      if (key === 'speed' && this.sourceNode) {
        this.sourceNode.playbackRate.setTargetAtTime(p.speed, this.ctx!.currentTime, 0.05);
      }
      if (key === 'reverbMix') {
        this.liveNodes.dryGain?.gain.setTargetAtTime(1 - p.reverbMix * 0.6, this.ctx!.currentTime, 0.05);
        this.liveNodes.wetGain?.gain.setTargetAtTime(p.reverbMix, this.ctx!.currentTime, 0.05);
      }
    }

    if (mode === 'hard-bass' && this.currentMode === 'hard-bass') {
      const p = this.params['hard-bass'];
      if (key === 'bassBoost' && this.liveNodes.bassGain) {
        this.liveNodes.bassGain.gain.setTargetAtTime(1 + p.bassBoost * 5, this.ctx!.currentTime, 0.05);
      }
      if (key === 'saturation' && this.liveNodes.bassSaturator) {
        this.liveNodes.bassSaturator.curve = createSaturationCurve(p.saturation) as Float32Array<ArrayBuffer>;
      }
      if (key === 'punch' && this.liveNodes.punchGain) {
        this.liveNodes.punchGain.gain.setTargetAtTime(p.punch, this.ctx!.currentTime, 0.05);
      }
    }

    if (mode === 'lofi' && this.currentMode === 'lofi') {
      const p = this.params['lofi'];
      if (key === 'warmth' && this.liveNodes.midBoost) {
        this.liveNodes.midBoost.gain.setTargetAtTime(p.warmth * 6, this.ctx!.currentTime, 0.05);
      }
      if (key === 'crackle' && this.liveNodes.noiseGain) {
        this.liveNodes.noiseGain.gain.setTargetAtTime(p.crackle * 0.08, this.ctx!.currentTime, 0.05);
      }
      if (key === 'wobble' && this.liveNodes.lfoGain) {
        this.liveNodes.lfoGain.gain.setTargetAtTime(p.wobble * 0.006, this.ctx!.currentTime, 0.05);
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

    if (this.currentMode === 'slowed-reverb') {
      this.sourceNode.playbackRate.value = this.params['slowed-reverb'].speed;
    }

    const firstNode = this.chainNodes.length > 0 ? this.chainNodes[0] : this.analyser!;
    this.sourceNode.connect(firstNode);
    this.sourceNode.onended = () => {
      if (this.isPlaying) { this.isPlaying = false; this.pausedAt = 0; this.emitState(); }
    };

    const rate = this.currentMode === 'slowed-reverb' ? this.params['slowed-reverb'].speed : 1;
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
      case 'hard-bass': this.buildHardBassChain(); break;
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
    dryGain.gain.value = 1 - p.reverbMix * 0.6;
    const wetGain = ctx.createGain();
    wetGain.gain.value = p.reverbMix;

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

  private buildHardBassChain() {
    const ctx = this.ctx!;
    const p = this.params['hard-bass'];

    const inputGain = ctx.createGain();
    inputGain.gain.value = 1.0;

    const subLP = ctx.createBiquadFilter();
    subLP.type = 'lowpass'; subLP.frequency.value = 80; subLP.Q.value = 0.8;

    const bassSaturator = ctx.createWaveShaper();
    bassSaturator.curve = createSaturationCurve(p.saturation) as Float32Array<ArrayBuffer>;
    bassSaturator.oversample = '4x';
    this.liveNodes.bassSaturator = bassSaturator;

    const bassGain = ctx.createGain();
    bassGain.gain.value = 1 + p.bassBoost * 5;
    this.liveNodes.bassGain = bassGain;

    const punchBP = ctx.createBiquadFilter();
    punchBP.type = 'bandpass'; punchBP.frequency.value = 100; punchBP.Q.value = 1.0;

    const punchBoost = ctx.createBiquadFilter();
    punchBoost.type = 'peaking'; punchBoost.frequency.value = 85;
    punchBoost.gain.value = 8; punchBoost.Q.value = 1.5;
    this.liveNodes.punchBoost = punchBoost;

    const punchSat = ctx.createWaveShaper();
    punchSat.curve = createSaturationCurve(0.8) as Float32Array<ArrayBuffer>;
    punchSat.oversample = '4x';

    const punchGain = ctx.createGain();
    punchGain.gain.value = p.punch;
    this.liveNodes.punchGain = punchGain;

    const clickBoost = ctx.createBiquadFilter();
    clickBoost.type = 'peaking'; clickBoost.frequency.value = 2500;
    clickBoost.gain.value = 3; clickBoost.Q.value = 2.0;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.65;

    const mixBus = ctx.createGain();
    mixBus.gain.value = 1.0;

    const masterSat = ctx.createWaveShaper();
    masterSat.curve = createSaturationCurve(0.15) as Float32Array<ArrayBuffer>;
    masterSat.oversample = '2x';

    const softClip = ctx.createWaveShaper();
    softClip.curve = createSoftClipCurve() as Float32Array<ArrayBuffer>;
    softClip.oversample = '4x';

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8; comp.knee.value = 4; comp.ratio.value = 6;
    comp.attack.value = 0.002; comp.release.value = 0.12;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.001; limiter.release.value = 0.05;

    const subCut = ctx.createBiquadFilter();
    subCut.type = 'highpass'; subCut.frequency.value = 25; subCut.Q.value = 0.5;

    inputGain.connect(clickBoost); clickBoost.connect(dryGain); dryGain.connect(mixBus);
    inputGain.connect(subLP); subLP.connect(bassSaturator); bassSaturator.connect(bassGain); bassGain.connect(mixBus);
    inputGain.connect(punchBP); punchBP.connect(punchBoost); punchBoost.connect(punchSat); punchSat.connect(punchGain); punchGain.connect(mixBus);
    mixBus.connect(masterSat); masterSat.connect(softClip); softClip.connect(comp); comp.connect(subCut); subCut.connect(limiter);

    this.chainNodes = [inputGain, limiter];
  }

  private buildLoFiChain() {
    const ctx = this.ctx!;
    const p = this.params['lofi'];

    const inputGain = ctx.createGain();
    inputGain.gain.value = 1.0;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 300; hp.Q.value = 0.5;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 6000; lp.Q.value = 0.5;

    const midBoost = ctx.createBiquadFilter();
    midBoost.type = 'peaking'; midBoost.frequency.value = 700;
    midBoost.gain.value = p.warmth * 6; midBoost.Q.value = 1.2;
    this.liveNodes.midBoost = midBoost;

    const sat = ctx.createWaveShaper();
    sat.curve = createSaturationCurve(0.3) as Float32Array<ArrayBuffer>;
    sat.oversample = '4x';

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -15; comp.knee.value = 12; comp.ratio.value = 2.5;
    comp.attack.value = 0.02; comp.release.value = 0.3;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.85;

    const delay = ctx.createDelay(0.1);
    delay.delayTime.value = 0.005;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = p.wobble * 0.006;
    lfo.connect(lfoGain); lfoGain.connect(delay.delayTime);
    lfo.start();
    this.lfoNode = lfo;
    this.liveNodes.lfoGain = lfoGain;

    if (this.audioBuffer) {
      const noiseBuf = createVinylNoiseBuffer(ctx.sampleRate, this.audioBuffer.duration + 10);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuf; noiseSource.loop = true;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = p.crackle * 0.08;
      this.liveNodes.noiseGain = noiseGain;
      const noiseLP = ctx.createBiquadFilter();
      noiseLP.type = 'lowpass'; noiseLP.frequency.value = 5000; noiseLP.Q.value = 0.5;
      noiseSource.connect(noiseLP); noiseLP.connect(noiseGain); noiseGain.connect(masterGain);
      noiseSource.start();
      this.noiseSource = noiseSource;
    }

    inputGain.connect(hp); hp.connect(lp); lp.connect(midBoost);
    midBoost.connect(delay); delay.connect(sat); sat.connect(comp); comp.connect(masterGain);

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

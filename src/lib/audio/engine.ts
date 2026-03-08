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
  'hard-bass': { bassBoost: 0.5, saturation: 0.4, punch: 0.5 },
  'lofi': { warmth: 0.5, crackle: 0.3, wobble: 0.35 },
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
      // Very gentle brownian noise for smooth vinyl texture
      prev = (prev + (Math.random() * 2 - 1) * 0.02) * 0.995;
      data[i] = prev;
      // Occasional subtle crackle (much rarer and quieter)
      if (Math.random() < 0.00008) {
        const bl = Math.floor(Math.random() * 4 + 2);
        const amp = Math.random() * 0.15 + 0.05;
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
    bassGain?: GainNode;
    bassSaturator?: WaveShaperNode;
    punchGain?: GainNode;
    punchBoost?: BiquadFilterNode;
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

    if (mode === 'hard-bass' && this.currentMode === 'hard-bass') {
      const p = this.params['hard-bass'];
      if (key === 'bassBoost' && this.liveNodes.bassGain) {
        // Gentle range: 0dB to +8dB (1.0 to 2.5)
        this.liveNodes.bassGain.gain.setTargetAtTime(1 + p.bassBoost * 1.5, this.ctx!.currentTime, 0.05);
      }
      if (key === 'saturation' && this.liveNodes.bassSaturator) {
        this.liveNodes.bassSaturator.curve = createSaturationCurve(p.saturation * 0.6) as Float32Array<ArrayBuffer>;
      }
      if (key === 'punch' && this.liveNodes.punchGain) {
        this.liveNodes.punchGain.gain.setTargetAtTime(p.punch * 0.4, this.ctx!.currentTime, 0.05);
      }
    }

    if (mode === 'lofi' && this.currentMode === 'lofi') {
      const p = this.params['lofi'];
      if (key === 'warmth' && this.liveNodes.midBoost) {
        this.liveNodes.midBoost.gain.setTargetAtTime(p.warmth * 4, this.ctx!.currentTime, 0.05);
      }
      if (key === 'crackle' && this.liveNodes.noiseGain) {
        this.liveNodes.noiseGain.gain.setTargetAtTime(p.crackle * 0.025, this.ctx!.currentTime, 0.05);
      }
      if (key === 'wobble' && this.liveNodes.lfoGain) {
        this.liveNodes.lfoGain.gain.setTargetAtTime(p.wobble * 0.003, this.ctx!.currentTime, 0.05);
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
   * Hard Bass — clean, deep, punchy bass enhancement.
   * Key fixes: much lower gain staging, gentler saturation, proper gain structure.
   */
  private buildHardBassChain() {
    const ctx = this.ctx!;
    const p = this.params['hard-bass'];

    const inputGain = ctx.createGain();
    inputGain.gain.value = 1.0;

    // === Sub-bass path (20–80Hz) — clean boost, gentle saturation ===
    const subLP = ctx.createBiquadFilter();
    subLP.type = 'lowpass'; subLP.frequency.value = 80; subLP.Q.value = 0.7;

    // Gentle warm saturation on sub — NOT aggressive distortion
    const bassSaturator = ctx.createWaveShaper();
    bassSaturator.curve = createSaturationCurve(p.saturation * 0.6) as Float32Array<ArrayBuffer>;
    bassSaturator.oversample = '4x';
    this.liveNodes.bassSaturator = bassSaturator;

    // Bass gain: 0dB to +8dB max (1.0 to 2.5) — NOT +15dB
    const bassGain = ctx.createGain();
    bassGain.gain.value = 1 + p.bassBoost * 1.5;
    this.liveNodes.bassGain = bassGain;

    // === Punch/body path (60–200Hz) — adds weight and knock ===
    const punchBP = ctx.createBiquadFilter();
    punchBP.type = 'bandpass'; punchBP.frequency.value = 120; punchBP.Q.value = 0.8;

    // Gentle peaking EQ, not extreme
    const punchBoost = ctx.createBiquadFilter();
    punchBoost.type = 'peaking'; punchBoost.frequency.value = 90;
    punchBoost.gain.value = 4; punchBoost.Q.value = 1.2;
    this.liveNodes.punchBoost = punchBoost;

    const punchGain = ctx.createGain();
    punchGain.gain.value = p.punch * 0.4;
    this.liveNodes.punchGain = punchGain;

    // === Dry/presence path — keep mids and highs clean ===
    const presenceBoost = ctx.createBiquadFilter();
    presenceBoost.type = 'peaking'; presenceBoost.frequency.value = 3000;
    presenceBoost.gain.value = 1.5; presenceBoost.Q.value = 1.5;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.75; // Keep dry signal dominant

    // === Mix bus ===
    const mixBus = ctx.createGain();
    mixBus.gain.value = 0.8; // Headroom before master processing

    // === Master chain: gentle glue compression + transparent limiter ===
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 3;
    comp.attack.value = 0.005; comp.release.value = 0.15;

    // Soft clipper for safety — NOT aggressive waveshaping
    const softClip = ctx.createWaveShaper();
    softClip.curve = createSoftClipCurve() as Float32Array<ArrayBuffer>;
    softClip.oversample = '2x';

    // Transparent limiter
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 2; limiter.ratio.value = 12;
    limiter.attack.value = 0.001; limiter.release.value = 0.08;

    // Sub cut to save headroom on inaudible content
    const subCut = ctx.createBiquadFilter();
    subCut.type = 'highpass'; subCut.frequency.value = 25; subCut.Q.value = 0.5;

    // === Routing ===
    // Dry path (clean mids/highs with presence)
    inputGain.connect(presenceBoost);
    presenceBoost.connect(dryGain);
    dryGain.connect(mixBus);

    // Sub-bass path (warm saturated lows)
    inputGain.connect(subLP);
    subLP.connect(bassSaturator);
    bassSaturator.connect(bassGain);
    bassGain.connect(mixBus);

    // Punch path (body/knock)
    inputGain.connect(punchBP);
    punchBP.connect(punchBoost);
    punchBoost.connect(punchGain);
    punchGain.connect(mixBus);

    // Master processing
    mixBus.connect(comp);
    comp.connect(softClip);
    softClip.connect(subCut);
    subCut.connect(limiter);

    this.chainNodes = [inputGain, limiter];
  }

  /**
   * Lo-Fi — warm, nostalgic vintage sound.
   * Key fixes: wider bandwidth (not telephone), very subtle noise/wobble, musical saturation.
   */
  private buildLoFiChain() {
    const ctx = this.ctx!;
    const p = this.params['lofi'];

    const inputGain = ctx.createGain();
    inputGain.gain.value = 1.0;

    // === Vintage frequency shaping — NOT telephone narrow ===
    // Gentle roll-off, much wider than before
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 80; hp.Q.value = 0.5;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 12000; lp.Q.value = 0.5;

    // Second lowpass for gentle HF roll-off (vintage character)
    const lp2 = ctx.createBiquadFilter();
    lp2.type = 'lowpass'; lp2.frequency.value = 10000; lp2.Q.value = 0.5;

    // Warm mid-range presence
    const midBoost = ctx.createBiquadFilter();
    midBoost.type = 'peaking'; midBoost.frequency.value = 800;
    midBoost.gain.value = p.warmth * 4; midBoost.Q.value = 0.8;
    this.liveNodes.midBoost = midBoost;

    // Slight high-mid dip (tape head loss character)
    const hiMidCut = ctx.createBiquadFilter();
    hiMidCut.type = 'peaking'; hiMidCut.frequency.value = 4500;
    hiMidCut.gain.value = -1.5; hiMidCut.Q.value = 0.8;

    // === Gentle tape saturation ===
    const sat = ctx.createWaveShaper();
    sat.curve = createSaturationCurve(0.2) as Float32Array<ArrayBuffer>;
    sat.oversample = '4x';

    // === Very subtle wow & flutter via modulated delay ===
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = 0.003;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.4;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = p.wobble * 0.003; // Very subtle — was 0.006
    lfo.connect(lfoGain); lfoGain.connect(delay.delayTime);
    lfo.start();
    this.lfoNode = lfo;
    this.liveNodes.lfoGain = lfoGain;

    // === Gentle glue compression ===
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 15; comp.ratio.value = 2;
    comp.attack.value = 0.03; comp.release.value = 0.3;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.92;

    // === Vinyl noise — very quiet background texture ===
    if (this.audioBuffer) {
      const noiseBuf = createVinylNoiseBuffer(ctx.sampleRate, this.audioBuffer.duration + 10);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuf; noiseSource.loop = true;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = p.crackle * 0.025; // Much quieter — was 0.08
      this.liveNodes.noiseGain = noiseGain;

      // Filter noise to be warm, not harsh
      const noiseLP = ctx.createBiquadFilter();
      noiseLP.type = 'lowpass'; noiseLP.frequency.value = 3000; noiseLP.Q.value = 0.5;
      const noiseHP = ctx.createBiquadFilter();
      noiseHP.type = 'highpass'; noiseHP.frequency.value = 200; noiseHP.Q.value = 0.5;

      noiseSource.connect(noiseHP); noiseHP.connect(noiseLP);
      noiseLP.connect(noiseGain); noiseGain.connect(masterGain);
      noiseSource.start();
      this.noiseSource = noiseSource;
    }

    // === Signal chain ===
    inputGain.connect(hp);
    hp.connect(lp);
    lp.connect(lp2);
    lp2.connect(midBoost);
    midBoost.connect(hiMidCut);
    hiMidCut.connect(delay);
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

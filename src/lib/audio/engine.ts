/**
 * Real-time Web Audio API engine with mode switching.
 * Routes audio through different DSP chains based on the active mode.
 */
import { createSaturationCurve, createSoftClipCurve } from './dsp-utils';

export type PlaybackMode = 'slowed-reverb' | 'hard-bass' | 'lofi' | null;

export interface EngineState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  mode: PlaybackMode;
}

/**
 * Generate an impulse response for convolution reverb.
 */
function generateReverbIR(sampleRate: number, duration: number): AudioBuffer {
  const length = Math.ceil(sampleRate * duration);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const ir = ctx.createBuffer(2, length, sampleRate);

  const earlyTaps = [
    { time: 0.012, gain: 0.7 },
    { time: 0.019, gain: 0.55 },
    { time: 0.026, gain: 0.48 },
    { time: 0.035, gain: 0.4 },
    { time: 0.046, gain: 0.33 },
    { time: 0.058, gain: 0.27 },
    { time: 0.073, gain: 0.2 },
    { time: 0.091, gain: 0.15 },
    { time: 0.112, gain: 0.1 },
  ];

  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let seed = ch === 0 ? 12345 : 67890;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed / 0x7fffffff) * 2 - 1;
    };

    for (const tap of earlyTaps) {
      const idx = Math.floor(tap.time * sampleRate) + (ch * Math.floor(0.003 * sampleRate));
      if (idx < length) data[idx] += tap.gain * (0.85 + rand() * 0.15);
    }

    const decayRate = 2.2 / duration;
    for (let i = Math.floor(0.08 * sampleRate); i < length; i++) {
      const t = i / sampleRate;
      const decay = 0.6 * Math.exp(-t * decayRate * 1.8) + 0.4 * Math.exp(-t * decayRate * 0.7);
      const hfDamp = Math.exp(-t * 1.5);
      const noise = rand() * hfDamp + rand() * (1 - hfDamp) * 0.3;
      data[i] += noise * decay * 0.16;
    }
  }
  return ir;
}

/**
 * Create vinyl crackle noise buffer.
 */
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
        const burstLen = Math.floor(Math.random() * 6 + 2);
        const amp = Math.random() * 0.5 + 0.2;
        for (let j = 0; j < burstLen && i + j < length; j++) {
          data[i + j] += (Math.random() * 2 - 1) * amp * (1 - j / burstLen);
        }
      }
      if (Math.random() < 0.00005) {
        data[i] += (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 0.4 + 0.2);
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

  // DSP chain nodes (created per-mode)
  private chainNodes: AudioNode[] = [];
  // Noise source for lo-fi
  private noiseSource: AudioBufferSourceNode | null = null;
  // LFO for lo-fi wow
  private lfoNode: OscillatorNode | null = null;

  async loadFile(file: File): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    const arrayBuffer = await file.arrayBuffer();
    this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.pausedAt = 0;
    this.emitState();
  }

  setOnStateChange(cb: (state: EngineState) => void) {
    this.onStateChange = cb;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  getDuration(): number {
    if (!this.audioBuffer) return 0;
    const rate = this.currentMode === 'slowed-reverb' ? 0.85 : 1;
    return this.audioBuffer.duration / rate;
  }

  getCurrentTime(): number {
    if (!this.ctx || !this.isPlaying) return this.pausedAt;
    return this.pausedAt + (this.ctx.currentTime - this.startedAt);
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getMode(): PlaybackMode {
    return this.currentMode;
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

  play() {
    if (!this.ctx || !this.audioBuffer) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.stopSource();
    this.buildChain();

    this.sourceNode = this.ctx.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;

    // Apply playback rate for slowed-reverb
    if (this.currentMode === 'slowed-reverb') {
      this.sourceNode.playbackRate.value = 0.85;
    }

    // Connect source → chain → analyser → destination
    const firstNode = this.chainNodes.length > 0 ? this.chainNodes[0] : this.analyser!;
    this.sourceNode.connect(firstNode);

    this.sourceNode.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.pausedAt = 0;
        this.emitState();
      }
    };

    // Calculate offset in original buffer time
    const rate = this.currentMode === 'slowed-reverb' ? 0.85 : 1;
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

    // Use the offline processing pipeline for highest quality export
    const { processAudio } = await import('./index');
    const mode = this.currentMode || 'slowed-reverb';
    
    // Create a fake File from the buffer for processing
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

    // Clean up old chain
    this.chainNodes.forEach(n => n.disconnect());
    this.chainNodes = [];
    if (this.noiseSource) { try { this.noiseSource.stop(); } catch {} this.noiseSource = null; }
    if (this.lfoNode) { try { this.lfoNode.stop(); } catch {} this.lfoNode = null; }
    if (this.analyser) this.analyser.disconnect();
    if (this.gainNode) this.gainNode.disconnect();

    // Create analyser
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    // Master gain
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 0.9;

    switch (this.currentMode) {
      case 'slowed-reverb':
        this.buildSlowedReverbChain();
        break;
      case 'hard-bass':
        this.buildHardBassChain();
        break;
      case 'lofi':
        this.buildLoFiChain();
        break;
      default:
        // Bypass — straight to analyser
        break;
    }

    // Final connection: last chain node → analyser → gain → destination
    const lastChain = this.chainNodes.length > 0 ? this.chainNodes[this.chainNodes.length - 1] : null;
    if (lastChain) {
      lastChain.connect(this.analyser);
    }
    // If no chain, source connects directly to analyser (handled in play())
    this.analyser.connect(this.gainNode);
    this.gainNode.connect(this.ctx.destination);
  }

  private buildSlowedReverbChain() {
    const ctx = this.ctx!;

    // Highpass to clean up before reverb
    const preHP = ctx.createBiquadFilter();
    preHP.type = 'highpass';
    preHP.frequency.value = 250;
    preHP.Q.value = 0.5;

    // Convolution reverb
    const convolver = ctx.createConvolver();
    convolver.buffer = generateReverbIR(ctx.sampleRate, 4);

    // Post reverb lowpass
    const postLP = ctx.createBiquadFilter();
    postLP.type = 'lowpass';
    postLP.frequency.value = 12000;
    postLP.Q.value = 0.5;

    // Wet/dry
    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.5;
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.6;

    const mixBus = ctx.createGain();
    mixBus.gain.value = 1.0;

    // Compressor
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8;
    comp.knee.value = 8;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;

    // Chain: source → [dry → mix], [hp → convolver → lp → wet → mix] → comp
    // We expose the first node for source connection and last for analyser
    // Build as parallel dry/wet merge

    // Create a splitter node (the first chain node that source connects to)
    const inputGain = ctx.createGain();
    inputGain.gain.value = 1.0;

    // Dry path
    inputGain.connect(dryGain);
    dryGain.connect(mixBus);

    // Wet path
    inputGain.connect(preHP);
    preHP.connect(convolver);
    convolver.connect(postLP);
    postLP.connect(wetGain);
    wetGain.connect(mixBus);

    mixBus.connect(comp);

    this.chainNodes = [inputGain, comp]; // first = input, last = output
    // Intermediate nodes will be disconnected via inputGain disconnect cascade
  }

  private buildHardBassChain() {
    const ctx = this.ctx!;

    const inputGain = ctx.createGain();
    inputGain.gain.value = 1.0;

    // Sub-bass isolation
    const subLP = ctx.createBiquadFilter();
    subLP.type = 'lowpass';
    subLP.frequency.value = 80;
    subLP.Q.value = 0.8;

    // Bass saturation
    const bassSaturator = ctx.createWaveShaper();
    bassSaturator.curve = createSaturationCurve(0.7) as Float32Array<ArrayBuffer>;
    bassSaturator.oversample = '4x';

    // Bass gain (+12dB)
    const bassGain = ctx.createGain();
    bassGain.gain.value = 4.0; // ~12dB

    // Punch band
    const punchBP = ctx.createBiquadFilter();
    punchBP.type = 'bandpass';
    punchBP.frequency.value = 100;
    punchBP.Q.value = 1.0;

    const punchBoost = ctx.createBiquadFilter();
    punchBoost.type = 'peaking';
    punchBoost.frequency.value = 85;
    punchBoost.gain.value = 8;
    punchBoost.Q.value = 1.5;

    const punchSat = ctx.createWaveShaper();
    punchSat.curve = createSaturationCurve(0.8) as Float32Array<ArrayBuffer>;
    punchSat.oversample = '4x';

    const punchGain = ctx.createGain();
    punchGain.gain.value = 0.5;

    // Dry/click path
    const clickBoost = ctx.createBiquadFilter();
    clickBoost.type = 'peaking';
    clickBoost.frequency.value = 2500;
    clickBoost.gain.value = 3;
    clickBoost.Q.value = 2.0;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.65;

    // Mix bus
    const mixBus = ctx.createGain();
    mixBus.gain.value = 1.0;

    // Master saturation + compressor + limiter
    const masterSat = ctx.createWaveShaper();
    masterSat.curve = createSaturationCurve(0.15) as Float32Array<ArrayBuffer>;
    masterSat.oversample = '2x';

    const softClip = ctx.createWaveShaper();
    softClip.curve = createSoftClipCurve() as Float32Array<ArrayBuffer>;
    softClip.oversample = '4x';

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8;
    comp.knee.value = 4;
    comp.ratio.value = 6;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.05;

    // Sub cut
    const subCut = ctx.createBiquadFilter();
    subCut.type = 'highpass';
    subCut.frequency.value = 25;
    subCut.Q.value = 0.5;

    // Routing
    // Dry path
    inputGain.connect(clickBoost);
    clickBoost.connect(dryGain);
    dryGain.connect(mixBus);

    // Sub path
    inputGain.connect(subLP);
    subLP.connect(bassSaturator);
    bassSaturator.connect(bassGain);
    bassGain.connect(mixBus);

    // Punch path
    inputGain.connect(punchBP);
    punchBP.connect(punchBoost);
    punchBoost.connect(punchSat);
    punchSat.connect(punchGain);
    punchGain.connect(mixBus);

    // Master
    mixBus.connect(masterSat);
    masterSat.connect(softClip);
    softClip.connect(comp);
    comp.connect(subCut);
    subCut.connect(limiter);

    this.chainNodes = [inputGain, limiter];
  }

  private buildLoFiChain() {
    const ctx = this.ctx!;

    const inputGain = ctx.createGain();
    inputGain.gain.value = 1.0;

    // Telephone EQ
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 300;
    hp.Q.value = 0.5;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 6000;
    lp.Q.value = 0.5;

    // Mid warmth
    const midBoost = ctx.createBiquadFilter();
    midBoost.type = 'peaking';
    midBoost.frequency.value = 700;
    midBoost.gain.value = 3.5;
    midBoost.Q.value = 1.2;

    // Tape saturation
    const sat = ctx.createWaveShaper();
    sat.curve = createSaturationCurve(0.3) as Float32Array<ArrayBuffer>;
    sat.oversample = '4x';

    // Compression
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -15;
    comp.knee.value = 12;
    comp.ratio.value = 2.5;
    comp.attack.value = 0.02;
    comp.release.value = 0.3;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.85;

    // LFO for wow/flutter on playback rate — we modulate a delay instead
    // since we can't modulate playbackRate of a BufferSource with an LFO easily
    // Use a delay node modulated by LFO for pitch wobble effect
    const delay = ctx.createDelay(0.1);
    delay.delayTime.value = 0.005;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.003; // subtle pitch wobble
    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    lfo.start();
    this.lfoNode = lfo;

    // Vinyl noise
    if (this.audioBuffer) {
      const noiseBuf = createVinylNoiseBuffer(ctx.sampleRate, this.audioBuffer.duration + 10);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuf;
      noiseSource.loop = true;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.03;
      const noiseLP = ctx.createBiquadFilter();
      noiseLP.type = 'lowpass';
      noiseLP.frequency.value = 5000;
      noiseLP.Q.value = 0.5;

      noiseSource.connect(noiseLP);
      noiseLP.connect(noiseGain);
      noiseGain.connect(masterGain);
      noiseSource.start();
      this.noiseSource = noiseSource;
    }

    // Signal chain
    inputGain.connect(hp);
    hp.connect(lp);
    lp.connect(midBoost);
    midBoost.connect(delay);
    delay.connect(sat);
    sat.connect(comp);
    comp.connect(masterGain);

    this.chainNodes = [inputGain, masterGain];
  }

  private stopSource() {
    if (this.sourceNode) {
      try { this.sourceNode.stop(); } catch {}
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.noiseSource) {
      try { this.noiseSource.stop(); } catch {}
      this.noiseSource = null;
    }
    if (this.lfoNode) {
      try { this.lfoNode.stop(); } catch {}
      this.lfoNode = null;
    }
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

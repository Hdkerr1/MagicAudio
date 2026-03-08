import { hermiteInterpolate } from '../dsp-utils';
import type { ProgressCallback } from '../types';
import type { AudioAnalysis } from '../analyze';

/**
 * Soft noise gate envelope — reduces background noise while preserving transients.
 */
function computeNoiseGateEnvelope(buffer: AudioBuffer, thresholdDb: number): Float32Array {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const env = new Float32Array(buffer.length);
  const threshold = Math.pow(10, thresholdDb / 20);
  const attackCoeff = Math.exp(-1 / (sr * 0.0005));
  const releaseCoeff = Math.exp(-1 / (sr * 0.05));
  let level = 0;
  let gateGain = 1;

  for (let i = 0; i < buffer.length; i++) {
    const abs = Math.abs(data[i]);
    level = abs > level ? abs + (level - abs) * 0.999 : level * 0.9999;
    gateGain = level > threshold
      ? 1 - (1 - gateGain) * attackCoeff
      : gateGain * releaseCoeff;
    env[i] = Math.max(0.02, gateGain);
  }
  return env;
}

/**
 * Apply noise gate to buffer, returning a clean copy.
 */
function applyNoiseGate(buffer: AudioBuffer, ctx: OfflineAudioContext, thresholdDb: number): AudioBuffer {
  const gateEnv = computeNoiseGateEnvelope(buffer, thresholdDb);
  const clean = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = clean.getChannelData(ch);
    for (let i = 0; i < buffer.length; i++) {
      dst[i] = src[i] * gateEnv[i];
    }
  }
  return clean;
}

/**
 * High-quality algorithmic reverb IR with BPM-synced tail.
 */
function generateReverbIR(sampleRate: number, duration: number): AudioBuffer {
  const length = Math.ceil(sampleRate * duration);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const ir = ctx.createBuffer(2, length, sampleRate);

  const earlyTaps = [
    { time: 0.011, gain: 0.7 },  { time: 0.017, gain: 0.55 },
    { time: 0.023, gain: 0.5 },  { time: 0.031, gain: 0.4 },
    { time: 0.041, gain: 0.35 }, { time: 0.053, gain: 0.3 },
    { time: 0.067, gain: 0.22 }, { time: 0.083, gain: 0.18 },
    { time: 0.097, gain: 0.14 }, { time: 0.113, gain: 0.1 },
  ];

  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let seed = ch === 0 ? 12345 : 67890;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };

    for (const tap of earlyTaps) {
      const offset = ch * Math.floor(0.003 * sampleRate);
      const pos = Math.floor(tap.time * sampleRate) + offset;
      if (pos < length) data[pos] += tap.gain * (0.8 + rand() * 0.2);
    }

    const decayRate = 2.2 / duration;
    for (let i = Math.floor(0.08 * sampleRate); i < length; i++) {
      const t = i / sampleRate;
      const decay = 0.6 * Math.exp(-t * decayRate * 1.8) + 0.4 * Math.exp(-t * decayRate * 0.7);
      const hfDamp = Math.exp(-t * 1.5);
      const noise = rand() * hfDamp + rand() * (1 - hfDamp) * 0.3;
      data[i] += noise * decay * 0.18;
    }
  }
  return ir;
}

export async function processSlowedReverb(
  buffer: AudioBuffer,
  onProgress: ProgressCallback,
  analysis?: AudioAnalysis
): Promise<AudioBuffer> {
  onProgress({ stage: 'Analyzing & cleaning audio...', percent: 5 });

  const bpm = analysis?.bpm ?? 120;
  const bassRatio = analysis?.bassRatio ?? 0.3;
  const brightness = analysis?.brightness ?? 0.3;
  const energy = analysis?.energy ?? 0.5;
  const gateThreshDb = energy > 0.5 ? -55 : -48;

  // Adaptive: sync reverb decay to beat timing
  const beatSec = 60 / bpm;
  const reverbDuration = Math.min(7, Math.max(3, beatSec * (bpm > 130 ? 5 : 7)));

  onProgress({ stage: 'Pitch-shifting with cubic interpolation...', percent: 10 });

  const slowFactor = 1.15;
  const newLength = Math.ceil(buffer.length * slowFactor);
  const reverbTail = buffer.sampleRate * Math.ceil(reverbDuration);

  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    newLength + reverbTail,
    buffer.sampleRate
  );

  // Noise gate the source first
  const cleanBuffer = applyNoiseGate(buffer, offlineCtx, gateThreshDb);

  // High-quality Hermite resampling
  const slowedBuffer = offlineCtx.createBuffer(
    cleanBuffer.numberOfChannels,
    newLength,
    cleanBuffer.sampleRate
  );
  for (let ch = 0; ch < cleanBuffer.numberOfChannels; ch++) {
    const inputData = cleanBuffer.getChannelData(ch);
    const outputData = slowedBuffer.getChannelData(ch);
    for (let i = 0; i < newLength; i++) {
      outputData[i] = hermiteInterpolate(inputData, i / slowFactor);
    }
  }

  onProgress({ stage: 'Generating beat-synced reverb...', percent: 30 });
  const reverbIR = generateReverbIR(buffer.sampleRate, reverbDuration);

  onProgress({ stage: 'Shaping adaptive EQ...', percent: 45 });

  const source = offlineCtx.createBufferSource();
  source.buffer = slowedBuffer;

  // === Adaptive EQ ===
  // Sub rumble removal
  const subCut = offlineCtx.createBiquadFilter();
  subCut.type = 'highpass'; subCut.frequency.value = 28; subCut.Q.value = 0.5;

  // Bass warmth — less on bass-heavy tracks
  const bassWarmth = offlineCtx.createBiquadFilter();
  bassWarmth.type = 'lowshelf'; bassWarmth.frequency.value = 120;
  bassWarmth.gain.value = bassRatio > 0.4 ? 0.5 : 2;

  // Mud cut
  const mudCut = offlineCtx.createBiquadFilter();
  mudCut.type = 'peaking'; mudCut.frequency.value = 350;
  mudCut.gain.value = -1.5; mudCut.Q.value = 1.5;

  // Pre-reverb presence — adaptive to brightness
  const presence = offlineCtx.createBiquadFilter();
  presence.type = 'peaking'; presence.frequency.value = 3000;
  presence.gain.value = brightness < 0.15 ? 2.5 : 1.5; presence.Q.value = 1.0;

  // De-harsh
  const deHarsh = offlineCtx.createBiquadFilter();
  deHarsh.type = 'peaking'; deHarsh.frequency.value = 5500;
  deHarsh.gain.value = -1.5; deHarsh.Q.value = 2;

  // Post-reverb low-pass — darker tail for lush character
  const postLP = offlineCtx.createBiquadFilter();
  postLP.type = 'lowpass'; postLP.frequency.value = 11000; postLP.Q.value = 0.5;

  // Ultra-high cut
  const ultraCut = offlineCtx.createBiquadFilter();
  ultraCut.type = 'lowpass'; ultraCut.frequency.value = 18000; ultraCut.Q.value = 0.5;

  onProgress({ stage: 'Applying convolution reverb...', percent: 55 });

  const convolver = offlineCtx.createConvolver();
  convolver.buffer = reverbIR;

  // Reverb send pre-filter
  const reverbPreHP = offlineCtx.createBiquadFilter();
  reverbPreHP.type = 'highpass'; reverbPreHP.frequency.value = 200; reverbPreHP.Q.value = 0.5;

  // Wet/dry mix
  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 0.50;
  const wetGain = offlineCtx.createGain();
  wetGain.gain.value = 0.60;

  // Master compression
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -8; compressor.knee.value = 12;
  compressor.ratio.value = 2.5; compressor.attack.value = 0.01;
  compressor.release.value = 0.25;

  // Limiter
  const limiter = offlineCtx.createDynamicsCompressor();
  limiter.threshold.value = -1; limiter.knee.value = 0.3;
  limiter.ratio.value = 20; limiter.attack.value = 0.0003;
  limiter.release.value = 0.04;

  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 0.88;

  // === Routing ===
  // EQ chain
  source.connect(subCut);
  subCut.connect(bassWarmth);
  bassWarmth.connect(mudCut);
  mudCut.connect(presence);
  presence.connect(deHarsh);
  deHarsh.connect(ultraCut);

  // Dry path
  ultraCut.connect(dryGain);
  dryGain.connect(masterGain);

  // Wet path (reverb)
  ultraCut.connect(reverbPreHP);
  reverbPreHP.connect(convolver);
  convolver.connect(postLP);
  postLP.connect(wetGain);
  wetGain.connect(masterGain);

  // Master chain
  masterGain.connect(compressor);
  compressor.connect(limiter);
  limiter.connect(offlineCtx.destination);

  source.start(0);

  onProgress({ stage: 'Rendering final audio...', percent: 80 });
  const result = await offlineCtx.startRendering();
  onProgress({ stage: 'Complete', percent: 100 });
  return result;
}

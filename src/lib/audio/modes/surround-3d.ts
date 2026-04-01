import type { ProgressCallback } from '../types';
import type { AudioAnalysis } from '../analyze';

/**
 * 3D Surround Sound — Dedicated DSP Engine
 * 
 * Enhanced with stronger processing for unique audio fingerprint:
 * - Deeper Mid/Side processing
 * - HRTF cross-feed with stronger head-shadow
 * - Multi-tap concert hall reflections
 * - Frequency-dependent stereo widening
 * - Allpass dispersion for natural diffusion
 */

function generateConcertHallIR(sampleRate: number, hallSize: number): AudioBuffer {
  const duration = 3.0 + hallSize * 2.0;
  const length = Math.ceil(sampleRate * duration);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const ir = ctx.createBuffer(2, length, sampleRate);

  const earlyTaps = [
    { time: 0.020, gain: 0.48, stereoSpread: 0.002 },
    { time: 0.035, gain: 0.42, stereoSpread: 0.005 },
    { time: 0.055, gain: 0.36, stereoSpread: 0.008 },
    { time: 0.080, gain: 0.30, stereoSpread: 0.003 },
    { time: 0.110, gain: 0.26, stereoSpread: 0.010 },
    { time: 0.150, gain: 0.22, stereoSpread: 0.006 },
    { time: 0.200, gain: 0.17, stereoSpread: 0.012 },
    { time: 0.260, gain: 0.13, stereoSpread: 0.009 },
    { time: 0.340, gain: 0.09, stereoSpread: 0.015 },
    { time: 0.440, gain: 0.06, stereoSpread: 0.011 },
    { time: 0.560, gain: 0.03, stereoSpread: 0.018 },
  ];

  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let seed = ch === 0 ? 86243 : 13331;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };

    for (const tap of earlyTaps) {
      const stereoOffset = ch === 0
        ? Math.floor(tap.stereoSpread * sampleRate)
        : -Math.floor(tap.stereoSpread * sampleRate * 0.7);
      const idx = Math.floor(tap.time * hallSize * sampleRate) + Math.abs(stereoOffset);
      if (idx < length && idx >= 0) {
        data[idx] += tap.gain * (0.8 + rand() * 0.2);
        const idx2 = idx + Math.floor(0.005 * sampleRate * (1 + rand() * 0.4));
        if (idx2 < length) data[idx2] += tap.gain * 0.28 * (0.8 + rand() * 0.2);
        // Third reflection for density
        const idx3 = idx + Math.floor(0.009 * sampleRate * (1 + rand() * 0.3));
        if (idx3 < length) data[idx3] += tap.gain * 0.12 * (0.8 + rand() * 0.2);
      }
    }

    const startSample = Math.floor(0.1 * sampleRate);
    for (let i = startSample; i < length; i++) {
      const t = i / sampleRate;
      const earlyDecay = 0.3 * Math.exp(-t * 3.0);
      const bodyDecay = 0.45 * Math.exp(-t * 1.0);
      const tailDecay = 0.25 * Math.exp(-t * 0.4);
      const decay = earlyDecay + bodyDecay + tailDecay;

      const hfDamp = 0.5 * Math.exp(-t * 2.5) + 0.5 * Math.exp(-t * 0.8);
      const sample = rand() * hfDamp + rand() * (1 - hfDamp) * 0.15;
      data[i] += sample * decay * 0.11;
    }
  }
  return ir;
}

export async function process3DSurround(
  buffer: AudioBuffer,
  onProgress: ProgressCallback,
  analysis?: AudioAnalysis
): Promise<AudioBuffer> {
  onProgress({ stage: 'Analyzing stereo characteristics...', percent: 5 });

  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bpm = analysis?.bpm ?? 120;
  const bassRatio = analysis?.bassRatio ?? 0.3;
  const brightness = analysis?.brightness ?? 0.3;

  const hallSize = bpm < 90 ? 1.6 : bpm > 140 ? 0.9 : 1.3;
  const widthAmount = 0.9; // Stronger widening

  const reverbDuration = 3.0 + hallSize * 2.0;
  const totalLength = length + Math.ceil(sampleRate * reverbDuration);

  onProgress({ stage: 'Computing Mid/Side separation...', percent: 15 });

  const leftIn = buffer.getChannelData(0);
  const rightIn = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : leftIn;

  // Mid/Side decomposition
  const mid = new Float32Array(length);
  const side = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    mid[i] = (leftIn[i] + rightIn[i]) * 0.5;
    side[i] = (leftIn[i] - rightIn[i]) * 0.5;
  }

  onProgress({ stage: 'Applying frequency-dependent stereo widening...', percent: 30 });

  // Frequency-dependent side boost:
  // Keep bass (< 200Hz) mono, progressively widen above
  // Simple high-pass filter on side channel
  const wideSide = new Float32Array(length);
  {
    const fc = 180 / sampleRate;
    const w0 = 2 * Math.PI * fc;
    const alpha = Math.sin(w0) / (2 * 0.707);
    const cosW0 = Math.cos(w0);
    const b0 = (1 + cosW0) / 2, b1 = -(1 + cosW0), b2 = (1 + cosW0) / 2;
    const a0 = 1 + alpha, a1 = -2 * cosW0, a2 = 1 - alpha;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

    for (let i = 0; i < length; i++) {
      const x0 = side[i];
      const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      wideSide[i] = y0 * (1 + widthAmount * 1.2); // Stronger side boost
      x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    }
  }

  // Apply allpass dispersion to mid for depth perception
  const dispersedMid = new Float32Array(length);
  {
    // Two-stage allpass for dispersion
    const fc1 = 900 / sampleRate;
    const fc2 = 2200 / sampleRate;
    const w1 = 2 * Math.PI * fc1, w2 = 2 * Math.PI * fc2;
    const q = 0.5;
    // Stage 1
    const alpha1 = Math.sin(w1) / (2 * q);
    const cos1 = Math.cos(w1);
    const a0_1 = 1 + alpha1;
    const b0_1 = (1 - alpha1) / a0_1, b1_1 = (-2 * cos1) / a0_1, b2_1 = (1 + alpha1) / a0_1;
    const a1_1 = (-2 * cos1) / a0_1, a2_1 = (1 - alpha1) / a0_1;
    let x1_1 = 0, x2_1 = 0, y1_1 = 0, y2_1 = 0;

    for (let i = 0; i < length; i++) {
      const x0 = mid[i];
      const y0 = b0_1 * x0 + b1_1 * x1_1 + b2_1 * x2_1 - a1_1 * y1_1 - a2_1 * y2_1;
      dispersedMid[i] = y0;
      x2_1 = x1_1; x1_1 = x0; y2_1 = y1_1; y1_1 = y0;
    }
  }

  onProgress({ stage: 'Applying HRTF cross-feed...', percent: 45 });

  const leftOut = new Float32Array(length);
  const rightOut = new Float32Array(length);

  const crossDelaySamples = Math.round(0.00045 * sampleRate);
  const crossGain = 0.20;

  let crossLPStateL = 0, crossLPStateR = 0;
  const crossLPCoeff = Math.exp(-2 * Math.PI * 4500 / sampleRate);

  for (let i = 0; i < length; i++) {
    const directL = dispersedMid[i] + wideSide[i];
    const directR = dispersedMid[i] - wideSide[i];

    let crossL = 0, crossR = 0;
    if (i >= crossDelaySamples) {
      const pastL = dispersedMid[i - crossDelaySamples] + wideSide[i - crossDelaySamples];
      const pastR = dispersedMid[i - crossDelaySamples] - wideSide[i - crossDelaySamples];

      crossLPStateL = pastR + crossLPCoeff * (crossLPStateL - pastR);
      crossLPStateR = pastL + crossLPCoeff * (crossLPStateR - pastL);

      crossL = crossLPStateL * crossGain;
      crossR = crossLPStateR * crossGain;
    }

    // Haas effect
    const haasOffset = Math.round(0.00035 * sampleRate);
    let haasL = 0, haasR = 0;
    if (i >= haasOffset) {
      haasL = wideSide[i - haasOffset] * 0.10;
      haasR = -wideSide[i - haasOffset] * 0.10;
    }

    leftOut[i] = directL + crossL + haasL;
    rightOut[i] = directR + crossR + haasR;
  }

  onProgress({ stage: 'Generating concert hall reverb...', percent: 55 });

  const offlineCtx = new OfflineAudioContext(2, totalLength, sampleRate);

  const processedBuffer = offlineCtx.createBuffer(2, length, sampleRate);
  processedBuffer.getChannelData(0).set(leftOut);
  processedBuffer.getChannelData(1).set(rightOut);

  const source = offlineCtx.createBufferSource();
  source.buffer = processedBuffer;

  const hallIR = generateConcertHallIR(sampleRate, hallSize);
  const convolver = offlineCtx.createConvolver();
  convolver.buffer = hallIR;

  const reverbHP = offlineCtx.createBiquadFilter();
  reverbHP.type = 'highpass'; reverbHP.frequency.value = 280; reverbHP.Q.value = 0.5;
  const reverbLP = offlineCtx.createBiquadFilter();
  reverbLP.type = 'lowpass'; reverbLP.frequency.value = 7000; reverbLP.Q.value = 0.5;
  const reverbPostLP = offlineCtx.createBiquadFilter();
  reverbPostLP.type = 'lowpass'; reverbPostLP.frequency.value = 5000; reverbPostLP.Q.value = 0.5;

  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 0.65;
  const wetGain = offlineCtx.createGain();
  wetGain.gain.value = 0.45; // More reverb for immersive concert feel

  const mixBus = offlineCtx.createGain();
  mixBus.gain.value = 1.0;

  onProgress({ stage: 'Mastering surround mix...', percent: 70 });

  const subCut = offlineCtx.createBiquadFilter();
  subCut.type = 'highpass'; subCut.frequency.value = 25; subCut.Q.value = 0.5;

  const bassWarmth = offlineCtx.createBiquadFilter();
  bassWarmth.type = 'lowshelf'; bassWarmth.frequency.value = 100;
  bassWarmth.gain.value = bassRatio > 0.4 ? 1.0 : 3.0;

  const presenceLift = offlineCtx.createBiquadFilter();
  presenceLift.type = 'peaking'; presenceLift.frequency.value = 3000;
  presenceLift.gain.value = brightness < 0.15 ? 3 : 2;
  presenceLift.Q.value = 1.2;

  const airShelf = offlineCtx.createBiquadFilter();
  airShelf.type = 'highshelf'; airShelf.frequency.value = 10000;
  airShelf.gain.value = 2;

  // Additional depth via allpass
  const depthAllpass = offlineCtx.createBiquadFilter();
  depthAllpass.type = 'allpass'; depthAllpass.frequency.value = 1500; depthAllpass.Q.value = 0.8;

  const comp = offlineCtx.createDynamicsCompressor();
  comp.threshold.value = -10; comp.knee.value = 12;
  comp.ratio.value = 2; comp.attack.value = 0.012;
  comp.release.value = 0.22;

  const limiter = offlineCtx.createDynamicsCompressor();
  limiter.threshold.value = -1.5; limiter.knee.value = 2;
  limiter.ratio.value = 15; limiter.attack.value = 0.001;
  limiter.release.value = 0.05;

  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 0.95;

  // === Routing ===
  source.connect(dryGain);
  dryGain.connect(mixBus);

  source.connect(reverbHP);
  reverbHP.connect(reverbLP);
  reverbLP.connect(convolver);
  convolver.connect(reverbPostLP);
  reverbPostLP.connect(wetGain);
  wetGain.connect(mixBus);

  mixBus.connect(subCut);
  subCut.connect(bassWarmth);
  bassWarmth.connect(presenceLift);
  presenceLift.connect(airShelf);
  airShelf.connect(depthAllpass);
  depthAllpass.connect(comp);
  comp.connect(limiter);
  limiter.connect(masterGain);
  masterGain.connect(offlineCtx.destination);

  source.start(0);

  onProgress({ stage: 'Rendering 3D surround audio...', percent: 88 });
  const result = await offlineCtx.startRendering();
  onProgress({ stage: 'Complete', percent: 100 });
  return result;
}

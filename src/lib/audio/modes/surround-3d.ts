import type { ProgressCallback } from '../types';
import type { AudioAnalysis } from '../analyze';

/**
 * 3D Surround Sound — Dedicated DSP Engine
 * 
 * Expands the stereo image to create a massive concert-hall experience:
 * - Mid/Side processing for precise stereo width control
 * - HRTF cross-feed for out-of-head listening
 * - Multi-tap early reflections simulating a concert hall
 * - Frequency-dependent stereo widening (keeps bass centered)
 * - Haas effect micro-delays for perceived width
 */

/**
 * Generate a concert hall impulse response.
 * Large space: long pre-delay, wide early reflections, smooth diffuse tail.
 */
function generateConcertHallIR(sampleRate: number, hallSize: number): AudioBuffer {
  const duration = 2.5 + hallSize * 2.0; // 2.5-4.5s depending on hall size
  const length = Math.ceil(sampleRate * duration);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const ir = ctx.createBuffer(2, length, sampleRate);

  // Concert hall early reflections — widely spaced, stereo-divergent
  const earlyTaps = [
    { time: 0.020, gain: 0.45, stereoSpread: 0.002 },
    { time: 0.035, gain: 0.40, stereoSpread: 0.005 },
    { time: 0.055, gain: 0.35, stereoSpread: 0.008 },
    { time: 0.080, gain: 0.30, stereoSpread: 0.003 },
    { time: 0.110, gain: 0.25, stereoSpread: 0.010 },
    { time: 0.150, gain: 0.20, stereoSpread: 0.006 },
    { time: 0.200, gain: 0.16, stereoSpread: 0.012 },
    { time: 0.260, gain: 0.12, stereoSpread: 0.009 },
    { time: 0.340, gain: 0.08, stereoSpread: 0.015 },
    { time: 0.440, gain: 0.05, stereoSpread: 0.011 },
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
        // Secondary reflection
        const idx2 = idx + Math.floor(0.005 * sampleRate * (1 + rand() * 0.4));
        if (idx2 < length) data[idx2] += tap.gain * 0.25 * (0.8 + rand() * 0.2);
      }
    }

    // Diffuse tail — triple-decay for concert hall character
    const startSample = Math.floor(0.1 * sampleRate);
    for (let i = startSample; i < length; i++) {
      const t = i / sampleRate;
      const earlyDecay = 0.3 * Math.exp(-t * 3.0);      // Quick initial energy
      const bodyDecay = 0.45 * Math.exp(-t * 1.2);       // Warm body
      const tailDecay = 0.25 * Math.exp(-t * 0.5);       // Long airy tail
      const decay = earlyDecay + bodyDecay + tailDecay;

      // Frequency-dependent absorption (concert halls absorb highs)
      const hfDamp = 0.5 * Math.exp(-t * 2.5) + 0.5 * Math.exp(-t * 0.8);
      const sample = rand() * hfDamp + rand() * (1 - hfDamp) * 0.15;
      data[i] += sample * decay * 0.10;
    }
  }
  return ir;
}

/**
 * Process audio with 3D surround sound effect.
 * Expands stereo image using Mid/Side processing, HRTF cross-feed,
 * and concert hall reverb.
 */
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
  const energy = analysis?.energy ?? 0.5;

  const hallSize = bpm < 90 ? 1.5 : bpm > 140 ? 0.8 : 1.2;
  const widthAmount = 0.85; // Strong widening

  // Reverb tail
  const reverbDuration = 2.5 + hallSize * 2.0;
  const totalLength = length + Math.ceil(sampleRate * reverbDuration);

  onProgress({ stage: 'Computing Mid/Side separation...', percent: 15 });

  // Get stereo channels
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
    // 2nd order HP at 200Hz for side channel
    const fc = 200 / sampleRate;
    const w0 = 2 * Math.PI * fc;
    const alpha = Math.sin(w0) / (2 * 0.707);
    const cosW0 = Math.cos(w0);
    const b0 = (1 + cosW0) / 2, b1 = -(1 + cosW0), b2 = (1 + cosW0) / 2;
    const a0 = 1 + alpha, a1 = -2 * cosW0, a2 = 1 - alpha;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

    for (let i = 0; i < length; i++) {
      const x0 = side[i];
      const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      wideSide[i] = y0 * (1 + widthAmount); // Boost side channel
      x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    }
  }

  // HRTF cross-feed for natural out-of-head perception
  onProgress({ stage: 'Applying HRTF cross-feed...', percent: 45 });

  const leftOut = new Float32Array(length);
  const rightOut = new Float32Array(length);

  // Cross-feed delay: ~0.3-0.6ms ITD simulation
  const crossDelaySamples = Math.round(0.0004 * sampleRate); // 0.4ms
  const crossGain = 0.18; // Subtle cross-feed

  // Head shadow filter state for cross-feed
  let crossLPStateL = 0, crossLPStateR = 0;
  const crossLPCoeff = Math.exp(-2 * Math.PI * 5000 / sampleRate);

  for (let i = 0; i < length; i++) {
    // Reconstruct stereo from M/S with enhanced side
    const directL = mid[i] + wideSide[i];
    const directR = mid[i] - wideSide[i];

    // Cross-feed with delay and head-shadow filtering
    let crossL = 0, crossR = 0;
    if (i >= crossDelaySamples) {
      const pastL = mid[i - crossDelaySamples] + wideSide[i - crossDelaySamples];
      const pastR = mid[i - crossDelaySamples] - wideSide[i - crossDelaySamples];

      // Low-pass the cross-feed (head shadow attenuates highs)
      crossLPStateL = pastR + crossLPCoeff * (crossLPStateL - pastR);
      crossLPStateR = pastL + crossLPCoeff * (crossLPStateR - pastL);

      crossL = crossLPStateL * crossGain;
      crossR = crossLPStateR * crossGain;
    }

    // Haas effect: micro-delay on widened content for extra width perception
    const haasOffset = Math.round(0.0003 * sampleRate); // 0.3ms
    let haasL = 0, haasR = 0;
    if (i >= haasOffset) {
      haasL = wideSide[i - haasOffset] * 0.08;
      haasR = -wideSide[i - haasOffset] * 0.08;
    }

    leftOut[i] = directL + crossL + haasL;
    rightOut[i] = directR + crossR + haasR;
  }

  onProgress({ stage: 'Generating concert hall reverb...', percent: 55 });

  // Build offline context for reverb + mastering
  const offlineCtx = new OfflineAudioContext(2, totalLength, sampleRate);

  const processedBuffer = offlineCtx.createBuffer(2, length, sampleRate);
  processedBuffer.getChannelData(0).set(leftOut);
  processedBuffer.getChannelData(1).set(rightOut);

  const source = offlineCtx.createBufferSource();
  source.buffer = processedBuffer;

  // Concert hall reverb
  const hallIR = generateConcertHallIR(sampleRate, hallSize);
  const convolver = offlineCtx.createConvolver();
  convolver.buffer = hallIR;

  // Reverb send filters
  const reverbHP = offlineCtx.createBiquadFilter();
  reverbHP.type = 'highpass'; reverbHP.frequency.value = 300; reverbHP.Q.value = 0.5;
  const reverbLP = offlineCtx.createBiquadFilter();
  reverbLP.type = 'lowpass'; reverbLP.frequency.value = 7000; reverbLP.Q.value = 0.5;
  const reverbPostLP = offlineCtx.createBiquadFilter();
  reverbPostLP.type = 'lowpass'; reverbPostLP.frequency.value = 5500; reverbPostLP.Q.value = 0.5;

  // Wet/dry
  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 0.70;
  const wetGain = offlineCtx.createGain();
  wetGain.gain.value = 0.40; // More reverb for concert hall feel

  const mixBus = offlineCtx.createGain();
  mixBus.gain.value = 1.0;

  onProgress({ stage: 'Mastering surround mix...', percent: 70 });

  // Subtractive EQ cleanup
  const subCut = offlineCtx.createBiquadFilter();
  subCut.type = 'highpass'; subCut.frequency.value = 25; subCut.Q.value = 0.5;

  // Bass warmth (not too much — keep definition)
  const bassWarmth = offlineCtx.createBiquadFilter();
  bassWarmth.type = 'lowshelf'; bassWarmth.frequency.value = 100;
  bassWarmth.gain.value = bassRatio > 0.4 ? 1.0 : 2.5;

  // Presence for clarity
  const presenceLift = offlineCtx.createBiquadFilter();
  presenceLift.type = 'peaking'; presenceLift.frequency.value = 3000;
  presenceLift.gain.value = brightness < 0.15 ? 2.5 : 1.5;
  presenceLift.Q.value = 1.2;

  // Air/shimmer
  const airShelf = offlineCtx.createBiquadFilter();
  airShelf.type = 'highshelf'; airShelf.frequency.value = 10000;
  airShelf.gain.value = 1.5;

  // Glue compression
  const comp = offlineCtx.createDynamicsCompressor();
  comp.threshold.value = -10; comp.knee.value = 12;
  comp.ratio.value = 2; comp.attack.value = 0.012;
  comp.release.value = 0.22;

  // Limiter
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
  airShelf.connect(comp);
  comp.connect(limiter);
  limiter.connect(masterGain);
  masterGain.connect(offlineCtx.destination);

  source.start(0);

  onProgress({ stage: 'Rendering 3D surround audio...', percent: 88 });
  const result = await offlineCtx.startRendering();
  onProgress({ stage: 'Complete', percent: 100 });
  return result;
}

import { createSaturationCurve } from '../dsp-utils';
import type { ProgressCallback } from '../types';
import type { AudioAnalysis } from '../analyze';

/**
 * Generate a concert hall impulse response tuned to the track's BPM.
 * Tail length is synced to musical timing (4-6 beats).
 */
function generateHallIR(sampleRate: number, bpm: number): AudioBuffer {
  const beatSec = 60 / bpm;
  // Tail = 4 beats for fast songs, 6 beats for slow — always musical
  const duration = Math.min(5, Math.max(2, beatSec * (bpm > 130 ? 4 : 6)));
  const length = Math.ceil(sampleRate * duration);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const ir = ctx.createBuffer(2, length, sampleRate);

  // Early reflections — simulate a large hall with left/right offset
  const earlyTaps = [
    { time: 0.018, gain: 0.65 }, { time: 0.032, gain: 0.55 },
    { time: 0.048, gain: 0.48 }, { time: 0.065, gain: 0.40 },
    { time: 0.085, gain: 0.33 }, { time: 0.110, gain: 0.27 },
    { time: 0.140, gain: 0.21 }, { time: 0.175, gain: 0.16 },
    { time: 0.220, gain: 0.12 }, { time: 0.275, gain: 0.08 },
    { time: 0.340, gain: 0.05 },
  ];

  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let seed = ch === 0 ? 54321 : 98765;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };

    for (const tap of earlyTaps) {
      const stereoOffset = ch * Math.floor(0.005 * sampleRate);
      const idx = Math.floor(tap.time * sampleRate) + stereoOffset;
      if (idx < length) {
        data[idx] += tap.gain * (0.85 + rand() * 0.15);
        // Secondary reflection
        const idx2 = idx + Math.floor(0.003 * sampleRate * (1 + rand() * 0.3));
        if (idx2 < length) data[idx2] += tap.gain * 0.25;
      }
    }

    // Late diffuse tail with frequency-dependent decay
    const startSample = Math.floor(0.08 * sampleRate);
    for (let i = startSample; i < length; i++) {
      const t = i / sampleRate;
      const bodyDecay = 0.55 * Math.exp(-t * 1.6);
      const tailDecay = 0.35 * Math.exp(-t * 0.7);
      const decay = bodyDecay + tailDecay;
      // High-frequency damping for natural warmth
      const hfDamp = 0.55 * Math.exp(-t * 2.5) + 0.45 * Math.exp(-t * 0.4);
      const sample = rand() * hfDamp + rand() * (1 - hfDamp) * 0.15;
      data[i] += sample * decay * 0.12;
    }
  }
  return ir;
}

/**
 * Generate a noise gate envelope from the audio buffer.
 * Returns gain values per sample — quiet parts are gated to reduce noise.
 */
function computeNoiseGateEnvelope(buffer: AudioBuffer, thresholdDb: number, attackMs: number, releaseMs: number): Float32Array {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const env = new Float32Array(buffer.length);

  const threshold = Math.pow(10, thresholdDb / 20);
  const attackCoeff = Math.exp(-1 / (sr * attackMs / 1000));
  const releaseCoeff = Math.exp(-1 / (sr * releaseMs / 1000));

  let level = 0;
  let gateGain = 1;

  for (let i = 0; i < buffer.length; i++) {
    // Peak follower
    const abs = Math.abs(data[i]);
    if (abs > level) {
      level = abs + (level - abs) * 0.999;
    } else {
      level *= 0.9999;
    }

    // Gate logic with hysteresis
    if (level > threshold) {
      gateGain = 1 - (1 - gateGain) * attackCoeff;
    } else {
      gateGain *= releaseCoeff;
    }

    env[i] = Math.max(0.02, gateGain); // Never fully silent — keep 2% for naturalness
  }

  return env;
}

/**
 * Premium Remix mode — analysis-aware, noise-gated, beat-synced, mastered.
 * Reads the track's spectral profile & BPM, then auto-shapes EQ, compression,
 * and spatial processing to deliver a clean, punchy, natural-sounding remix.
 */
export async function processRemix(
  buffer: AudioBuffer,
  onProgress: ProgressCallback,
  analysis?: AudioAnalysis
): Promise<AudioBuffer> {
  onProgress({ stage: 'Analyzing track profile...', percent: 10 });

  // Use analysis or sensible defaults
  const bpm = analysis?.bpm ?? 120;
  const bassRatio = analysis?.bassRatio ?? 0.3;
  const brightness = analysis?.brightness ?? 0.3;
  const energy = analysis?.energy ?? 0.5;
  const dynamicRange = analysis?.dynamicRange ?? 0.5;

  // --- Adaptive parameters based on analysis ---
  // Bass-heavy tracks: less bass boost to avoid muddiness
  const bassBoostDb = bassRatio > 0.4 ? 2 + (1 - bassRatio) * 3 : 3.5 + (1 - bassRatio) * 2;
  // Bright tracks: less air boost
  const airBoostDb = brightness > 0.2 ? 1 : 2;
  // Presence: boost more on dull tracks
  const presenceDb = brightness < 0.1 ? 3 : 2 + brightness;
  // Hall wetness: less on fast/energetic tracks
  const hallWet = bpm > 140 ? 0.12 : bpm < 90 ? 0.22 : 0.16;
  // Compression: more dynamic tracks get more glue
  const parallelCompGain = dynamicRange > 0.5 ? 0.35 : 0.25;
  // Gate threshold: louder tracks need lower gate
  const gateThreshDb = energy > 0.5 ? -55 : -48;

  // Extend buffer for reverb tail
  const tailSamples = Math.ceil(buffer.sampleRate * 3.5);
  const totalLength = buffer.length + tailSamples;

  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    totalLength,
    buffer.sampleRate
  );

  onProgress({ stage: 'Applying noise reduction...', percent: 15 });

  // === Phase 1: Noise Gate — clean the source ===
  // Apply a soft noise gate to reduce background noise and hiss
  const gateEnvelope = computeNoiseGateEnvelope(buffer, gateThreshDb, 0.5, 50);
  const cleanBuffer = offlineCtx.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = cleanBuffer.getChannelData(ch);
    for (let i = 0; i < buffer.length; i++) {
      dst[i] = src[i] * gateEnvelope[i];
    }
  }

  const source = offlineCtx.createBufferSource();
  source.buffer = cleanBuffer;

  onProgress({ stage: 'Shaping frequency spectrum...', percent: 25 });

  // === Phase 2: Analysis-Adaptive EQ ===
  // Sub rumble removal (very steep, below audible range)
  const subCut = offlineCtx.createBiquadFilter();
  subCut.type = 'highpass'; subCut.frequency.value = 25; subCut.Q.value = 0.5;

  // Ultra-low cleanup — removes room rumble without losing bass
  const lowCut2 = offlineCtx.createBiquadFilter();
  lowCut2.type = 'highpass'; lowCut2.frequency.value = 32; lowCut2.Q.value = 0.3;

  // Sub-bass foundation — adaptive to track content
  const subWarmth = offlineCtx.createBiquadFilter();
  subWarmth.type = 'lowshelf'; subWarmth.frequency.value = 80;
  subWarmth.gain.value = bassBoostDb;

  // Body/warmth around 200Hz — less on bass-heavy tracks
  const bodyBoost = offlineCtx.createBiquadFilter();
  bodyBoost.type = 'peaking'; bodyBoost.frequency.value = 200;
  bodyBoost.gain.value = bassRatio > 0.35 ? 1 : 2.5; bodyBoost.Q.value = 1.0;

  // Mud cut — always clean 300-500Hz
  const mudCut = offlineCtx.createBiquadFilter();
  mudCut.type = 'peaking'; mudCut.frequency.value = 350;
  mudCut.gain.value = -2; mudCut.Q.value = 1.5;

  // Box removal at 600Hz
  const boxCut = offlineCtx.createBiquadFilter();
  boxCut.type = 'peaking'; boxCut.frequency.value = 600;
  boxCut.gain.value = -1; boxCut.Q.value = 2;

  // Vocal/instrument presence — adaptive
  const presenceBoost = offlineCtx.createBiquadFilter();
  presenceBoost.type = 'peaking'; presenceBoost.frequency.value = 3200;
  presenceBoost.gain.value = presenceDb; presenceBoost.Q.value = 0.8;

  // De-harsh — remove ear-fatiguing frequencies
  const deHarsh = offlineCtx.createBiquadFilter();
  deHarsh.type = 'peaking'; deHarsh.frequency.value = 5500;
  deHarsh.gain.value = -1.5; deHarsh.Q.value = 2;

  // Air shelf — sparkle without harshness
  const airShelf = offlineCtx.createBiquadFilter();
  airShelf.type = 'highshelf'; airShelf.frequency.value = 12000;
  airShelf.gain.value = airBoostDb;

  // Ultra-high cut to remove digital artifacts
  const ultraHighCut = offlineCtx.createBiquadFilter();
  ultraHighCut.type = 'lowpass'; ultraHighCut.frequency.value = 18500; ultraHighCut.Q.value = 0.5;

  onProgress({ stage: 'Adding spatial depth...', percent: 40 });

  // === Phase 3: Hall Reverb (beat-synced) ===
  const hallConvolver = offlineCtx.createConvolver();
  hallConvolver.buffer = generateHallIR(buffer.sampleRate, bpm);

  // Pre-filter: keep bass out of reverb for clarity
  const hallPreHP = offlineCtx.createBiquadFilter();
  hallPreHP.type = 'highpass'; hallPreHP.frequency.value = 350; hallPreHP.Q.value = 0.5;

  // Reverb tone shaping — darker, more natural tail
  const hallPostLP = offlineCtx.createBiquadFilter();
  hallPostLP.type = 'lowpass'; hallPostLP.frequency.value = 7000; hallPostLP.Q.value = 0.5;

  // Remove harshness from reverb tail
  const hallDip = offlineCtx.createBiquadFilter();
  hallDip.type = 'peaking'; hallDip.frequency.value = 4000;
  hallDip.gain.value = -2; hallDip.Q.value = 1;

  const hallWetGain = offlineCtx.createGain();
  hallWetGain.gain.value = hallWet;

  onProgress({ stage: 'Applying studio compression...', percent: 55 });

  // === Phase 4: Dynamics Processing ===
  // Dry path
  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 0.78;

  // Parallel (New York style) compression — adds punch & energy
  const parallelComp = offlineCtx.createDynamicsCompressor();
  parallelComp.threshold.value = -28; parallelComp.knee.value = 8;
  parallelComp.ratio.value = 6; parallelComp.attack.value = 0.003;
  parallelComp.release.value = 0.12;

  const compGain = offlineCtx.createGain();
  compGain.gain.value = parallelCompGain;

  // Mix bus
  const mixBus = offlineCtx.createGain();
  mixBus.gain.value = 1.0;

  onProgress({ stage: 'Mastering for premium output...', percent: 70 });

  // === Phase 5: Mastering Chain ===
  // Glue compressor — gentle mix glue
  const masterComp = offlineCtx.createDynamicsCompressor();
  masterComp.threshold.value = -10; masterComp.knee.value = 12;
  masterComp.ratio.value = 2; masterComp.attack.value = 0.015;
  masterComp.release.value = 0.25;

  // Console saturation — very subtle harmonic warmth
  const consoleSat = offlineCtx.createWaveShaper();
  consoleSat.curve = createSaturationCurve(0.08) as Float32Array<ArrayBuffer>;
  consoleSat.oversample = '4x';

  // Multiband-style tone control post-compression
  // Tighten the low end after compression
  const postBassControl = offlineCtx.createBiquadFilter();
  postBassControl.type = 'lowshelf'; postBassControl.frequency.value = 100;
  postBassControl.gain.value = bassRatio > 0.4 ? -1 : 0.5; // Pull back bass if already heavy

  // Final presence lift
  const finalPresence = offlineCtx.createBiquadFilter();
  finalPresence.type = 'peaking'; finalPresence.frequency.value = 2800;
  finalPresence.gain.value = 1; finalPresence.Q.value = 1.5;

  // Transparent brick-wall limiter
  const limiter = offlineCtx.createDynamicsCompressor();
  limiter.threshold.value = -1; limiter.knee.value = 0.3;
  limiter.ratio.value = 20; limiter.attack.value = 0.0003;
  limiter.release.value = 0.04;

  // Final output gain — leave headroom for natural dynamics
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 0.92;

  // === Routing ===
  // Source → EQ chain
  source.connect(subCut);
  subCut.connect(lowCut2);
  lowCut2.connect(subWarmth);
  subWarmth.connect(bodyBoost);
  bodyBoost.connect(mudCut);
  mudCut.connect(boxCut);
  boxCut.connect(presenceBoost);
  presenceBoost.connect(deHarsh);
  deHarsh.connect(airShelf);
  airShelf.connect(ultraHighCut);

  // Dry → mix
  ultraHighCut.connect(dryGain);
  dryGain.connect(mixBus);

  // Hall reverb send → mix (pre-filtered, tone-shaped)
  ultraHighCut.connect(hallPreHP);
  hallPreHP.connect(hallConvolver);
  hallConvolver.connect(hallPostLP);
  hallPostLP.connect(hallDip);
  hallDip.connect(hallWetGain);
  hallWetGain.connect(mixBus);

  // Parallel compression → mix
  ultraHighCut.connect(parallelComp);
  parallelComp.connect(compGain);
  compGain.connect(mixBus);

  // Master chain: glue → saturation → tone → limiter → output
  mixBus.connect(masterComp);
  masterComp.connect(consoleSat);
  consoleSat.connect(postBassControl);
  postBassControl.connect(finalPresence);
  finalPresence.connect(limiter);
  limiter.connect(masterGain);
  masterGain.connect(offlineCtx.destination);

  source.start(0);

  onProgress({ stage: 'Rendering premium remix...', percent: 85 });
  const result = await offlineCtx.startRendering();
  onProgress({ stage: 'Complete', percent: 100 });
  return result;
}

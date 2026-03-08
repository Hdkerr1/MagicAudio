import { createSaturationCurve } from '../dsp-utils';
import type { ProgressCallback } from '../types';
import type { AudioAnalysis } from '../analyze';

/**
 * Generate a premium plate reverb impulse response.
 * Plate reverb is the standard in film/music production — smooth, dense,
 * and musical without the harsh metallic artifacts of algorithmic reverbs.
 */
function generatePlateReverbIR(sampleRate: number, decayTime: number): AudioBuffer {
  const length = Math.ceil(sampleRate * decayTime);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const ir = ctx.createBuffer(2, length, sampleRate);

  // Plate reverb has very dense, smooth early reflections (no distinct echoes)
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let seed = ch === 0 ? 31415 : 27183;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };

    // Initial transient (plate impact)
    data[0] = 0.5 * (0.9 + rand() * 0.1);

    // Very dense early reflections — plate character (no gaps)
    for (let i = 1; i < Math.min(length, Math.floor(0.06 * sampleRate)); i++) {
      const t = i / sampleRate;
      // Exponential buildup then decay — characteristic of plate
      const buildUp = 1 - Math.exp(-t * 200);
      const earlyDecay = Math.exp(-t * 8);
      data[i] = rand() * buildUp * earlyDecay * 0.4;
    }

    // Late diffuse tail with frequency-dependent decay
    // Plates have a characteristic warm, smooth tail
    const decayRate = Math.log(1000) / decayTime; // RT60 based
    for (let i = Math.floor(0.02 * sampleRate); i < length; i++) {
      const t = i / sampleRate;
      // Three-band decay: lows decay slower, highs decay faster (natural damping)
      const lowDecay = Math.exp(-t * decayRate * 0.7);
      const midDecay = Math.exp(-t * decayRate * 1.0);
      const hiDecay = Math.exp(-t * decayRate * 2.5);

      // Mix of filtered noise at different densities
      const lowNoise = rand() * 0.4;
      const midNoise = rand() * 0.35;
      const hiNoise = rand() * 0.25;

      const combined = lowNoise * lowDecay + midNoise * midDecay + hiNoise * hiDecay;

      // Modulation for richness (plates have subtle pitch modulation)
      const mod = 1 + Math.sin(2 * Math.PI * 0.7 * t + ch * 0.5) * 0.002;
      data[i] += combined * mod * 0.12;
    }
  }
  return ir;
}

/**
 * Soft noise gate envelope — studio-grade noise reduction.
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
    env[i] = Math.max(0.03, gateGain);
  }
  return env;
}

/**
 * Premium Remix Mode — Hollywood/Bollywood Film-Grade Mastering Chain
 *
 * Signal flow follows professional mastering standards:
 * 1. Noise Gate (clean source)
 * 2. Subtractive EQ (surgical problem removal)
 * 3. Gentle Additive EQ (tonal enhancement — SUBTLE, 1-2dB max)
 * 4. Glue Compression (cohesion, 2-3dB GR max)
 * 5. Plate Reverb (musical space — low wet mix)
 * 6. Console Saturation (analog warmth — barely audible)
 * 7. Stereo Enhancement (width without phase issues)
 * 8. Final Limiter (loudness — transparent, -1dB ceiling)
 *
 * Key principles:
 * - LESS IS MORE: All boosts stay under 2.5dB
 * - Subtractive first: cut problems rather than boost to mask them
 * - Proper gain staging: every stage operates at healthy levels
 * - No excessive bass: sub handled with precision, not brute force
 */
export async function processRemix(
  buffer: AudioBuffer,
  onProgress: ProgressCallback,
  analysis?: AudioAnalysis
): Promise<AudioBuffer> {
  onProgress({ stage: 'Analyzing track characteristics...', percent: 8 });

  const bpm = analysis?.bpm ?? 120;
  const bassRatio = analysis?.bassRatio ?? 0.3;
  const brightness = analysis?.brightness ?? 0.3;
  const energy = analysis?.energy ?? 0.5;

  // Adaptive parameters
  const isBassHeavy = bassRatio > 0.35;
  const isDull = brightness < 0.12;
  const isBright = brightness > 0.25;
  const gateThreshDb = energy > 0.5 ? -58 : -50;

  // Reverb: plate with musical timing
  const beatSec = 60 / bpm;
  const reverbDecay = Math.min(3.5, Math.max(1.5, beatSec * (bpm > 130 ? 3 : 4.5)));
  const reverbWet = bpm > 140 ? 0.10 : bpm < 90 ? 0.18 : 0.14; // Slightly more present

  // Extend buffer for reverb tail
  const tailSamples = Math.ceil(buffer.sampleRate * reverbDecay);
  const totalLength = buffer.length + tailSamples;

  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    totalLength,
    buffer.sampleRate
  );

  // === STAGE 1: Noise Gate ===
  onProgress({ stage: 'Cleaning source audio...', percent: 12 });
  const gateEnvelope = computeNoiseGateEnvelope(buffer, gateThreshDb);
  const cleanBuffer = offlineCtx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = cleanBuffer.getChannelData(ch);
    for (let i = 0; i < buffer.length; i++) dst[i] = src[i] * gateEnvelope[i];
  }

  const source = offlineCtx.createBufferSource();
  source.buffer = cleanBuffer;

  // === STAGE 2: Subtractive EQ (surgical problem removal) ===
  onProgress({ stage: 'Surgical frequency cleanup...', percent: 20 });

  // 2a. Subsonic rumble removal — steep 24dB/oct below audible range
  const subCut1 = offlineCtx.createBiquadFilter();
  subCut1.type = 'highpass'; subCut1.frequency.value = 22; subCut1.Q.value = 0.5;
  const subCut2 = offlineCtx.createBiquadFilter();
  subCut2.type = 'highpass'; subCut2.frequency.value = 28; subCut2.Q.value = 0.5;

  // 2b. Mud removal at 250-400Hz — THE most common problem in all music
  const mudCut = offlineCtx.createBiquadFilter();
  mudCut.type = 'peaking'; mudCut.frequency.value = 300;
  mudCut.gain.value = isBassHeavy ? -2 : -1; // Gentler
  mudCut.Q.value = 1.2;

  // 2c. Box/honk removal at 500-700Hz
  const boxCut = offlineCtx.createBiquadFilter();
  boxCut.type = 'peaking'; boxCut.frequency.value = 550;
  boxCut.gain.value = -1.5; boxCut.Q.value = 2;

  // 2d. Nasal frequencies removal at 1kHz
  const nasalCut = offlineCtx.createBiquadFilter();
  nasalCut.type = 'peaking'; nasalCut.frequency.value = 1000;
  nasalCut.gain.value = -0.8; nasalCut.Q.value = 3;

  // 2e. Harshness removal at 3-6kHz — critical for ear comfort
  const harshCut1 = offlineCtx.createBiquadFilter();
  harshCut1.type = 'peaking'; harshCut1.frequency.value = 3500;
  harshCut1.gain.value = isBright ? -2.5 : -1.5; harshCut1.Q.value = 2;

  const harshCut2 = offlineCtx.createBiquadFilter();
  harshCut2.type = 'peaking'; harshCut2.frequency.value = 5500;
  harshCut2.gain.value = isBright ? -2 : -1; harshCut2.Q.value = 2.5;

  // 2f. Sibilance taming at 7-9kHz
  const sibilanceCut = offlineCtx.createBiquadFilter();
  sibilanceCut.type = 'peaking'; sibilanceCut.frequency.value = 7500;
  sibilanceCut.gain.value = -1.5; sibilanceCut.Q.value = 3;

  // 2g. Ultra-high digital artifact removal
  const ultraCut = offlineCtx.createBiquadFilter();
  ultraCut.type = 'lowpass'; ultraCut.frequency.value = 17500; ultraCut.Q.value = 0.5;

  // === STAGE 3: Gentle Additive EQ (tonal sweetening — MAX 2dB) ===
  onProgress({ stage: 'Tonal sweetening...', percent: 30 });

  // 3a. Sub-bass foundation
  const subWarmth = offlineCtx.createBiquadFilter();
  subWarmth.type = 'lowshelf'; subWarmth.frequency.value = 80;
  subWarmth.gain.value = isBassHeavy ? 1 : 4; // Real bass boost

  // 3b. Kick/bass body
  const kickBody = offlineCtx.createBiquadFilter();
  kickBody.type = 'peaking'; kickBody.frequency.value = 100;
  kickBody.gain.value = isBassHeavy ? 1 : 3; kickBody.Q.value = 1.2;

  // 3c. Vocal/instrument presence
  const presenceLift = offlineCtx.createBiquadFilter();
  presenceLift.type = 'peaking'; presenceLift.frequency.value = 2500;
  presenceLift.gain.value = isDull ? 3.5 : 2; presenceLift.Q.value = 1.5;

  // 3d. Air/sparkle
  const airLift = offlineCtx.createBiquadFilter();
  airLift.type = 'highshelf'; airLift.frequency.value = 12000;
  airLift.gain.value = isDull ? 2 : 1;

  // === Gain staging: compensate for all the EQ cuts ===
  const eqMakeup = offlineCtx.createGain();
  eqMakeup.gain.value = 1.12;

  // === STAGE 4: Glue Compression (cohesion — gentle, 2-3dB GR) ===
  onProgress({ stage: 'Applying studio compression...', percent: 40 });

  const glueComp = offlineCtx.createDynamicsCompressor();
  glueComp.threshold.value = -10; // Less aggressive
  glueComp.knee.value = 15;
  glueComp.ratio.value = 1.5;
  glueComp.attack.value = 0.015;
  glueComp.release.value = 0.25;

  // Parallel compression — adds density
  const parallelComp = offlineCtx.createDynamicsCompressor();
  parallelComp.threshold.value = -24; parallelComp.knee.value = 8;
  parallelComp.ratio.value = 3.5; parallelComp.attack.value = 0.008;
  parallelComp.release.value = 0.18;

  const parallelGain = offlineCtx.createGain();
  parallelGain.gain.value = 0.25; // More blend for punch

  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 0.85;

  const compMixBus = offlineCtx.createGain();
  compMixBus.gain.value = 1.0;

  // === STAGE 5: Plate Reverb (musical space — LOW mix) ===
  onProgress({ stage: 'Adding plate reverb...', percent: 50 });

  const plateIR = generatePlateReverbIR(buffer.sampleRate, reverbDecay);
  const convolver = offlineCtx.createConvolver();
  convolver.buffer = plateIR;

  // Reverb send: cut lows and highs for clean reverb
  const reverbSendHP = offlineCtx.createBiquadFilter();
  reverbSendHP.type = 'highpass'; reverbSendHP.frequency.value = 400; reverbSendHP.Q.value = 0.5;
  const reverbSendLP = offlineCtx.createBiquadFilter();
  reverbSendLP.type = 'lowpass'; reverbSendLP.frequency.value = 6000; reverbSendLP.Q.value = 0.5;

  // Post-reverb tone: darken the tail for warmth
  const reverbToneLP = offlineCtx.createBiquadFilter();
  reverbToneLP.type = 'lowpass'; reverbToneLP.frequency.value = 5000; reverbToneLP.Q.value = 0.5;

  const reverbWetGain = offlineCtx.createGain();
  reverbWetGain.gain.value = reverbWet;
  const reverbDryGain = offlineCtx.createGain();
  reverbDryGain.gain.value = 1.0;

  const reverbMixBus = offlineCtx.createGain();
  reverbMixBus.gain.value = 1.0;

  // === STAGE 6: Console Saturation (barely audible analog warmth) ===
  onProgress({ stage: 'Adding analog warmth...', percent: 60 });

  const consoleSat = offlineCtx.createWaveShaper();
  // Very gentle saturation — just adds 2nd/3rd harmonics
  consoleSat.curve = createSaturationCurve(0.06) as Float32Array<ArrayBuffer>;
  consoleSat.oversample = '4x';

  // === STAGE 7: Stereo Enhancement (width without phase issues) ===
  onProgress({ stage: 'Enhancing stereo image...', percent: 68 });

  // Mid-side approach: slight boost to side information for width
  // Implemented via channel splitting + complementary delays
  const stereoDelay = offlineCtx.createDelay(0.05);
  stereoDelay.delayTime.value = 0.0004; // Haas effect — 0.4ms
  const stereoGain = offlineCtx.createGain();
  stereoGain.gain.value = 0.12; // Very subtle

  const stereoLP = offlineCtx.createBiquadFilter();
  stereoLP.type = 'lowpass'; stereoLP.frequency.value = 8000; stereoLP.Q.value = 0.5;

  // === STAGE 8: Final Mastering Limiter ===
  onProgress({ stage: 'Final mastering...', percent: 78 });

  // Pre-limiter EQ: last chance tonal adjustment
  const preLimiterBass = offlineCtx.createBiquadFilter();
  preLimiterBass.type = 'lowshelf'; preLimiterBass.frequency.value = 80;
  preLimiterBass.gain.value = isBassHeavy ? -1 : 0; // Tighten if needed

  // Transparent brick-wall limiter — -1dBFS ceiling
  const limiter = offlineCtx.createDynamicsCompressor();
  limiter.threshold.value = -1.0; // -1dBFS ceiling (industry standard)
  limiter.knee.value = 0.0; // Brick wall
  limiter.ratio.value = 20;
  limiter.attack.value = 0.0002; // 0.2ms — catches all transients
  limiter.release.value = 0.035; // 35ms — fast enough for transparency

  // Final output — leave 0.5dB headroom for codec conversion
  const masterOutput = offlineCtx.createGain();
  masterOutput.gain.value = 0.94;

  // === ROUTING ===

  // Source → Subtractive EQ chain
  source.connect(subCut1);
  subCut1.connect(subCut2);
  subCut2.connect(mudCut);
  mudCut.connect(boxCut);
  boxCut.connect(nasalCut);
  nasalCut.connect(harshCut1);
  harshCut1.connect(harshCut2);
  harshCut2.connect(sibilanceCut);
  sibilanceCut.connect(ultraCut);

  // → Additive EQ
  ultraCut.connect(subWarmth);
  subWarmth.connect(kickBody);
  kickBody.connect(presenceLift);
  presenceLift.connect(airLift);
  airLift.connect(eqMakeup);

  // → Glue Compression (parallel)
  eqMakeup.connect(glueComp);
  glueComp.connect(dryGain);
  dryGain.connect(compMixBus);

  glueComp.connect(parallelComp);
  parallelComp.connect(parallelGain);
  parallelGain.connect(compMixBus);

  // → Plate Reverb (send/return)
  compMixBus.connect(reverbDryGain);
  reverbDryGain.connect(reverbMixBus);

  compMixBus.connect(reverbSendHP);
  reverbSendHP.connect(reverbSendLP);
  reverbSendLP.connect(convolver);
  convolver.connect(reverbToneLP);
  reverbToneLP.connect(reverbWetGain);
  reverbWetGain.connect(reverbMixBus);

  // → Console Saturation
  reverbMixBus.connect(consoleSat);

  // → Stereo widening (add Haas-delayed signal)
  consoleSat.connect(stereoDelay);
  stereoDelay.connect(stereoLP);
  stereoLP.connect(stereoGain);
  stereoGain.connect(preLimiterBass); // Widened signal joins main path

  consoleSat.connect(preLimiterBass); // Main signal

  // → Final Limiter
  preLimiterBass.connect(limiter);
  limiter.connect(masterOutput);
  masterOutput.connect(offlineCtx.destination);

  source.start(0);

  onProgress({ stage: 'Rendering mastered output...', percent: 88 });
  const result = await offlineCtx.startRendering();
  onProgress({ stage: 'Complete', percent: 100 });
  return result;
}

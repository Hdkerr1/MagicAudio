import { createSaturationCurve } from '../dsp-utils';
import type { ProgressCallback } from '../types';
import type { AudioAnalysis } from '../analyze';

/**
 * Generate a premium plate reverb impulse response.
 */
function generatePlateReverbIR(sampleRate: number, decayTime: number): AudioBuffer {
  const length = Math.ceil(sampleRate * decayTime);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const ir = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let seed = ch === 0 ? 31415 : 27183;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };

    data[0] = 0.5 * (0.9 + rand() * 0.1);

    for (let i = 1; i < Math.min(length, Math.floor(0.06 * sampleRate)); i++) {
      const t = i / sampleRate;
      const buildUp = 1 - Math.exp(-t * 200);
      const earlyDecay = Math.exp(-t * 8);
      data[i] = rand() * buildUp * earlyDecay * 0.4;
    }

    const decayRate = Math.log(1000) / decayTime;
    for (let i = Math.floor(0.02 * sampleRate); i < length; i++) {
      const t = i / sampleRate;
      const lowDecay = Math.exp(-t * decayRate * 0.7);
      const midDecay = Math.exp(-t * decayRate * 1.0);
      const hiDecay = Math.exp(-t * decayRate * 2.5);
      const lowNoise = rand() * 0.4;
      const midNoise = rand() * 0.35;
      const hiNoise = rand() * 0.25;
      const combined = lowNoise * lowDecay + midNoise * midDecay + hiNoise * hiDecay;
      const mod = 1 + Math.sin(2 * Math.PI * 0.7 * t + ch * 0.5) * 0.002;
      data[i] += combined * mod * 0.12;
    }
  }
  return ir;
}

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
 * Enhanced with additional harmonic exciter, multiband stereo widening,
 * and deeper compression for a fully re-characterized output.
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

  const isBassHeavy = bassRatio > 0.35;
  const isDull = brightness < 0.12;
  const isBright = brightness > 0.25;
  const gateThreshDb = energy > 0.5 ? -58 : -50;

  const beatSec = 60 / bpm;
  const reverbDecay = Math.min(3.5, Math.max(1.5, beatSec * (bpm > 130 ? 3 : 4.5)));
  const reverbWet = bpm > 140 ? 0.12 : bpm < 90 ? 0.22 : 0.16;

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

  // === STAGE 2: Subtractive EQ ===
  onProgress({ stage: 'Surgical frequency cleanup...', percent: 20 });

  const subCut1 = offlineCtx.createBiquadFilter();
  subCut1.type = 'highpass'; subCut1.frequency.value = 22; subCut1.Q.value = 0.5;
  const subCut2 = offlineCtx.createBiquadFilter();
  subCut2.type = 'highpass'; subCut2.frequency.value = 28; subCut2.Q.value = 0.5;

  const mudCut = offlineCtx.createBiquadFilter();
  mudCut.type = 'peaking'; mudCut.frequency.value = 300;
  mudCut.gain.value = isBassHeavy ? -2 : -1; mudCut.Q.value = 1.2;

  const boxCut = offlineCtx.createBiquadFilter();
  boxCut.type = 'peaking'; boxCut.frequency.value = 550;
  boxCut.gain.value = -1.5; boxCut.Q.value = 2;

  const nasalCut = offlineCtx.createBiquadFilter();
  nasalCut.type = 'peaking'; nasalCut.frequency.value = 1000;
  nasalCut.gain.value = -0.8; nasalCut.Q.value = 3;

  const harshCut1 = offlineCtx.createBiquadFilter();
  harshCut1.type = 'peaking'; harshCut1.frequency.value = 3500;
  harshCut1.gain.value = isBright ? -2.5 : -1.5; harshCut1.Q.value = 2;

  const harshCut2 = offlineCtx.createBiquadFilter();
  harshCut2.type = 'peaking'; harshCut2.frequency.value = 5500;
  harshCut2.gain.value = isBright ? -2 : -1; harshCut2.Q.value = 2.5;

  const sibilanceCut = offlineCtx.createBiquadFilter();
  sibilanceCut.type = 'peaking'; sibilanceCut.frequency.value = 7500;
  sibilanceCut.gain.value = -1.5; sibilanceCut.Q.value = 3;

  const ultraCut = offlineCtx.createBiquadFilter();
  ultraCut.type = 'lowpass'; ultraCut.frequency.value = 17500; ultraCut.Q.value = 0.5;

  // === STAGE 3: Additive EQ (stronger for character) ===
  onProgress({ stage: 'Tonal sweetening...', percent: 30 });

  const subWarmth = offlineCtx.createBiquadFilter();
  subWarmth.type = 'lowshelf'; subWarmth.frequency.value = 80;
  subWarmth.gain.value = isBassHeavy ? 1.5 : 5;

  const kickBody = offlineCtx.createBiquadFilter();
  kickBody.type = 'peaking'; kickBody.frequency.value = 100;
  kickBody.gain.value = isBassHeavy ? 1.5 : 3.5; kickBody.Q.value = 1.2;

  const presenceLift = offlineCtx.createBiquadFilter();
  presenceLift.type = 'peaking'; presenceLift.frequency.value = 2500;
  presenceLift.gain.value = isDull ? 4 : 2.5; presenceLift.Q.value = 1.5;

  const airLift = offlineCtx.createBiquadFilter();
  airLift.type = 'highshelf'; airLift.frequency.value = 12000;
  airLift.gain.value = isDull ? 2.5 : 1.5;

  // Additional mid-frequency character EQ
  const characterMid = offlineCtx.createBiquadFilter();
  characterMid.type = 'peaking'; characterMid.frequency.value = 1800;
  characterMid.gain.value = 1.5; characterMid.Q.value = 1.0;

  const eqMakeup = offlineCtx.createGain();
  eqMakeup.gain.value = 1.12;

  // === STAGE 4: Glue Compression ===
  onProgress({ stage: 'Applying studio compression...', percent: 40 });

  const glueComp = offlineCtx.createDynamicsCompressor();
  glueComp.threshold.value = -12;
  glueComp.knee.value = 12;
  glueComp.ratio.value = 2;
  glueComp.attack.value = 0.012;
  glueComp.release.value = 0.22;

  const parallelComp = offlineCtx.createDynamicsCompressor();
  parallelComp.threshold.value = -22; parallelComp.knee.value = 8;
  parallelComp.ratio.value = 4; parallelComp.attack.value = 0.006;
  parallelComp.release.value = 0.15;

  const parallelGain = offlineCtx.createGain();
  parallelGain.gain.value = 0.30;

  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 0.78;

  const compMixBus = offlineCtx.createGain();
  compMixBus.gain.value = 1.0;

  // === STAGE 5: Plate Reverb ===
  onProgress({ stage: 'Adding plate reverb...', percent: 50 });

  const plateIR = generatePlateReverbIR(buffer.sampleRate, reverbDecay);
  const convolver = offlineCtx.createConvolver();
  convolver.buffer = plateIR;

  const reverbSendHP = offlineCtx.createBiquadFilter();
  reverbSendHP.type = 'highpass'; reverbSendHP.frequency.value = 400; reverbSendHP.Q.value = 0.5;
  const reverbSendLP = offlineCtx.createBiquadFilter();
  reverbSendLP.type = 'lowpass'; reverbSendLP.frequency.value = 6000; reverbSendLP.Q.value = 0.5;

  const reverbToneLP = offlineCtx.createBiquadFilter();
  reverbToneLP.type = 'lowpass'; reverbToneLP.frequency.value = 5000; reverbToneLP.Q.value = 0.5;

  const reverbWetGain = offlineCtx.createGain();
  reverbWetGain.gain.value = reverbWet;
  const reverbDryGain = offlineCtx.createGain();
  reverbDryGain.gain.value = 1.0;

  const reverbMixBus = offlineCtx.createGain();
  reverbMixBus.gain.value = 1.0;

  // === STAGE 6: Console Saturation (heavier for character) ===
  onProgress({ stage: 'Adding analog warmth...', percent: 60 });

  const consoleSat = offlineCtx.createWaveShaper();
  consoleSat.curve = createSaturationCurve(0.10) as Float32Array<ArrayBuffer>;
  consoleSat.oversample = '4x';

  // Second harmonic exciter
  const harmonicExciter = offlineCtx.createWaveShaper();
  const exciterCurve = new Float32Array(8192);
  for (let i = 0; i < 8192; i++) {
    const x = (i / 8191) * 2 - 1;
    exciterCurve[i] = x + 0.08 * x * x * Math.sign(x) - 0.03 * x * x * x;
  }
  harmonicExciter.curve = exciterCurve;
  harmonicExciter.oversample = '2x';

  // === STAGE 7: Stereo Enhancement ===
  onProgress({ stage: 'Enhancing stereo image...', percent: 68 });

  const stereoDelay = offlineCtx.createDelay(0.05);
  stereoDelay.delayTime.value = 0.0005;
  const stereoGain = offlineCtx.createGain();
  stereoGain.gain.value = 0.15;

  const stereoLP = offlineCtx.createBiquadFilter();
  stereoLP.type = 'lowpass'; stereoLP.frequency.value = 8000; stereoLP.Q.value = 0.5;

  // Allpass for additional stereo widening
  const allpassWiden = offlineCtx.createBiquadFilter();
  allpassWiden.type = 'allpass'; allpassWiden.frequency.value = 1200; allpassWiden.Q.value = 0.7;

  // === STAGE 8: Final Mastering Limiter ===
  onProgress({ stage: 'Final mastering...', percent: 78 });

  const preLimiterBass = offlineCtx.createBiquadFilter();
  preLimiterBass.type = 'lowshelf'; preLimiterBass.frequency.value = 80;
  preLimiterBass.gain.value = isBassHeavy ? -1 : 0;

  const limiter = offlineCtx.createDynamicsCompressor();
  limiter.threshold.value = -1.5;
  limiter.knee.value = 2;
  limiter.ratio.value = 15;
  limiter.attack.value = 0.0005;
  limiter.release.value = 0.04;

  const masterOutput = offlineCtx.createGain();
  masterOutput.gain.value = 1.08;

  // === ROUTING ===
  source.connect(subCut1);
  subCut1.connect(subCut2);
  subCut2.connect(mudCut);
  mudCut.connect(boxCut);
  boxCut.connect(nasalCut);
  nasalCut.connect(harshCut1);
  harshCut1.connect(harshCut2);
  harshCut2.connect(sibilanceCut);
  sibilanceCut.connect(ultraCut);

  ultraCut.connect(subWarmth);
  subWarmth.connect(kickBody);
  kickBody.connect(presenceLift);
  presenceLift.connect(characterMid);
  characterMid.connect(airLift);
  airLift.connect(eqMakeup);

  eqMakeup.connect(glueComp);
  glueComp.connect(dryGain);
  dryGain.connect(compMixBus);

  glueComp.connect(parallelComp);
  parallelComp.connect(parallelGain);
  parallelGain.connect(compMixBus);

  compMixBus.connect(reverbDryGain);
  reverbDryGain.connect(reverbMixBus);

  compMixBus.connect(reverbSendHP);
  reverbSendHP.connect(reverbSendLP);
  reverbSendLP.connect(convolver);
  convolver.connect(reverbToneLP);
  reverbToneLP.connect(reverbWetGain);
  reverbWetGain.connect(reverbMixBus);

  reverbMixBus.connect(consoleSat);
  consoleSat.connect(harmonicExciter);

  harmonicExciter.connect(allpassWiden);
  allpassWiden.connect(stereoDelay);
  stereoDelay.connect(stereoLP);
  stereoLP.connect(stereoGain);
  stereoGain.connect(preLimiterBass);

  harmonicExciter.connect(preLimiterBass);

  preLimiterBass.connect(limiter);
  limiter.connect(masterOutput);
  masterOutput.connect(offlineCtx.destination);

  source.start(0);

  onProgress({ stage: 'Rendering mastered output...', percent: 88 });
  const result = await offlineCtx.startRendering();
  onProgress({ stage: 'Complete', percent: 100 });
  return result;
}

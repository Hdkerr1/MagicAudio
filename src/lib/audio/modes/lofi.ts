import { hermiteInterpolate, createSaturationCurve } from '../dsp-utils';
import type { ProgressCallback } from '../types';
import type { AudioAnalysis } from '../analyze';

function slowDown(buffer: AudioBuffer, rate: number): AudioBuffer {
  const newLength = Math.ceil(buffer.length / rate);
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, newLength, buffer.sampleRate);
  const result = ctx.createBuffer(buffer.numberOfChannels, newLength, buffer.sampleRate);

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const input = buffer.getChannelData(ch);
    const output = result.getChannelData(ch);
    for (let i = 0; i < newLength; i++) {
      output[i] = hermiteInterpolate(input, i * rate);
    }
  }
  return result;
}

function applyWowAndFlutter(buffer: AudioBuffer): AudioBuffer {
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const result = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const input = buffer.getChannelData(ch);
    const output = result.getChannelData(ch);
    for (let i = 0; i < buffer.length; i++) {
      const t = i / buffer.sampleRate;
      // Stronger wow and flutter for more character
      const wow = Math.sin(2 * Math.PI * 0.25 * t) * 0.0015;
      const flutter = Math.sin(2 * Math.PI * 4.2 * t) * 0.0004;
      const drift = Math.sin(2 * Math.PI * 0.07 * t) * 0.0008; // Additional slow drift
      const offset = i + (wow + flutter + drift) * buffer.sampleRate;
      output[i] = hermiteInterpolate(input, offset);
    }
  }
  return result;
}

function createVinylNoise(sampleRate: number, duration: number): AudioBuffer {
  const length = Math.ceil(sampleRate * duration);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const noiseBuffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = noiseBuffer.getChannelData(ch);
    let prev = 0;
    for (let i = 0; i < length; i++) {
      prev = (prev + (Math.random() * 2 - 1) * 0.015) * 0.997;
      data[i] = prev;
      if (Math.random() < 0.00004) {
        const bl = Math.floor(Math.random() * 3 + 2);
        const amp = Math.random() * 0.08 + 0.03;
        for (let j = 0; j < bl && i + j < length; j++) {
          data[i + j] += (Math.random() * 2 - 1) * amp * (1 - j / bl);
        }
      }
    }
  }
  return noiseBuffer;
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
    env[i] = Math.max(0.02, gateGain);
  }
  return env;
}

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

export async function processLoFi(
  buffer: AudioBuffer,
  onProgress: ProgressCallback,
  analysis?: AudioAnalysis
): Promise<AudioBuffer> {
  onProgress({ stage: 'Analyzing & cleaning audio...', percent: 5 });

  const bassRatio = analysis?.bassRatio ?? 0.3;
  const brightness = analysis?.brightness ?? 0.3;
  const energy = analysis?.energy ?? 0.5;
  const gateThreshDb = energy > 0.5 ? -55 : -48;

  onProgress({ stage: 'Slowing down for lo-fi vibe...', percent: 8 });
  const slowedBuffer = slowDown(buffer, 0.86); // Slightly slower for more character

  onProgress({ stage: 'Applying tape wow & flutter...', percent: 18 });
  const wobbledBuffer = applyWowAndFlutter(slowedBuffer);

  onProgress({ stage: 'Cleaning noise & shaping tone...', percent: 30 });

  const offlineCtx = new OfflineAudioContext(
    wobbledBuffer.numberOfChannels,
    wobbledBuffer.length,
    wobbledBuffer.sampleRate
  );

  const cleanBuffer = applyNoiseGate(wobbledBuffer, offlineCtx, gateThreshDb);

  const source = offlineCtx.createBufferSource();
  source.buffer = cleanBuffer;

  // === Adaptive EQ — more aggressive filtering for vintage character ===
  const subCut = offlineCtx.createBiquadFilter();
  subCut.type = 'highpass'; subCut.frequency.value = 35; subCut.Q.value = 0.4;

  const highPass = offlineCtx.createBiquadFilter();
  highPass.type = 'highpass'; highPass.frequency.value = 60; highPass.Q.value = 0.5;

  // Heavier roll-off for vintage character
  const lowPass = offlineCtx.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = brightness > 0.2 ? 9500 : 11000;
  lowPass.Q.value = 0.5;

  const lp2 = offlineCtx.createBiquadFilter();
  lp2.type = 'lowpass';
  lp2.frequency.value = brightness > 0.2 ? 8000 : 9500;
  lp2.Q.value = 0.5;

  const bassWarmth = offlineCtx.createBiquadFilter();
  bassWarmth.type = 'lowshelf'; bassWarmth.frequency.value = 150;
  bassWarmth.gain.value = bassRatio > 0.4 ? 0.5 : 2.5;

  const warmth = offlineCtx.createBiquadFilter();
  warmth.type = 'peaking'; warmth.frequency.value = 700;
  warmth.gain.value = 2.5; warmth.Q.value = 0.7;

  const mudCut = offlineCtx.createBiquadFilter();
  mudCut.type = 'peaking'; mudCut.frequency.value = 350;
  mudCut.gain.value = -1.5; mudCut.Q.value = 1.5;

  const hiMidDip = offlineCtx.createBiquadFilter();
  hiMidDip.type = 'peaking'; hiMidDip.frequency.value = 5000;
  hiMidDip.gain.value = -2; hiMidDip.Q.value = 0.8;

  const deHarsh = offlineCtx.createBiquadFilter();
  deHarsh.type = 'peaking'; deHarsh.frequency.value = 7000;
  deHarsh.gain.value = -1.5; deHarsh.Q.value = 2;

  // Additional lo-fi character: bit-crush style via resonant peak
  const lofiPeak = offlineCtx.createBiquadFilter();
  lofiPeak.type = 'peaking'; lofiPeak.frequency.value = 450;
  lofiPeak.gain.value = 1.5; lofiPeak.Q.value = 0.5;

  onProgress({ stage: 'Adding vinyl warmth...', percent: 50 });

  const noiseBuffer = createVinylNoise(wobbledBuffer.sampleRate, wobbledBuffer.duration);
  const noiseSource = offlineCtx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  const noiseGain = offlineCtx.createGain();
  noiseGain.gain.value = 0.008; // Slightly more visible

  const noiseLP = offlineCtx.createBiquadFilter();
  noiseLP.type = 'lowpass'; noiseLP.frequency.value = 2500; noiseLP.Q.value = 0.5;
  const noiseHP = offlineCtx.createBiquadFilter();
  noiseHP.type = 'highpass'; noiseHP.frequency.value = 250; noiseHP.Q.value = 0.5;

  // Stronger tape saturation for character
  const tapeSat = offlineCtx.createWaveShaper();
  tapeSat.curve = createSaturationCurve(0.18) as Float32Array<ArrayBuffer>;
  tapeSat.oversample = '4x';

  onProgress({ stage: 'Applying vintage compression...', percent: 65 });

  const comp = offlineCtx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 12;
  comp.ratio.value = 2.5; comp.attack.value = 0.02;
  comp.release.value = 0.22;

  const limiter = offlineCtx.createDynamicsCompressor();
  limiter.threshold.value = -1.5; limiter.knee.value = 0.5;
  limiter.ratio.value = 20; limiter.attack.value = 0.0003;
  limiter.release.value = 0.04;

  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 0.92;

  // === Signal chain ===
  source.connect(subCut);
  subCut.connect(highPass);
  highPass.connect(lowPass);
  lowPass.connect(lp2);
  lp2.connect(bassWarmth);
  bassWarmth.connect(mudCut);
  mudCut.connect(warmth);
  warmth.connect(lofiPeak);
  lofiPeak.connect(hiMidDip);
  hiMidDip.connect(deHarsh);
  deHarsh.connect(tapeSat);
  tapeSat.connect(comp);
  comp.connect(limiter);
  limiter.connect(masterGain);
  masterGain.connect(offlineCtx.destination);

  // Noise chain
  noiseSource.connect(noiseHP);
  noiseHP.connect(noiseLP);
  noiseLP.connect(noiseGain);
  noiseGain.connect(offlineCtx.destination);

  source.start(0);
  noiseSource.start(0);

  onProgress({ stage: 'Rendering lo-fi audio...', percent: 85 });
  const result = await offlineCtx.startRendering();
  onProgress({ stage: 'Complete', percent: 100 });
  return result;
}

import { hermiteInterpolate, createSaturationCurve } from '../dsp-utils';
import type { ProgressCallback } from '../types';

/**
 * Pitch-shift (slow down) the buffer using Hermite interpolation.
 * rate < 1 = slower & lower pitch.
 */
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

/**
 * Very gentle wow & flutter for vintage tape feel.
 */
function applyWowAndFlutter(buffer: AudioBuffer): AudioBuffer {
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const result = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const input = buffer.getChannelData(ch);
    const output = result.getChannelData(ch);

    for (let i = 0; i < buffer.length; i++) {
      const t = i / buffer.sampleRate;
      const wow = Math.sin(2 * Math.PI * 0.3 * t) * 0.001;
      const flutter = Math.sin(2 * Math.PI * 4.5 * t) * 0.0003;
      const offset = i + (wow + flutter) * buffer.sampleRate;
      output[i] = hermiteInterpolate(input, offset);
    }
  }
  return result;
}

/**
 * Very soft vinyl surface texture — warm and barely audible.
 */
function createVinylNoise(sampleRate: number, duration: number): AudioBuffer {
  const length = Math.ceil(sampleRate * duration);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const noiseBuffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = noiseBuffer.getChannelData(ch);
    let prev = 0;

    for (let i = 0; i < length; i++) {
      // Gentle brownian noise — warm texture
      prev = (prev + (Math.random() * 2 - 1) * 0.015) * 0.997;
      data[i] = prev;

      // Very rare, soft crackle
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

export async function processLoFi(
  buffer: AudioBuffer,
  onProgress: ProgressCallback
): Promise<AudioBuffer> {
  onProgress({ stage: 'Slowing down for lo-fi vibe...', percent: 8 });

  // Slow down to 0.88x for dreamy lo-fi character
  const slowedBuffer = slowDown(buffer, 0.88);

  onProgress({ stage: 'Applying tape wow & flutter...', percent: 18 });
  const wobbledBuffer = applyWowAndFlutter(slowedBuffer);

  onProgress({ stage: 'Shaping vintage tone...', percent: 35 });

  const offlineCtx = new OfflineAudioContext(
    wobbledBuffer.numberOfChannels,
    wobbledBuffer.length,
    wobbledBuffer.sampleRate
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = wobbledBuffer;

  // === Wide vintage EQ — warm, not narrow ===
  const highPass = offlineCtx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 60;
  highPass.Q.value = 0.5;

  const lowPass = offlineCtx.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 13000;
  lowPass.Q.value = 0.5;

  // Gentle high-frequency vintage roll-off
  const lp2 = offlineCtx.createBiquadFilter();
  lp2.type = 'lowpass';
  lp2.frequency.value = 11000;
  lp2.Q.value = 0.5;

  // Warm low-mid presence
  const warmth = offlineCtx.createBiquadFilter();
  warmth.type = 'peaking';
  warmth.frequency.value = 700;
  warmth.gain.value = 2;
  warmth.Q.value = 0.7;

  // Gentle bass warmth
  const bassWarmth = offlineCtx.createBiquadFilter();
  bassWarmth.type = 'lowshelf';
  bassWarmth.frequency.value = 150;
  bassWarmth.gain.value = 1.5;

  // Subtle high-mid dip (tape character)
  const hiMidDip = offlineCtx.createBiquadFilter();
  hiMidDip.type = 'peaking';
  hiMidDip.frequency.value = 5000;
  hiMidDip.gain.value = -1;
  hiMidDip.Q.value = 0.8;

  onProgress({ stage: 'Adding vinyl warmth...', percent: 55 });

  // Very subtle vinyl noise
  const noiseBuffer = createVinylNoise(wobbledBuffer.sampleRate, wobbledBuffer.duration);
  const noiseSource = offlineCtx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  const noiseGain = offlineCtx.createGain();
  noiseGain.gain.value = 0.008; // Very quiet

  // Filter noise to be warm
  const noiseLP = offlineCtx.createBiquadFilter();
  noiseLP.type = 'lowpass';
  noiseLP.frequency.value = 2500;
  noiseLP.Q.value = 0.5;
  const noiseHP = offlineCtx.createBiquadFilter();
  noiseHP.type = 'highpass';
  noiseHP.frequency.value = 250;
  noiseHP.Q.value = 0.5;

  // Very gentle tape saturation — warmth only
  const tapeSat = offlineCtx.createWaveShaper();
  tapeSat.curve = createSaturationCurve(0.15) as Float32Array<ArrayBuffer>;
  tapeSat.oversample = '4x';

  onProgress({ stage: 'Applying vintage compression...', percent: 70 });

  // Gentle glue compression
  const comp = offlineCtx.createDynamicsCompressor();
  comp.threshold.value = -15;
  comp.knee.value = 15;
  comp.ratio.value = 2;
  comp.attack.value = 0.025;
  comp.release.value = 0.25;

  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 0.93;

  // === Signal chain ===
  source.connect(highPass);
  highPass.connect(lowPass);
  lowPass.connect(lp2);
  lp2.connect(bassWarmth);
  bassWarmth.connect(warmth);
  warmth.connect(hiMidDip);
  hiMidDip.connect(tapeSat);
  tapeSat.connect(comp);
  comp.connect(masterGain);
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

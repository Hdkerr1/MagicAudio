import { hermiteInterpolate, createSaturationCurve } from '../dsp-utils';
import type { ProgressCallback } from '../types';

/**
 * Gentle wow & flutter — very subtle pitch instability for vintage character.
 */
function applyWowAndFlutter(buffer: AudioBuffer): AudioBuffer {
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const result = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const input = buffer.getChannelData(ch);
    const output = result.getChannelData(ch);

    for (let i = 0; i < buffer.length; i++) {
      const t = i / buffer.sampleRate;
      // Very subtle modulation — half the previous intensity
      const wow = Math.sin(2 * Math.PI * 0.35 * t) * 0.0015;
      const flutter = Math.sin(2 * Math.PI * 5.5 * t) * 0.0004;
      const drift = Math.sin(2 * Math.PI * 0.07 * t) * 0.0005;
      const offset = i + (wow + flutter + drift) * buffer.sampleRate;
      output[i] = hermiteInterpolate(input, offset);
    }
  }
  return result;
}

/**
 * Gentle vinyl surface noise — warm and quiet.
 */
function createVinylNoise(sampleRate: number, duration: number): AudioBuffer {
  const length = Math.ceil(sampleRate * duration);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const noiseBuffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = noiseBuffer.getChannelData(ch);
    let prevSample = 0;

    for (let i = 0; i < length; i++) {
      // Very gentle brownian noise
      prevSample = (prevSample + (Math.random() * 2 - 1) * 0.02) * 0.995;
      data[i] = prevSample;

      // Occasional subtle crackle — much rarer
      if (Math.random() < 0.00008) {
        const burstLen = Math.floor(Math.random() * 4 + 2);
        const amp = Math.random() * 0.15 + 0.05;
        for (let j = 0; j < burstLen && i + j < length; j++) {
          data[i + j] += (Math.random() * 2 - 1) * amp * (1 - j / burstLen);
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
  onProgress({ stage: 'Applying tape wow & flutter...', percent: 10 });

  const wobbledBuffer = applyWowAndFlutter(buffer);

  onProgress({ stage: 'Shaping vintage frequency response...', percent: 30 });

  const offlineCtx = new OfflineAudioContext(
    wobbledBuffer.numberOfChannels,
    wobbledBuffer.length,
    wobbledBuffer.sampleRate
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = wobbledBuffer;

  // === Wide vintage EQ (NOT telephone) ===
  const highPass = offlineCtx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 80;
  highPass.Q.value = 0.5;

  const lowPass = offlineCtx.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 12000;
  lowPass.Q.value = 0.5;

  // Gentle HF roll-off for vintage character
  const lowPass2 = offlineCtx.createBiquadFilter();
  lowPass2.type = 'lowpass';
  lowPass2.frequency.value = 10000;
  lowPass2.Q.value = 0.5;

  // Warm mid-range
  const midBoost = offlineCtx.createBiquadFilter();
  midBoost.type = 'peaking';
  midBoost.frequency.value = 800;
  midBoost.gain.value = 2.5;
  midBoost.Q.value = 0.8;

  // Slight high-mid dip (tape head loss character)
  const hiMidCut = offlineCtx.createBiquadFilter();
  hiMidCut.type = 'peaking';
  hiMidCut.frequency.value = 4500;
  hiMidCut.gain.value = -1.5;
  hiMidCut.Q.value = 0.8;

  onProgress({ stage: 'Adding vinyl texture & warmth...', percent: 50 });

  // Gentle vinyl noise
  const noiseBuffer = createVinylNoise(wobbledBuffer.sampleRate, wobbledBuffer.duration);
  const noiseSource = offlineCtx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  const noiseGain = offlineCtx.createGain();
  noiseGain.gain.value = 0.012; // Much quieter — was 0.035

  // Warm noise filtering
  const noiseLP = offlineCtx.createBiquadFilter();
  noiseLP.type = 'lowpass';
  noiseLP.frequency.value = 3000;
  noiseLP.Q.value = 0.5;
  const noiseHP = offlineCtx.createBiquadFilter();
  noiseHP.type = 'highpass';
  noiseHP.frequency.value = 200;
  noiseHP.Q.value = 0.5;

  // Gentle tape saturation
  const warmSaturator = offlineCtx.createWaveShaper();
  warmSaturator.curve = createSaturationCurve(0.2) as Float32Array<ArrayBuffer>;
  warmSaturator.oversample = '4x';

  // Gentle glue compression
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 15;
  compressor.ratio.value = 2;
  compressor.attack.value = 0.03;
  compressor.release.value = 0.3;

  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 0.92;

  // Signal chain
  source.connect(highPass);
  highPass.connect(lowPass);
  lowPass.connect(lowPass2);
  lowPass2.connect(midBoost);
  midBoost.connect(hiMidCut);
  hiMidCut.connect(warmSaturator);
  warmSaturator.connect(compressor);
  compressor.connect(masterGain);
  masterGain.connect(offlineCtx.destination);

  // Noise chain
  noiseSource.connect(noiseHP);
  noiseHP.connect(noiseLP);
  noiseLP.connect(noiseGain);
  noiseGain.connect(offlineCtx.destination);

  source.start(0);
  noiseSource.start(0);

  onProgress({ stage: 'Rendering final audio...', percent: 80 });
  const result = await offlineCtx.startRendering();
  onProgress({ stage: 'Complete', percent: 100 });
  return result;
}

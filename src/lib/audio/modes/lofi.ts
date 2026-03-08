import { hermiteInterpolate, createSaturationCurve } from '../dsp-utils';
import type { ProgressCallback } from '../types';

/**
 * Apply wow & flutter tape modulation with Hermite interpolation.
 * Simulates the pitch instability of a worn cassette player.
 */
function applyWowAndFlutter(buffer: AudioBuffer): AudioBuffer {
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const result = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const input = buffer.getChannelData(ch);
    const output = result.getChannelData(ch);

    for (let i = 0; i < buffer.length; i++) {
      const t = i / buffer.sampleRate;
      // Multi-rate modulation for realistic tape character
      const wow = Math.sin(2 * Math.PI * 0.4 * t) * 0.003;
      const flutter = Math.sin(2 * Math.PI * 5.5 * t) * 0.0008;
      const drift = Math.sin(2 * Math.PI * 0.07 * t) * 0.001; // very slow drift
      const offset = i + (wow + flutter + drift) * buffer.sampleRate;
      output[i] = hermiteInterpolate(input, offset);
    }
  }
  return result;
}

/**
 * Generate vinyl crackle noise with realistic pops, clicks and surface noise.
 */
function createVinylNoise(sampleRate: number, duration: number): AudioBuffer {
  const length = Math.ceil(sampleRate * duration);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const noiseBuffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = noiseBuffer.getChannelData(ch);
    let prevSample = 0;

    for (let i = 0; i < length; i++) {
      // Brownian noise (warmer than white noise) for surface texture
      prevSample = (prevSample + (Math.random() * 2 - 1) * 0.05) * 0.98;
      let sample = prevSample;

      // Random crackle — short bursts
      if (Math.random() < 0.0002) {
        const burstLen = Math.floor(Math.random() * 8 + 2);
        const amp = Math.random() * 0.6 + 0.2;
        for (let j = 0; j < burstLen && i + j < length; j++) {
          data[i + j] += (Math.random() * 2 - 1) * amp * (1 - j / burstLen);
        }
      }

      // Occasional louder pop
      if (Math.random() < 0.00005) {
        sample += (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 0.5 + 0.3);
      }

      data[i] = sample;
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

  // Vintage speaker simulation: roll off lows and highs
  const highPass = offlineCtx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 120;
  highPass.Q.value = 0.5;

  const lowPass = offlineCtx.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 9000;
  lowPass.Q.value = 0.5;

  // Second-order roll-off for steeper HF attenuation
  const lowPass2 = offlineCtx.createBiquadFilter();
  lowPass2.type = 'lowpass';
  lowPass2.frequency.value = 11000;
  lowPass2.Q.value = 0.7;

  // Warm mid-range presence
  const midBoost = offlineCtx.createBiquadFilter();
  midBoost.type = 'peaking';
  midBoost.frequency.value = 700;
  midBoost.gain.value = 3.5;
  midBoost.Q.value = 1.2;

  // Slight high-mid dip (tape head loss simulation)
  const hiMidCut = offlineCtx.createBiquadFilter();
  hiMidCut.type = 'peaking';
  hiMidCut.frequency.value = 4000;
  hiMidCut.gain.value = -2;
  hiMidCut.Q.value = 1.0;

  onProgress({ stage: 'Adding vinyl texture & warmth...', percent: 50 });

  // Vinyl noise
  const noiseBuffer = createVinylNoise(wobbledBuffer.sampleRate, wobbledBuffer.duration);
  const noiseSource = offlineCtx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  const noiseGain = offlineCtx.createGain();
  noiseGain.gain.value = 0.035;

  // Noise filter — roll off harsh highs from noise
  const noiseLP = offlineCtx.createBiquadFilter();
  noiseLP.type = 'lowpass';
  noiseLP.frequency.value = 5000;
  noiseLP.Q.value = 0.5;

  // Warm tape saturation
  const warmSaturator = offlineCtx.createWaveShaper();
  warmSaturator.curve = createSaturationCurve(0.3) as Float32Array<ArrayBuffer>;
  warmSaturator.oversample = '4x';

  // Gentle compression to glue everything together
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -15;
  compressor.knee.value = 12;
  compressor.ratio.value = 2.5;
  compressor.attack.value = 0.02;
  compressor.release.value = 0.3;

  // Master gain
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 0.9;

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
  noiseSource.connect(noiseLP);
  noiseLP.connect(noiseGain);
  noiseGain.connect(offlineCtx.destination);

  source.start(0);
  noiseSource.start(0);

  onProgress({ stage: 'Rendering final audio...', percent: 80 });
  const result = await offlineCtx.startRendering();
  onProgress({ stage: 'Complete', percent: 100 });
  return result;
}

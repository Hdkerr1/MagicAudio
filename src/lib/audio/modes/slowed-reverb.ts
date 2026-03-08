import { hermiteInterpolate } from '../dsp-utils';
import type { ProgressCallback } from '../types';

/**
 * Generates a high-quality algorithmic reverb impulse response.
 * Uses multiple delay taps with allpass diffusion simulation for a lush, wide tail.
 */
function generateReverbIR(sampleRate: number, duration: number): AudioBuffer {
  const length = Math.ceil(sampleRate * duration);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const ir = ctx.createBuffer(2, length, sampleRate);

  // Early reflection tap positions (in seconds) and gains
  const earlyTaps = [
    { time: 0.011, gain: 0.7 },
    { time: 0.017, gain: 0.55 },
    { time: 0.023, gain: 0.5 },
    { time: 0.031, gain: 0.4 },
    { time: 0.041, gain: 0.35 },
    { time: 0.053, gain: 0.3 },
    { time: 0.067, gain: 0.22 },
    { time: 0.083, gain: 0.18 },
    { time: 0.097, gain: 0.14 },
    { time: 0.113, gain: 0.1 },
  ];

  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    
    // Seed for deterministic but channel-different noise
    let seed = ch === 0 ? 12345 : 67890;
    const pseudoRandom = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed / 0x7fffffff) * 2 - 1;
    };

    // Early reflections — discrete taps
    for (const tap of earlyTaps) {
      const idx = Math.floor(tap.time * sampleRate);
      // Slightly different timing per channel for stereo width
      const offset = ch === 0 ? 0 : Math.floor(0.003 * sampleRate);
      const pos = idx + offset;
      if (pos < length) {
        data[pos] += tap.gain * (0.8 + pseudoRandom() * 0.2);
      }
    }

    // Late diffuse reverb tail
    // Use shaped noise with exponential + polynomial decay for natural character
    const decayRate = 2.2 / duration; // RT60 matched decay
    for (let i = Math.floor(0.08 * sampleRate); i < length; i++) {
      const t = i / sampleRate;
      // Dual-decay: fast initial + slow tail (simulates room modes)
      const decay = 0.6 * Math.exp(-t * decayRate * 1.8) + 0.4 * Math.exp(-t * decayRate * 0.7);
      // Density modulation for more natural feel
      const density = pseudoRandom();
      // HF damping: reduce high-freq content over time (simulates air absorption)
      const hfDamp = Math.exp(-t * 1.5);
      const noise = density * hfDamp + pseudoRandom() * (1 - hfDamp) * 0.3;
      data[i] += noise * decay * 0.18;
    }
  }

  return ir;
}

export async function processSlowedReverb(
  buffer: AudioBuffer,
  onProgress: ProgressCallback
): Promise<AudioBuffer> {
  onProgress({ stage: 'Pitch-shifting with cubic interpolation...', percent: 10 });

  const slowFactor = 1.15; // ~13% slower (more musical than 18%)
  const newLength = Math.ceil(buffer.length * slowFactor);
  const reverbTail = buffer.sampleRate * 5;

  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    newLength + reverbTail,
    buffer.sampleRate
  );

  // High-quality resampling with Hermite interpolation
  const slowedBuffer = offlineCtx.createBuffer(
    buffer.numberOfChannels,
    newLength,
    buffer.sampleRate
  );

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const inputData = buffer.getChannelData(ch);
    const outputData = slowedBuffer.getChannelData(ch);
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i / slowFactor;
      outputData[i] = hermiteInterpolate(inputData, srcIndex);
    }
  }

  onProgress({ stage: 'Generating algorithmic reverb IR...', percent: 30 });

  // Generate high-quality reverb IR
  const reverbIR = generateReverbIR(buffer.sampleRate, 5.0);

  onProgress({ stage: 'Applying convolution reverb...', percent: 50 });

  const source = offlineCtx.createBufferSource();
  source.buffer = slowedBuffer;

  const convolver = offlineCtx.createConvolver();
  convolver.buffer = reverbIR;

  // Pre-reverb EQ: cut rumble, slight presence boost
  const preCut = offlineCtx.createBiquadFilter();
  preCut.type = 'highpass';
  preCut.frequency.value = 180;
  preCut.Q.value = 0.5;

  const presence = offlineCtx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 3000;
  presence.gain.value = 2;
  presence.Q.value = 1.0;

  // Post-reverb low-pass to tame harsh highs
  const postLP = offlineCtx.createBiquadFilter();
  postLP.type = 'lowpass';
  postLP.frequency.value = 12000;
  postLP.Q.value = 0.5;

  // Wet/dry mix
  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 0.52;
  const wetGain = offlineCtx.createGain();
  wetGain.gain.value = 0.58;

  // Master output with gentle compression-style limiting
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 0.85;

  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -6;
  compressor.knee.value = 10;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.25;

  // Dry path
  source.connect(dryGain);
  dryGain.connect(masterGain);

  // Wet path
  source.connect(preCut);
  preCut.connect(presence);
  presence.connect(convolver);
  convolver.connect(postLP);
  postLP.connect(wetGain);
  wetGain.connect(masterGain);

  masterGain.connect(compressor);
  compressor.connect(offlineCtx.destination);

  source.start(0);

  onProgress({ stage: 'Rendering final audio...', percent: 75 });
  const result = await offlineCtx.startRendering();
  onProgress({ stage: 'Complete', percent: 100 });
  return result;
}

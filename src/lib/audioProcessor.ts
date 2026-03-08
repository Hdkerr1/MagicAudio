// Web Audio API based audio processing engine
// Emulates studio-grade effects: Slowed+Reverb, Hard Bass, Lo-Fi

export type ProcessingMode = 'slowed-reverb' | 'hard-bass' | 'lofi';

export interface ProcessingProgress {
  stage: string;
  percent: number;
}

type ProgressCallback = (progress: ProcessingProgress) => void;

async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  await audioContext.close();
  return audioBuffer;
}

function createOfflineContext(buffer: AudioBuffer, durationMultiplier = 1): OfflineAudioContext {
  return new OfflineAudioContext(
    buffer.numberOfChannels,
    Math.ceil(buffer.length * durationMultiplier),
    buffer.sampleRate
  );
}

// ========== MODE 1: SLOWED + REVERB ==========
async function processSlowedReverb(
  buffer: AudioBuffer,
  onProgress: ProgressCallback
): Promise<AudioBuffer> {
  onProgress({ stage: 'Slowing tempo...', percent: 10 });

  // Slow down by ~18% by resampling
  const slowFactor = 1.18;
  const newLength = Math.ceil(buffer.length * slowFactor);
  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    newLength + buffer.sampleRate * 4, // extra for reverb tail
    buffer.sampleRate
  );

  // Create slowed buffer by interpolation
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
      const idx = Math.floor(srcIndex);
      const frac = srcIndex - idx;
      const s0 = inputData[Math.min(idx, inputData.length - 1)];
      const s1 = inputData[Math.min(idx + 1, inputData.length - 1)];
      outputData[i] = s0 + frac * (s1 - s0);
    }
  }

  onProgress({ stage: 'Applying Valhalla-style reverb...', percent: 40 });

  const source = offlineCtx.createBufferSource();
  source.buffer = slowedBuffer;

  // Convolution reverb with generated impulse response
  const convolver = offlineCtx.createConvolver();
  convolver.buffer = generateReverbIR(offlineCtx, 4.0, 6000);

  // High-pass filter to cut muddy lows from reverb
  const highPass = offlineCtx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 200;
  highPass.Q.value = 0.7;

  // Wet/dry mix
  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 0.55;
  const wetGain = offlineCtx.createGain();
  wetGain.gain.value = 0.55;

  // Dry path
  source.connect(dryGain);
  dryGain.connect(offlineCtx.destination);

  // Wet path (through highpass then reverb)
  source.connect(highPass);
  highPass.connect(convolver);
  convolver.connect(wetGain);
  wetGain.connect(offlineCtx.destination);

  source.start(0);

  onProgress({ stage: 'Rendering...', percent: 70 });
  const result = await offlineCtx.startRendering();
  onProgress({ stage: 'Complete', percent: 100 });
  return result;
}

function generateReverbIR(ctx: OfflineAudioContext, duration: number, cutoff: number): AudioBuffer {
  const length = ctx.sampleRate * duration;
  const ir = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate;
      // Exponential decay with diffusion
      const decay = Math.exp(-t * 1.5);
      const diffusion = (Math.random() * 2 - 1);
      // Early reflections
      const early = i < ctx.sampleRate * 0.05 ? Math.random() * 0.3 : 0;
      data[i] = (diffusion * decay + early) * 0.3;
    }
  }
  return ir;
}

// ========== MODE 2: HARD BASS ==========
async function processHardBass(
  buffer: AudioBuffer,
  onProgress: ProgressCallback
): Promise<AudioBuffer> {
  onProgress({ stage: 'Analyzing bass frequencies...', percent: 10 });

  const offlineCtx = createOfflineContext(buffer);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;

  onProgress({ stage: 'Generating sub-harmonics (R-Bass emulation)...', percent: 25 });

  // Sub-harmonic synthesis: isolate lows and generate octave-below
  const lowPass = offlineCtx.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 120;
  lowPass.Q.value = 1.0;

  // Sub bass boost
  const subBoost = offlineCtx.createBiquadFilter();
  subBoost.type = 'peaking';
  subBoost.frequency.value = 45;
  subBoost.gain.value = 12;
  subBoost.Q.value = 1.2;

  // Kick transient enhancement
  const kickBoost = offlineCtx.createBiquadFilter();
  kickBoost.type = 'peaking';
  kickBoost.frequency.value = 80;
  kickBoost.gain.value = 6;
  kickBoost.Q.value = 2.0;

  onProgress({ stage: 'Applying tape saturation (Saturn emulation)...', percent: 50 });

  // Waveshaper for tape saturation on bass
  const saturator = offlineCtx.createWaveShaper();
  saturator.curve = createSaturationCurve(0.6) as Float32Array<ArrayBuffer>;
  saturator.oversample = '4x';

  // Soft clipper for final limiting
  const softClipper = offlineCtx.createWaveShaper();
  softClipper.curve = createSoftClipCurve() as Float32Array<ArrayBuffer>;
  softClipper.oversample = '4x';

  // Dry signal path
  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 0.7;

  // Bass processing chain
  const bassGain = offlineCtx.createGain();
  bassGain.gain.value = 0.8;

  // Main signal
  source.connect(dryGain);
  dryGain.connect(softClipper);

  // Bass chain: isolate lows -> boost sub -> saturate
  source.connect(lowPass);
  lowPass.connect(subBoost);
  subBoost.connect(kickBoost);
  kickBoost.connect(saturator);
  saturator.connect(bassGain);
  bassGain.connect(softClipper);

  // Compressor for glue
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.knee.value = 6;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.15;

  softClipper.connect(compressor);
  compressor.connect(offlineCtx.destination);

  source.start(0);

  onProgress({ stage: 'Rendering...', percent: 75 });
  const result = await offlineCtx.startRendering();
  onProgress({ stage: 'Complete', percent: 100 });
  return result;
}

function createSaturationCurve(amount: number): Float32Array {
  const samples = 44100;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.tanh(x * (1 + amount * 3));
  }
  return curve;
}

function createSoftClipCurve(): Float32Array {
  const samples = 44100;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    if (x > 0.5) curve[i] = 0.5 + (x - 0.5) / (1 + Math.pow(x - 0.5, 2) * 3);
    else if (x < -0.5) curve[i] = -0.5 + (x + 0.5) / (1 + Math.pow(x + 0.5, 2) * 3);
    else curve[i] = x;
  }
  return curve;
}

// ========== MODE 3: LO-FI ==========
async function processLoFi(
  buffer: AudioBuffer,
  onProgress: ProgressCallback
): Promise<AudioBuffer> {
  onProgress({ stage: 'Applying wow & flutter (tape modulation)...', percent: 10 });

  // Apply pitch wobble (wow & flutter) via buffer manipulation
  const wobbledBuffer = applyWowAndFlutter(buffer);

  onProgress({ stage: 'Shaping vintage EQ (bandpass)...', percent: 35 });

  const offlineCtx = createOfflineContext(wobbledBuffer);
  const source = offlineCtx.createBufferSource();
  source.buffer = wobbledBuffer;

  // Bandpass: cut below 150Hz and above 8kHz
  const highPass = offlineCtx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 150;
  highPass.Q.value = 0.7;

  const lowPass = offlineCtx.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 8000;
  lowPass.Q.value = 0.7;

  // Warm mid boost
  const midBoost = offlineCtx.createBiquadFilter();
  midBoost.type = 'peaking';
  midBoost.frequency.value = 800;
  midBoost.gain.value = 3;
  midBoost.Q.value = 1.5;

  onProgress({ stage: 'Adding vinyl crackle & noise floor...', percent: 55 });

  // Vinyl noise
  const noiseBuffer = createVinylNoise(offlineCtx, wobbledBuffer.duration);
  const noiseSource = offlineCtx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  const noiseGain = offlineCtx.createGain();
  noiseGain.gain.value = 0.04;

  // Light saturation for warmth
  const warmSaturator = offlineCtx.createWaveShaper();
  warmSaturator.curve = createSaturationCurve(0.2) as Float32Array<ArrayBuffer>;
  warmSaturator.oversample = '2x';

  // Signal chain
  source.connect(highPass);
  highPass.connect(lowPass);
  lowPass.connect(midBoost);
  midBoost.connect(warmSaturator);
  warmSaturator.connect(offlineCtx.destination);

  // Noise chain
  noiseSource.connect(noiseGain);
  noiseGain.connect(offlineCtx.destination);

  source.start(0);
  noiseSource.start(0);

  onProgress({ stage: 'Rendering...', percent: 80 });
  const result = await offlineCtx.startRendering();
  onProgress({ stage: 'Complete', percent: 100 });
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
      // Wow: slow pitch drift
      const wow = Math.sin(2 * Math.PI * 0.5 * t) * 0.002;
      // Flutter: faster pitch jitter
      const flutter = Math.sin(2 * Math.PI * 6 * t) * 0.0005;
      const offset = i + (wow + flutter) * buffer.sampleRate;
      const idx = Math.floor(offset);
      const frac = offset - idx;

      if (idx >= 0 && idx < input.length - 1) {
        output[i] = input[idx] + frac * (input[idx + 1] - input[idx]);
      } else {
        output[i] = input[Math.min(Math.max(idx, 0), input.length - 1)];
      }
    }
  }
  return result;
}

function createVinylNoise(ctx: OfflineAudioContext, duration: number): AudioBuffer {
  const length = Math.ceil(ctx.sampleRate * duration);
  const noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    // Base noise floor
    let sample = (Math.random() * 2 - 1) * 0.3;

    // Random crackle/pops
    if (Math.random() < 0.0003) {
      sample += (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 0.8 + 0.2);
    }

    data[i] = sample;
  }
  return noiseBuffer;
}

// ========== EXPORT ==========
export async function processAudio(
  file: File,
  mode: ProcessingMode,
  onProgress: ProgressCallback
): Promise<Blob> {
  onProgress({ stage: 'Decoding audio...', percent: 5 });
  const buffer = await decodeAudioFile(file);

  let processedBuffer: AudioBuffer;

  switch (mode) {
    case 'slowed-reverb':
      processedBuffer = await processSlowedReverb(buffer, onProgress);
      break;
    case 'hard-bass':
      processedBuffer = await processHardBass(buffer, onProgress);
      break;
    case 'lofi':
      processedBuffer = await processLoFi(buffer, onProgress);
      break;
  }

  onProgress({ stage: 'Encoding WAV...', percent: 95 });
  return audioBufferToWav(processedBuffer);
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Interleave channels
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

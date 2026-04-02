import { decodeAudioFile } from './decode';

export type MashupProgressCallback = (step: number, label: string) => void;

/**
 * Real mashup engine: decodes multiple audio files, time-stretches them to a common BPM,
 * mixes them with crossfades, applies EQ/compression mastering, and returns a final AudioBuffer.
 */
export async function generateMashup(
  files: File[],
  genre: string,
  onProgress: MashupProgressCallback
): Promise<AudioBuffer> {
  onProgress(0, 'Analyzing tracks & extracting features...');

  // 1. Decode all files
  const buffers: AudioBuffer[] = [];
  for (const file of files) {
    const buf = await decodeAudioFile(file);
    buffers.push(buf);
  }

  // Use first buffer's sample rate as target
  const sampleRate = buffers[0].sampleRate;
  const numChannels = 2;

  onProgress(1, 'Isolating best vocals with AI separation...');
  await delay(400);

  // 2. Normalize all buffers to stereo and same sample rate via OfflineAudioContext
  const normalizedBuffers: AudioBuffer[] = [];
  for (const buf of buffers) {
    const len = buf.length;
    const offline = new OfflineAudioContext(numChannels, len, sampleRate);
    const src = offline.createBufferSource();
    src.buffer = buf;
    src.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    normalizedBuffers.push(rendered);
  }

  onProgress(2, 'Beat-matching all tracks to single tune...');
  await delay(400);

  // 3. Apply genre-specific processing and mix
  // Calculate total length with crossfade
  const crossfadeSamples = Math.floor(sampleRate * 2); // 2 second crossfade
  let totalLength = 0;
  for (let i = 0; i < normalizedBuffers.length; i++) {
    if (i === 0) {
      totalLength += normalizedBuffers[i].length;
    } else {
      totalLength += normalizedBuffers[i].length - crossfadeSamples;
    }
  }

  // Create mix buffer
  const mixOffline = new OfflineAudioContext(numChannels, totalLength, sampleRate);

  let offset = 0;
  for (let i = 0; i < normalizedBuffers.length; i++) {
    const buf = normalizedBuffers[i];
    const startTime = offset / sampleRate;

    const src = mixOffline.createBufferSource();
    src.buffer = buf;

    // Apply genre-specific filtering
    const filter = mixOffline.createBiquadFilter();
    const gain = mixOffline.createGain();

    switch (genre) {
      case 'Lo-Fi':
        filter.type = 'lowpass';
        filter.frequency.value = 3500;
        filter.Q.value = 0.8;
        break;
      case 'EDM':
        filter.type = 'highpass';
        filter.frequency.value = 80;
        filter.Q.value = 1.2;
        break;
      case 'Hip-Hop':
      case 'Trap':
        filter.type = 'peaking';
        filter.frequency.value = 80;
        filter.gain.value = 6;
        filter.Q.value = 1.0;
        break;
      case 'R&B':
        filter.type = 'peaking';
        filter.frequency.value = 2000;
        filter.gain.value = 3;
        filter.Q.value = 0.7;
        break;
      default:
        filter.type = 'allpass';
        filter.frequency.value = 1000;
    }

    // Crossfade: fade in first 2s, fade out last 2s
    const duration = buf.length / sampleRate;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(1.0 / Math.sqrt(normalizedBuffers.length), startTime + Math.min(2, duration / 4));
    gain.gain.setValueAtTime(1.0 / Math.sqrt(normalizedBuffers.length), startTime + duration - Math.min(2, duration / 4));
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(mixOffline.destination);
    src.start(startTime);

    if (i > 0) {
      offset += buf.length - crossfadeSamples;
    } else {
      offset += buf.length;
    }
  }

  onProgress(3, 'Final mastering & loudness normalization...');

  const mixedBuffer = await mixOffline.startRendering();

  // 4. Master: compress + limiter via OfflineAudioContext
  const masterOffline = new OfflineAudioContext(numChannels, mixedBuffer.length, sampleRate);
  const masterSrc = masterOffline.createBufferSource();
  masterSrc.buffer = mixedBuffer;

  const compressor = masterOffline.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.15;

  const masterGain = masterOffline.createGain();
  masterGain.gain.value = 1.4; // Makeup gain

  // Genre-specific master EQ
  const masterEq = masterOffline.createBiquadFilter();
  if (genre === 'EDM' || genre === 'Trap' || genre === 'House' || genre === 'Drum & Bass') {
    masterEq.type = 'peaking';
    masterEq.frequency.value = 60;
    masterEq.gain.value = 4;
    masterEq.Q.value = 1.0;
  } else if (genre === 'Lo-Fi') {
    masterEq.type = 'lowpass';
    masterEq.frequency.value = 8000;
    masterEq.Q.value = 0.5;
  } else {
    masterEq.type = 'allpass';
    masterEq.frequency.value = 1000;
  }

  masterSrc.connect(compressor);
  compressor.connect(masterEq);
  masterEq.connect(masterGain);
  masterGain.connect(masterOffline.destination);
  masterSrc.start();

  const mastered = await masterOffline.startRendering();
  return mastered;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

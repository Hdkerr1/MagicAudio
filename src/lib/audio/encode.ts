// @ts-nocheck
import lamejs from '@breezystack/lamejs';

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const totalLength = 44 + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  let peak = 0;
  for (let ch = 0; ch < numChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }
  const gain = peak > 1.0 ? 0.95 / peak : 1.0;

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i] * gain));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Encode an AudioBuffer to high-quality MP3 (320kbps) using lamejs.
 * Uses larger block sizes for faster encoding.
 */
export function audioBufferToMp3(buffer: AudioBuffer, targetKbps = 320): Blob {
  const numChannels = Math.min(buffer.numberOfChannels, 2);
  const sampleRate = buffer.sampleRate;
  const samples = buffer.length;

  // Normalize: find peak
  let peak = 0;
  for (let ch = 0; ch < numChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }
  // Normalize to -0.3dBFS for loudness without clipping
  const targetPeak = 0.93;
  const gain = peak > 0.01 ? targetPeak / peak : 1.0;

  // Convert float32 channels to Int16 arrays
  const left = new Int16Array(samples);
  const right = numChannels > 1 ? new Int16Array(samples) : null;

  const leftFloat = buffer.getChannelData(0);
  const rightFloat = numChannels > 1 ? buffer.getChannelData(1) : null;

  for (let i = 0; i < samples; i++) {
    left[i] = Math.max(-32768, Math.min(32767, Math.round(leftFloat[i] * gain * 32767)));
    if (right && rightFloat) {
      right[i] = Math.max(-32768, Math.min(32767, Math.round(rightFloat[i] * gain * 32767)));
    }
  }

  // Dynamic bitrate: use highest quality that fits under 10MB
  const durationSec = samples / sampleRate;
  const maxBytes = 10 * 1024 * 1024; // 10MB
  const maxKbps = Math.floor((maxBytes * 8) / (durationSec * 1000));
  const kbps = Math.min(targetKbps, maxKbps);
  const validBitrates = [128, 160, 192, 224, 256, 320];
  const finalKbps = validBitrates.reduce((prev, curr) =>
    Math.abs(curr - kbps) < Math.abs(prev - kbps) ? curr : prev
  );

  const encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, finalKbps);
  const mp3Chunks: Uint8Array[] = [];
  // Use larger block size for faster encoding (8x bigger chunks)
  const blockSize = 1152 * 8;

  for (let i = 0; i < samples; i += blockSize) {
    const end = Math.min(i + blockSize, samples);
    const leftChunk = left.subarray(i, end);
    const rightChunk = right ? right.subarray(i, end) : leftChunk;

    let mp3buf: Uint8Array;
    if (numChannels === 1) {
      mp3buf = encoder.encodeBuffer(leftChunk);
    } else {
      mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    }
    if (mp3buf.length > 0) {
      mp3Chunks.push(mp3buf);
    }
  }

  const flush = encoder.flush();
  if (flush.length > 0) {
    mp3Chunks.push(flush);
  }

  return new Blob(mp3Chunks, { type: 'audio/mp3' });
}

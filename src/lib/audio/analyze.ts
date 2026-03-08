/**
 * Analyze an AudioBuffer to extract musical characteristics for auto-tuning effect parameters.
 */

export interface AudioAnalysis {
  rms: number;           // 0-1, overall loudness
  bassRatio: number;     // 0-1, how bass-heavy the track is
  brightness: number;    // 0-1, spectral brightness (high freq content)
  dynamicRange: number;  // 0-1, how dynamic vs compressed
  energy: number;        // 0-1, overall energy/intensity
}

/**
 * Analyze the audio buffer's frequency and amplitude characteristics.
 */
export function analyzeAudio(buffer: AudioBuffer): AudioAnalysis {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const length = data.length;

  // --- RMS (overall loudness) ---
  let sumSq = 0;
  const step = Math.max(1, Math.floor(length / 50000)); // sample subset for speed
  let count = 0;
  for (let i = 0; i < length; i += step) {
    sumSq += data[i] * data[i];
    count++;
  }
  const rms = Math.sqrt(sumSq / count);

  // --- Dynamic range (peak vs RMS ratio, inverted & normalized) ---
  let peak = 0;
  for (let i = 0; i < length; i += step) {
    const abs = Math.abs(data[i]);
    if (abs > peak) peak = abs;
  }
  const crestFactor = peak / Math.max(rms, 0.0001);
  // crestFactor ~1 = very compressed, ~10+ = very dynamic
  const dynamicRange = Math.min(1, Math.max(0, (crestFactor - 1) / 8));

  // --- Spectral analysis using a chunk from the middle of the track ---
  const fftSize = 4096;
  const midStart = Math.max(0, Math.floor(length / 2) - fftSize);
  const chunk = data.slice(midStart, midStart + fftSize);

  // Simple DFT magnitudes for key frequency bands
  const magnitudes = new Float32Array(fftSize / 2);
  for (let k = 0; k < fftSize / 2; k++) {
    let real = 0, imag = 0;
    for (let n = 0; n < fftSize; n++) {
      const angle = -2 * Math.PI * k * n / fftSize;
      real += chunk[n] * Math.cos(angle);
      imag += chunk[n] * Math.sin(angle);
    }
    magnitudes[k] = Math.sqrt(real * real + imag * imag);
  }

  // Frequency bands
  const freqPerBin = sampleRate / fftSize;
  let bassEnergy = 0, midEnergy = 0, highEnergy = 0, totalEnergy = 0;

  for (let k = 0; k < fftSize / 2; k++) {
    const freq = k * freqPerBin;
    const mag = magnitudes[k];
    totalEnergy += mag;
    if (freq < 250) bassEnergy += mag;
    else if (freq < 4000) midEnergy += mag;
    else highEnergy += mag;
  }

  const bassRatio = totalEnergy > 0 ? bassEnergy / totalEnergy : 0.3;
  const brightness = totalEnergy > 0 ? highEnergy / totalEnergy : 0.3;

  // Overall energy (normalized RMS)
  const energy = Math.min(1, rms * 5);

  return {
    rms: Math.min(1, rms),
    bassRatio: Math.min(1, bassRatio),
    brightness: Math.min(1, brightness),
    dynamicRange,
    energy,
  };
}

import type { ModeParams } from './engine';

/**
 * Generate optimal effect parameters based on audio analysis.
 */
export function autoTuneParams(analysis: AudioAnalysis): ModeParams {
  const { bassRatio, brightness, energy, dynamicRange } = analysis;

  return {
    'slowed-reverb': {
      // Bright, energetic tracks → more slowing + reverb for contrast
      // Already slow/mellow → less drastic
      speed: energy > 0.5 ? 0.78 + (1 - energy) * 0.12 : 0.85 + (1 - energy) * 0.1,
      reverbMix: brightness > 0.15 ? 0.55 + brightness * 0.8 : 0.5,
      reverbDecay: energy > 0.5 ? 4.5 + energy * 2 : 3 + energy * 2,
    },
    'remix': {
      bass: bassRatio > 0.4 ? 0.3 + (1 - bassRatio) * 0.4 : 0.5 + (1 - bassRatio) * 0.3,
      presence: brightness < 0.1 ? 0.6 + (1 - brightness) * 0.2 : 0.4 + brightness * 0.3,
      punch: dynamicRange > 0.4 ? 0.4 + dynamicRange * 0.3 : 0.5 + (1 - dynamicRange) * 0.2,
      // More hall on spacious/dynamic tracks, less on dense/compressed
      hall: dynamicRange > 0.3 ? 0.35 + dynamicRange * 0.25 : 0.3,
    },
    'lofi': {
      // High energy → slow more, add more warmth
      speed: energy > 0.5 ? 0.82 : 0.88,
      warmth: brightness > 0.15 ? 0.5 + brightness * 1.5 : 0.4,
      crackle: energy > 0.5 ? 0.15 : 0.25, // less crackle on loud tracks
      wobble: 0.25 + (1 - energy) * 0.15,
    },
  };
}

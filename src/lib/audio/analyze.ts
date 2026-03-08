/**
 * Analyze an AudioBuffer to extract musical characteristics for auto-tuning effect parameters.
 */

export interface AudioAnalysis {
  rms: number;           // 0-1, overall loudness
  bassRatio: number;     // 0-1, how bass-heavy the track is
  brightness: number;    // 0-1, spectral brightness (high freq content)
  dynamicRange: number;  // 0-1, how dynamic vs compressed
  energy: number;        // 0-1, overall energy/intensity
  bpm: number;           // detected beats per minute
}

/**
 * Detect BPM using onset detection + autocorrelation on the low-frequency energy envelope.
 * Fast, reasonably accurate for most music (60-200 BPM range).
 */
function detectBPM(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  // 1. Downsample to ~11kHz for speed
  const dsRate = 11025;
  const dsFactor = Math.round(sampleRate / dsRate);
  const dsLength = Math.floor(data.length / dsFactor);
  const ds = new Float32Array(dsLength);
  for (let i = 0; i < dsLength; i++) {
    ds[i] = data[i * dsFactor];
  }

  // 2. Compute energy envelope using short windows
  const winSize = Math.round(dsRate * 0.02); // 20ms windows
  const hopSize = Math.round(winSize / 2);
  const numFrames = Math.floor((dsLength - winSize) / hopSize);
  const envelope = new Float32Array(numFrames);

  for (let f = 0; f < numFrames; f++) {
    let sum = 0;
    const start = f * hopSize;
    for (let i = 0; i < winSize; i++) {
      const s = ds[start + i];
      sum += s * s;
    }
    envelope[f] = Math.sqrt(sum / winSize);
  }

  // 3. Onset detection — first-order difference of envelope (half-wave rectified)
  const onset = new Float32Array(numFrames - 1);
  for (let i = 1; i < numFrames; i++) {
    onset[i - 1] = Math.max(0, envelope[i] - envelope[i - 1]);
  }

  // 4. Autocorrelation of onset signal to find periodicity
  // Search range: 60-200 BPM
  const envelopeRate = dsRate / hopSize; // frames per second
  const minLag = Math.round(envelopeRate * 60 / 200); // 200 BPM
  const maxLag = Math.round(envelopeRate * 60 / 60);  // 60 BPM
  const acLen = onset.length;

  let bestLag = minLag;
  let bestCorr = -Infinity;

  // Use only first ~30 seconds for efficiency
  const useLen = Math.min(acLen, Math.round(envelopeRate * 30));

  for (let lag = minLag; lag <= Math.min(maxLag, useLen / 2); lag++) {
    let corr = 0;
    let count = 0;
    for (let i = 0; i < useLen - lag; i++) {
      corr += onset[i] * onset[i + lag];
      count++;
    }
    corr /= count;

    // Weight toward common tempos (90-150 BPM) with slight preference
    const bpmAtLag = envelopeRate * 60 / lag;
    const tempoWeight = 1 + 0.15 * Math.exp(-Math.pow((bpmAtLag - 120) / 40, 2));
    corr *= tempoWeight;

    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  let bpm = envelopeRate * 60 / bestLag;

  // Normalize to 60-200 range (double/halve if outside)
  while (bpm < 60) bpm *= 2;
  while (bpm > 200) bpm /= 2;

  return Math.round(bpm);
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
  const step = Math.max(1, Math.floor(length / 50000));
  let count = 0;
  for (let i = 0; i < length; i += step) {
    sumSq += data[i] * data[i];
    count++;
  }
  const rms = Math.sqrt(sumSq / count);

  // --- Dynamic range ---
  let peak = 0;
  for (let i = 0; i < length; i += step) {
    const abs = Math.abs(data[i]);
    if (abs > peak) peak = abs;
  }
  const crestFactor = peak / Math.max(rms, 0.0001);
  const dynamicRange = Math.min(1, Math.max(0, (crestFactor - 1) / 8));

  // --- Spectral analysis ---
  const fftSize = 4096;
  const midStart = Math.max(0, Math.floor(length / 2) - fftSize);
  const chunk = data.slice(midStart, midStart + fftSize);

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

  const freqPerBin = sampleRate / fftSize;
  let bassEnergy = 0, highEnergy = 0, totalEnergy = 0;

  for (let k = 0; k < fftSize / 2; k++) {
    const freq = k * freqPerBin;
    const mag = magnitudes[k];
    totalEnergy += mag;
    if (freq < 250) bassEnergy += mag;
    else if (freq >= 4000) highEnergy += mag;
  }

  const bassRatio = totalEnergy > 0 ? bassEnergy / totalEnergy : 0.3;
  const brightness = totalEnergy > 0 ? highEnergy / totalEnergy : 0.3;
  const energy = Math.min(1, rms * 5);

  // --- BPM detection ---
  const bpm = detectBPM(buffer);

  return {
    rms: Math.min(1, rms),
    bassRatio: Math.min(1, bassRatio),
    brightness: Math.min(1, brightness),
    dynamicRange,
    energy,
    bpm,
  };
}

import type { ModeParams } from './engine';

/**
 * Beat duration in seconds from BPM.
 */
function beatDuration(bpm: number): number {
  return 60 / bpm;
}

/**
 * Generate optimal effect parameters based on audio analysis + BPM.
 */
export function autoTuneParams(analysis: AudioAnalysis): ModeParams {
  const { bassRatio, brightness, energy, dynamicRange, bpm } = analysis;
  const beat = beatDuration(bpm);

  // Slow tracks (< 90 BPM) → longer reverb, more spatial
  // Fast tracks (> 140 BPM) → tighter effects, less reverb
  const isSlow = bpm < 90;
  const isFast = bpm > 140;

  return {
    'slowed-reverb': {
      speed: energy > 0.5 ? 0.78 + (1 - energy) * 0.12 : 0.85 + (1 - energy) * 0.1,
      reverbMix: brightness > 0.15 ? 0.55 + brightness * 0.8 : 0.5,
      // Sync reverb decay to musical timing — 4-8 beats worth of tail
      reverbDecay: Math.min(8, Math.max(2, beat * (isSlow ? 8 : isFast ? 4 : 6))),
      spatial: 0.5 + brightness * 0.3,
    },
    'remix': {
      bass: bassRatio > 0.4 ? 0.3 + (1 - bassRatio) * 0.4 : 0.5 + (1 - bassRatio) * 0.3,
      presence: brightness < 0.1 ? 0.6 + (1 - brightness) * 0.2 : 0.4 + brightness * 0.3,
      // Faster BPM → more punch for energy
      punch: isFast ? 0.6 + dynamicRange * 0.2 : 0.4 + dynamicRange * 0.3,
      // Hall echo tuned to beat — longer hall on slower tracks
      hall: isSlow ? 0.5 : isFast ? 0.25 : 0.35 + dynamicRange * 0.2,
      stereoWidth: 0.5 + dynamicRange * 0.2,
      spatial: 0.5 + brightness * 0.2,
    },
    'lofi': {
      speed: energy > 0.5 ? 0.82 : 0.88,
      warmth: brightness > 0.15 ? 0.5 + brightness * 1.5 : 0.4,
      crackle: energy > 0.5 ? 0.15 : 0.25,
      // Sync wobble feel to tempo — slower songs get more wobble
      wobble: isSlow ? 0.4 : isFast ? 0.2 : 0.3,
      spatial: 0.35 + (1 - energy) * 0.2,
    },
  };
}

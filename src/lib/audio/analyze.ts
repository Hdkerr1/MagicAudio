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

  // 1. Downsample to ~22kHz for better frequency resolution
  const dsRate = 22050;
  const dsFactor = Math.max(1, Math.round(sampleRate / dsRate));
  const dsLength = Math.floor(data.length / dsFactor);
  const ds = new Float32Array(dsLength);
  // Simple low-pass averaging during downsample to reduce aliasing
  for (let i = 0; i < dsLength; i++) {
    let sum = 0;
    for (let j = 0; j < dsFactor; j++) {
      sum += data[i * dsFactor + j];
    }
    ds[i] = sum / dsFactor;
  }

  // 2. Multi-band filtering — separate bass (kick) and broadband (snare/hats)
  // Bass band: simple 2nd-order IIR low-pass at ~200Hz
  const bassFiltered = new Float32Array(dsLength);
  const midFiltered = new Float32Array(dsLength);
  {
    // Low-pass for bass (butterworth-ish, fc=200Hz)
    const fc = 200 / dsRate;
    const w0 = 2 * Math.PI * fc;
    const alpha = Math.sin(w0) / (2 * 0.707);
    const cosW0 = Math.cos(w0);
    const b0 = (1 - cosW0) / 2, b1 = 1 - cosW0, b2 = (1 - cosW0) / 2;
    const a0 = 1 + alpha, a1 = -2 * cosW0, a2 = 1 - alpha;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < dsLength; i++) {
      const x0 = ds[i];
      const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      bassFiltered[i] = y0;
      midFiltered[i] = x0 - y0; // remainder = mid+high
      x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    }
  }

  // 3. Compute energy envelopes for each band
  const winSize = Math.round(dsRate * 0.015); // 15ms windows (tighter for transient detection)
  const hopSize = Math.round(winSize / 2);
  const numFrames = Math.floor((dsLength - winSize) / hopSize);

  const bassEnv = new Float32Array(numFrames);
  const midEnv = new Float32Array(numFrames);

  for (let f = 0; f < numFrames; f++) {
    let bassSum = 0, midSum = 0;
    const start = f * hopSize;
    for (let i = 0; i < winSize; i++) {
      bassSum += bassFiltered[start + i] ** 2;
      midSum += midFiltered[start + i] ** 2;
    }
    bassEnv[f] = Math.sqrt(bassSum / winSize);
    midEnv[f] = Math.sqrt(midSum / winSize);
  }

  // 4. Onset detection — spectral flux style (half-wave rectified difference)
  const bassOnset = new Float32Array(numFrames - 1);
  const midOnset = new Float32Array(numFrames - 1);
  for (let i = 1; i < numFrames; i++) {
    bassOnset[i - 1] = Math.max(0, bassEnv[i] - bassEnv[i - 1]);
    midOnset[i - 1] = Math.max(0, midEnv[i] - midEnv[i - 1]);
  }

  // 5. Combined weighted onset (bass kicks are strongest tempo indicator)
  const combined = new Float32Array(numFrames - 1);
  // Normalize each band
  let bassMax = 0, midMax = 0;
  for (let i = 0; i < combined.length; i++) {
    if (bassOnset[i] > bassMax) bassMax = bassOnset[i];
    if (midOnset[i] > midMax) midMax = midOnset[i];
  }
  bassMax = bassMax || 1; midMax = midMax || 1;
  for (let i = 0; i < combined.length; i++) {
    combined[i] = (bassOnset[i] / bassMax) * 0.7 + (midOnset[i] / midMax) * 0.3;
  }

  // 6. Autocorrelation with multi-resolution: coarse scan + fine refinement
  const envelopeRate = dsRate / hopSize;
  const minBPM = 60, maxBPM = 200;
  const minLag = Math.round(envelopeRate * 60 / maxBPM);
  const maxLag = Math.round(envelopeRate * 60 / minBPM);

  // Use first ~45 seconds for more data
  const useLen = Math.min(combined.length, Math.round(envelopeRate * 45));

  // Coarse scan: every lag
  const corrValues = new Float32Array(maxLag - minLag + 1);
  for (let lag = minLag; lag <= Math.min(maxLag, useLen / 2); lag++) {
    let corr = 0;
    for (let i = 0; i < useLen - lag; i++) {
      corr += combined[i] * combined[i + lag];
    }
    corr /= (useLen - lag);
    corrValues[lag - minLag] = corr;
  }

  // 7. Find top 5 peaks in autocorrelation
  const peaks: { lag: number; corr: number }[] = [];
  for (let i = 1; i < corrValues.length - 1; i++) {
    if (corrValues[i] > corrValues[i - 1] && corrValues[i] > corrValues[i + 1]) {
      peaks.push({ lag: i + minLag, corr: corrValues[i] });
    }
  }
  peaks.sort((a, b) => b.corr - a.corr);
  const topPeaks = peaks.slice(0, 8);

  if (topPeaks.length === 0) return 120; // fallback

  // 8. Score peaks with octave consistency + tempo prior
  let bestScore = -Infinity;
  let bestBPM = 120;

  for (const peak of topPeaks) {
    const bpm = envelopeRate * 60 / peak.lag;
    let score = peak.corr;

    // Tempo prior: prefer 80-160 BPM range (most music)
    score *= 1 + 0.2 * Math.exp(-(((bpm - 120) / 50) ** 2));

    // Octave consistency: check if half/double tempo also has a peak
    const halfLag = peak.lag * 2;
    const doubleLag = Math.round(peak.lag / 2);

    if (halfLag - minLag >= 0 && halfLag - minLag < corrValues.length) {
      const halfCorr = corrValues[halfLag - minLag];
      // If half-tempo peak is stronger, penalize (we're likely detecting double)
      if (halfCorr > peak.corr * 0.8) {
        score *= 0.7;
      }
      // If half-tempo also exists, boost confidence
      if (halfCorr > peak.corr * 0.3) {
        score *= 1.15;
      }
    }

    if (doubleLag - minLag >= 0 && doubleLag - minLag < corrValues.length) {
      const doubleCorr = corrValues[doubleLag - minLag];
      // If double-tempo is also strong, this is likely the fundamental
      if (doubleCorr > peak.corr * 0.5) {
        score *= 1.2;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestBPM = bpm;
    }
  }

  // Normalize to 60-200 range
  while (bestBPM < 60) bestBPM *= 2;
  while (bestBPM > 200) bestBPM /= 2;

  return Math.round(bestBPM);
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

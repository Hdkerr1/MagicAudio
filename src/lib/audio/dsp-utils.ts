/**
 * Hermite (cubic) interpolation for high-quality sample lookup.
 */
export function hermiteInterpolate(data: Float32Array, index: number): number {
  const len = data.length;
  const idx = Math.floor(index);
  const frac = index - idx;
  const clamp = (i: number) => Math.max(0, Math.min(len - 1, i));
  const y0 = data[clamp(idx - 1)];
  const y1 = data[clamp(idx)];
  const y2 = data[clamp(idx + 1)];
  const y3 = data[clamp(idx + 2)];
  const c0 = y1;
  const c1 = 0.5 * (y2 - y0);
  const c2 = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
  const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
  return ((c3 * frac + c2) * frac + c1) * frac + c0;
}

/**
 * Gentle musical saturation — warm harmonics without harsh clipping.
 * drive: 0–1 (0 = clean, 1 = warm overdrive, never harsh)
 */
export function createSaturationCurve(drive: number): Float32Array {
  const samples = 65536;
  const curve = new Float32Array(samples);
  // Keep drive gentle: max effective multiplier is 2.5 (not 4)
  const amount = 1 + drive * 1.5;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    const driven = x * amount;
    // Normalized tanh saturation — stays within [-1, 1]
    curve[i] = Math.tanh(driven);
  }
  return curve;
}

/**
 * Soft-clip curve — transparent ceiling limiter character.
 */
export function createSoftClipCurve(): Float32Array {
  const samples = 65536;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    if (Math.abs(x) < 2 / 3) {
      curve[i] = x;
    } else {
      const sign = x > 0 ? 1 : -1;
      curve[i] = sign * (3 - Math.pow(2 - 3 * Math.abs(x), 2)) / 3;
    }
  }
  return curve;
}

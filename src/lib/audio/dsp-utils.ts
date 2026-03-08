/**
 * Hermite (cubic) interpolation for high-quality sample lookup.
 * Much better than linear — preserves harmonics and reduces aliasing.
 */
export function hermiteInterpolate(
  data: Float32Array,
  index: number
): number {
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
 * Creates a smooth saturation curve using tanh with adjustable drive.
 */
export function createSaturationCurve(drive: number): Float32Array {
  const samples = 65536;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    // Multi-stage saturation for warmth
    const driven = x * (1 + drive * 4);
    curve[i] = Math.tanh(driven) * (1 / Math.tanh(1 + drive * 4));
  }
  return curve;
}

/**
 * Creates a soft-clip curve that preserves dynamics better than hard clipping.
 */
export function createSoftClipCurve(): Float32Array {
  const samples = 65536;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    // Cubic soft clip
    if (Math.abs(x) < 2 / 3) {
      curve[i] = x;
    } else {
      const sign = x > 0 ? 1 : -1;
      curve[i] = sign * (3 - Math.pow(2 - 3 * Math.abs(x), 2)) / 3;
    }
  }
  return curve;
}

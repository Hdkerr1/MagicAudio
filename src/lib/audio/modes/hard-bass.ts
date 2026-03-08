import { createSaturationCurve, createSoftClipCurve } from '../dsp-utils';
import type { ProgressCallback } from '../types';

export async function processHardBass(
  buffer: AudioBuffer,
  onProgress: ProgressCallback
): Promise<AudioBuffer> {
  onProgress({ stage: 'Analyzing frequency spectrum...', percent: 10 });

  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;

  onProgress({ stage: 'Generating sub-harmonics (R-Bass style)...', percent: 20 });

  // === Multi-band bass processing ===

  // Band 1: Sub bass isolation (20-60Hz)
  const subIso = offlineCtx.createBiquadFilter();
  subIso.type = 'lowpass';
  subIso.frequency.value = 60;
  subIso.Q.value = 0.8;

  // Band 2: Punch range (60-150Hz)
  const punchIso = offlineCtx.createBiquadFilter();
  punchIso.type = 'bandpass';
  punchIso.frequency.value = 100;
  punchIso.Q.value = 1.0;

  // Sub-harmonic boost: deep sub enhancement
  const subBoost = offlineCtx.createBiquadFilter();
  subBoost.type = 'peaking';
  subBoost.frequency.value = 40;
  subBoost.gain.value = 10;
  subBoost.Q.value = 0.8;

  // Punch enhancement
  const punchBoost = offlineCtx.createBiquadFilter();
  punchBoost.type = 'peaking';
  punchBoost.frequency.value = 85;
  punchBoost.gain.value = 8;
  punchBoost.Q.value = 1.5;

  // Kick transient click
  const clickBoost = offlineCtx.createBiquadFilter();
  clickBoost.type = 'peaking';
  clickBoost.frequency.value = 2500;
  clickBoost.gain.value = 3;
  clickBoost.Q.value = 2.0;

  onProgress({ stage: 'Applying analog saturation (Saturn style)...', percent: 40 });

  // Tape saturation on sub band — warm harmonic generation
  const subSaturator = offlineCtx.createWaveShaper();
  subSaturator.curve = createSaturationCurve(0.5) as Float32Array<ArrayBuffer>;
  subSaturator.oversample = '4x';

  // Harder saturation on punch band
  const punchSaturator = offlineCtx.createWaveShaper();
  punchSaturator.curve = createSaturationCurve(0.8) as Float32Array<ArrayBuffer>;
  punchSaturator.oversample = '4x';

  // Gentle saturation on full mix
  const masterSaturator = offlineCtx.createWaveShaper();
  masterSaturator.curve = createSaturationCurve(0.15) as Float32Array<ArrayBuffer>;
  masterSaturator.oversample = '2x';

  onProgress({ stage: 'Multi-band compression...', percent: 55 });

  // Gains for mixing bands
  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 0.65;
  const subGain = offlineCtx.createGain();
  subGain.gain.value = 0.7;
  const punchGain = offlineCtx.createGain();
  punchGain.gain.value = 0.5;

  // Mix bus
  const mixBus = offlineCtx.createGain();
  mixBus.gain.value = 1.0;

  // Dry path with click enhancement
  source.connect(clickBoost);
  clickBoost.connect(dryGain);
  dryGain.connect(mixBus);

  // Sub bass chain
  source.connect(subIso);
  subIso.connect(subBoost);
  subBoost.connect(subSaturator);
  subSaturator.connect(subGain);
  subGain.connect(mixBus);

  // Punch chain
  source.connect(punchIso);
  punchIso.connect(punchBoost);
  punchBoost.connect(punchSaturator);
  punchSaturator.connect(punchGain);
  punchGain.connect(mixBus);

  // Master chain: saturation → soft clip → compressor
  const softClipper = offlineCtx.createWaveShaper();
  softClipper.curve = createSoftClipCurve() as Float32Array<ArrayBuffer>;
  softClipper.oversample = '4x';

  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -8;
  compressor.knee.value = 4;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.12;

  // Limiter
  const limiter = offlineCtx.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;

  // Cut extreme sub-bass that phones can't reproduce to save headroom
  const subCut = offlineCtx.createBiquadFilter();
  subCut.type = 'highpass';
  subCut.frequency.value = 25;
  subCut.Q.value = 0.5;

  mixBus.connect(masterSaturator);
  masterSaturator.connect(softClipper);
  softClipper.connect(compressor);
  compressor.connect(subCut);
  subCut.connect(limiter);
  limiter.connect(offlineCtx.destination);

  source.start(0);

  onProgress({ stage: 'Rendering final audio...', percent: 80 });
  const result = await offlineCtx.startRendering();
  onProgress({ stage: 'Complete', percent: 100 });
  return result;
}

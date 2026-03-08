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

  onProgress({ stage: 'Enhancing sub-bass harmonics...', percent: 20 });

  // === Sub-bass isolation (20–80Hz) ===
  const subIso = offlineCtx.createBiquadFilter();
  subIso.type = 'lowpass';
  subIso.frequency.value = 80;
  subIso.Q.value = 0.7;

  // Sub-bass EQ boost
  const subBoost = offlineCtx.createBiquadFilter();
  subBoost.type = 'peaking';
  subBoost.frequency.value = 45;
  subBoost.gain.value = 6; // Reduced from 10
  subBoost.Q.value = 0.8;

  // === Punch range (60–200Hz) ===
  const punchIso = offlineCtx.createBiquadFilter();
  punchIso.type = 'bandpass';
  punchIso.frequency.value = 120;
  punchIso.Q.value = 0.8;

  const punchBoost = offlineCtx.createBiquadFilter();
  punchBoost.type = 'peaking';
  punchBoost.frequency.value = 90;
  punchBoost.gain.value = 4; // Reduced from 8
  punchBoost.Q.value = 1.2;

  // Presence
  const clickBoost = offlineCtx.createBiquadFilter();
  clickBoost.type = 'peaking';
  clickBoost.frequency.value = 3000;
  clickBoost.gain.value = 1.5; // Reduced from 3
  clickBoost.Q.value = 1.5;

  onProgress({ stage: 'Applying warm saturation...', percent: 40 });

  // Gentle saturation on sub — warm harmonics, NOT distortion
  const subSaturator = offlineCtx.createWaveShaper();
  subSaturator.curve = createSaturationCurve(0.3) as Float32Array<ArrayBuffer>;
  subSaturator.oversample = '4x';

  onProgress({ stage: 'Multi-band compression...', percent: 55 });

  // Conservative gain staging
  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 0.75;
  const subGain = offlineCtx.createGain();
  subGain.gain.value = 0.45; // Reduced from 0.7
  const punchGain = offlineCtx.createGain();
  punchGain.gain.value = 0.25; // Reduced from 0.5

  // Mix bus with headroom
  const mixBus = offlineCtx.createGain();
  mixBus.gain.value = 0.8;

  // Dry path
  source.connect(clickBoost);
  clickBoost.connect(dryGain);
  dryGain.connect(mixBus);

  // Sub-bass chain
  source.connect(subIso);
  subIso.connect(subBoost);
  subBoost.connect(subSaturator);
  subSaturator.connect(subGain);
  subGain.connect(mixBus);

  // Punch chain
  source.connect(punchIso);
  punchIso.connect(punchBoost);
  punchBoost.connect(punchGain);
  punchGain.connect(mixBus);

  // Master: gentle compression + soft clip + limiter
  const softClipper = offlineCtx.createWaveShaper();
  softClipper.curve = createSoftClipCurve() as Float32Array<ArrayBuffer>;
  softClipper.oversample = '2x';

  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.knee.value = 8;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.15;

  const limiter = offlineCtx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 2;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;

  const subCut = offlineCtx.createBiquadFilter();
  subCut.type = 'highpass';
  subCut.frequency.value = 25;
  subCut.Q.value = 0.5;

  mixBus.connect(compressor);
  compressor.connect(softClipper);
  softClipper.connect(subCut);
  subCut.connect(limiter);
  limiter.connect(offlineCtx.destination);

  source.start(0);

  onProgress({ stage: 'Rendering final audio...', percent: 80 });
  const result = await offlineCtx.startRendering();
  onProgress({ stage: 'Complete', percent: 100 });
  return result;
}

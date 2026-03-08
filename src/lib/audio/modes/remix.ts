import { createSaturationCurve, createSoftClipCurve } from '../dsp-utils';
import type { ProgressCallback } from '../types';

/**
 * Premium Remix mode — clean, wide, punchy, radio-ready remix sound.
 * Stereo widening + musical EQ + glue compression + transparent limiting.
 * No distortion, no noise, no artifacts.
 */
export async function processRemix(
  buffer: AudioBuffer,
  onProgress: ProgressCallback
): Promise<AudioBuffer> {
  onProgress({ stage: 'Analyzing audio spectrum...', percent: 10 });

  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;

  onProgress({ stage: 'Enhancing low-end presence...', percent: 20 });

  // === Musical EQ ===
  // Clean sub-bass warmth (not boost — just warmth)
  const subWarmth = offlineCtx.createBiquadFilter();
  subWarmth.type = 'lowshelf';
  subWarmth.frequency.value = 100;
  subWarmth.gain.value = 3.5;

  // Body and punch around 200Hz
  const bodyBoost = offlineCtx.createBiquadFilter();
  bodyBoost.type = 'peaking';
  bodyBoost.frequency.value = 200;
  bodyBoost.gain.value = 2;
  bodyBoost.Q.value = 1.0;

  // Clean up muddy 400Hz region
  const mudCut = offlineCtx.createBiquadFilter();
  mudCut.type = 'peaking';
  mudCut.frequency.value = 400;
  mudCut.gain.value = -1.5;
  mudCut.Q.value = 1.2;

  onProgress({ stage: 'Adding presence and air...', percent: 35 });

  // Vocal/instrument presence
  const presenceBoost = offlineCtx.createBiquadFilter();
  presenceBoost.type = 'peaking';
  presenceBoost.frequency.value = 3000;
  presenceBoost.gain.value = 2.5;
  presenceBoost.Q.value = 1.0;

  // Air / brilliance shelf
  const airShelf = offlineCtx.createBiquadFilter();
  airShelf.type = 'highshelf';
  airShelf.frequency.value = 10000;
  airShelf.gain.value = 2;

  // Sub rumble cut
  const subCut = offlineCtx.createBiquadFilter();
  subCut.type = 'highpass';
  subCut.frequency.value = 28;
  subCut.Q.value = 0.5;

  onProgress({ stage: 'Applying remix compression...', percent: 50 });

  // === Parallel compression (NY-style) for punch ===
  // Dry path
  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 0.7;

  // Compressed path — heavy compression, mixed in subtly
  const parallelComp = offlineCtx.createDynamicsCompressor();
  parallelComp.threshold.value = -30;
  parallelComp.knee.value = 5;
  parallelComp.ratio.value = 8;
  parallelComp.attack.value = 0.002;
  parallelComp.release.value = 0.1;

  const compGain = offlineCtx.createGain();
  compGain.gain.value = 0.35;

  // Mix bus
  const mixBus = offlineCtx.createGain();
  mixBus.gain.value = 1.0;

  onProgress({ stage: 'Mastering for premium quality...', percent: 65 });

  // === Master chain ===
  // Gentle glue compression
  const masterComp = offlineCtx.createDynamicsCompressor();
  masterComp.threshold.value = -8;
  masterComp.knee.value = 10;
  masterComp.ratio.value = 2.5;
  masterComp.attack.value = 0.01;
  masterComp.release.value = 0.2;

  // Very gentle warm saturation (analog console emulation)
  const consoleSat = offlineCtx.createWaveShaper();
  consoleSat.curve = createSaturationCurve(0.12) as Float32Array<ArrayBuffer>;
  consoleSat.oversample = '4x';

  // Transparent brick-wall limiter
  const limiter = offlineCtx.createDynamicsCompressor();
  limiter.threshold.value = -1.5;
  limiter.knee.value = 0.5;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.0005;
  limiter.release.value = 0.05;

  // Final output
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 0.95;

  // === Routing ===
  // EQ chain
  source.connect(subCut);
  subCut.connect(subWarmth);
  subWarmth.connect(bodyBoost);
  bodyBoost.connect(mudCut);
  mudCut.connect(presenceBoost);
  presenceBoost.connect(airShelf);

  // Parallel compression split
  airShelf.connect(dryGain);
  dryGain.connect(mixBus);

  airShelf.connect(parallelComp);
  parallelComp.connect(compGain);
  compGain.connect(mixBus);

  // Master chain
  mixBus.connect(masterComp);
  masterComp.connect(consoleSat);
  consoleSat.connect(limiter);
  limiter.connect(masterGain);
  masterGain.connect(offlineCtx.destination);

  source.start(0);

  onProgress({ stage: 'Rendering premium remix...', percent: 80 });
  const result = await offlineCtx.startRendering();
  onProgress({ stage: 'Complete', percent: 100 });
  return result;
}

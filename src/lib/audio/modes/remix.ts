import { createSaturationCurve, createSoftClipCurve } from '../dsp-utils';
import type { ProgressCallback } from '../types';

/**
 * Generate a large concert hall impulse response for spacious echo.
 */
function generateHallIR(sampleRate: number): AudioBuffer {
  const duration = 3.5;
  const length = Math.ceil(sampleRate * duration);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const ir = ctx.createBuffer(2, length, sampleRate);

  const earlyTaps = [
    { time: 0.025, gain: 0.6 },  { time: 0.038, gain: 0.5 },
    { time: 0.055, gain: 0.45 }, { time: 0.072, gain: 0.38 },
    { time: 0.095, gain: 0.32 }, { time: 0.120, gain: 0.26 },
    { time: 0.155, gain: 0.2 },  { time: 0.195, gain: 0.16 },
    { time: 0.240, gain: 0.12 }, { time: 0.300, gain: 0.08 },
    { time: 0.370, gain: 0.05 },
  ];

  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let seed = ch === 0 ? 54321 : 98765;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };

    for (const tap of earlyTaps) {
      const stereoOffset = ch * Math.floor(0.006 * sampleRate);
      const idx = Math.floor(tap.time * sampleRate) + stereoOffset;
      if (idx < length) {
        data[idx] += tap.gain * (0.8 + rand() * 0.2);
        const idx2 = idx + Math.floor(0.004 * sampleRate * (1 + rand() * 0.3));
        if (idx2 < length) data[idx2] += tap.gain * 0.3 * (0.8 + rand() * 0.2);
      }
    }

    const startSample = Math.floor(0.08 * sampleRate);
    for (let i = startSample; i < length; i++) {
      const t = i / sampleRate;
      const bodyDecay = 0.55 * Math.exp(-t * 1.8);
      const tailDecay = 0.35 * Math.exp(-t * 0.8);
      const decay = bodyDecay + tailDecay;
      const hfDamp = 0.6 * Math.exp(-t * 2.0) + 0.4 * Math.exp(-t * 0.5);
      const sample = rand() * hfDamp + rand() * (1 - hfDamp) * 0.2;
      data[i] += sample * decay * 0.14;
    }
  }
  return ir;
}

/**
 * Premium Remix mode — hall echo + bass enhancement + instrument presence + mastering.
 */
export async function processRemix(
  buffer: AudioBuffer,
  onProgress: ProgressCallback
): Promise<AudioBuffer> {
  onProgress({ stage: 'Analyzing audio spectrum...', percent: 10 });

  // Extend buffer length to accommodate hall reverb tail
  const tailSamples = Math.ceil(buffer.sampleRate * 3.5);
  const totalLength = buffer.length + tailSamples;

  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    totalLength,
    buffer.sampleRate
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;

  onProgress({ stage: 'Enhancing bass and instruments...', percent: 20 });

  // === Musical EQ ===
  const subWarmth = offlineCtx.createBiquadFilter();
  subWarmth.type = 'lowshelf'; subWarmth.frequency.value = 100; subWarmth.gain.value = 3.5;

  const bodyBoost = offlineCtx.createBiquadFilter();
  bodyBoost.type = 'peaking'; bodyBoost.frequency.value = 200;
  bodyBoost.gain.value = 2; bodyBoost.Q.value = 1.0;

  const mudCut = offlineCtx.createBiquadFilter();
  mudCut.type = 'peaking'; mudCut.frequency.value = 400;
  mudCut.gain.value = -1.5; mudCut.Q.value = 1.2;

  const presenceBoost = offlineCtx.createBiquadFilter();
  presenceBoost.type = 'peaking'; presenceBoost.frequency.value = 3000;
  presenceBoost.gain.value = 2.5; presenceBoost.Q.value = 1.0;

  const airShelf = offlineCtx.createBiquadFilter();
  airShelf.type = 'highshelf'; airShelf.frequency.value = 10000; airShelf.gain.value = 2;

  const subCut = offlineCtx.createBiquadFilter();
  subCut.type = 'highpass'; subCut.frequency.value = 28; subCut.Q.value = 0.5;

  onProgress({ stage: 'Adding hall echo...', percent: 35 });

  // === Hall Reverb ===
  const hallConvolver = offlineCtx.createConvolver();
  hallConvolver.buffer = generateHallIR(buffer.sampleRate);

  const hallPreHP = offlineCtx.createBiquadFilter();
  hallPreHP.type = 'highpass'; hallPreHP.frequency.value = 300; hallPreHP.Q.value = 0.5;

  const hallPostLP = offlineCtx.createBiquadFilter();
  hallPostLP.type = 'lowpass'; hallPostLP.frequency.value = 8000; hallPostLP.Q.value = 0.5;

  const hallWetGain = offlineCtx.createGain();
  hallWetGain.gain.value = 0.18; // Balanced hall mix

  onProgress({ stage: 'Applying remix compression...', percent: 50 });

  // Dry path
  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 0.75;

  // Parallel compression
  const parallelComp = offlineCtx.createDynamicsCompressor();
  parallelComp.threshold.value = -30; parallelComp.knee.value = 5;
  parallelComp.ratio.value = 8; parallelComp.attack.value = 0.002;
  parallelComp.release.value = 0.1;

  const compGain = offlineCtx.createGain();
  compGain.gain.value = 0.35;

  const mixBus = offlineCtx.createGain();
  mixBus.gain.value = 1.0;

  onProgress({ stage: 'Mastering for premium quality...', percent: 65 });

  // Master chain
  const masterComp = offlineCtx.createDynamicsCompressor();
  masterComp.threshold.value = -8; masterComp.knee.value = 10;
  masterComp.ratio.value = 2.5; masterComp.attack.value = 0.01;
  masterComp.release.value = 0.2;

  const consoleSat = offlineCtx.createWaveShaper();
  consoleSat.curve = createSaturationCurve(0.12) as Float32Array<ArrayBuffer>;
  consoleSat.oversample = '4x';

  const limiter = offlineCtx.createDynamicsCompressor();
  limiter.threshold.value = -1.5; limiter.knee.value = 0.5;
  limiter.ratio.value = 20; limiter.attack.value = 0.0005;
  limiter.release.value = 0.05;

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

  // Dry → mix
  airShelf.connect(dryGain);
  dryGain.connect(mixBus);

  // Hall reverb → mix
  airShelf.connect(hallPreHP);
  hallPreHP.connect(hallConvolver);
  hallConvolver.connect(hallPostLP);
  hallPostLP.connect(hallWetGain);
  hallWetGain.connect(mixBus);

  // Parallel compression → mix
  airShelf.connect(parallelComp);
  parallelComp.connect(compGain);
  compGain.connect(mixBus);

  // Master
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

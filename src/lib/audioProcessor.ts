// Re-export types
export type { ProcessingMode, ProcessingProgress } from './audio/types';

import type { ProcessingMode, ProgressCallback } from './audio/types';
import { decodeAudioFile } from './audio/decode';
import { audioBufferToWav } from './audio/encode';
import { processSlowedReverb } from './audio/modes/slowed-reverb';
import { processHardBass } from './audio/modes/hard-bass';
import { processLoFi } from './audio/modes/lofi';

export async function processAudio(
  file: File,
  mode: ProcessingMode,
  onProgress: ProgressCallback
): Promise<Blob> {
  onProgress({ stage: 'Decoding audio...', percent: 5 });
  const buffer = await decodeAudioFile(file);

  let processedBuffer: AudioBuffer;

  switch (mode) {
    case 'slowed-reverb':
      processedBuffer = await processSlowedReverb(buffer, onProgress);
      break;
    case 'hard-bass':
      processedBuffer = await processHardBass(buffer, onProgress);
      break;
    case 'lofi':
      processedBuffer = await processLoFi(buffer, onProgress);
      break;
  }

  onProgress({ stage: 'Encoding WAV...', percent: 95 });
  return audioBufferToWav(processedBuffer);
}

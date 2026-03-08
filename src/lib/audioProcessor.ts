// Re-export types
export type { ProcessingMode, ProcessingProgress } from './audio/types';

import type { ProcessingMode, ProgressCallback } from './audio/types';
import type { AudioAnalysis } from './audio/analyze';
import { decodeAudioFile } from './audio/decode';
import { audioBufferToMp3 } from './audio/encode';
import { processSlowedReverb } from './audio/modes/slowed-reverb';
import { processRemix } from './audio/modes/remix';
import { processLoFi } from './audio/modes/lofi';

export async function processAudio(
  file: File,
  mode: ProcessingMode,
  onProgress: ProgressCallback,
  analysis?: AudioAnalysis
): Promise<Blob> {
  onProgress({ stage: 'Decoding audio...', percent: 5 });
  const buffer = await decodeAudioFile(file);

  let processedBuffer: AudioBuffer;

  switch (mode) {
    case 'slowed-reverb':
      processedBuffer = await processSlowedReverb(buffer, onProgress);
      break;
    case 'remix':
      processedBuffer = await processRemix(buffer, onProgress, analysis);
      break;
    case 'lofi':
      processedBuffer = await processLoFi(buffer, onProgress);
      break;
  }

  onProgress({ stage: 'Encoding MP3...', percent: 95 });
  return audioBufferToMp3(processedBuffer);
}

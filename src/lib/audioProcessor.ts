// Re-export types
export type { ProcessingMode, ProcessingProgress } from './audio/types';

import type { ProcessingMode, ProgressCallback } from './audio/types';
import type { AudioAnalysis } from './audio/analyze';
import { decodeAudioFile } from './audio/decode';
import { audioBufferToMp3 } from './audio/encode';
import { processSlowedReverb } from './audio/modes/slowed-reverb';
import { processRemix } from './audio/modes/remix';
import { processLoFi } from './audio/modes/lofi';
import { process8DSpatial } from './audio/modes/spatial-8d';
import { process3DSurround } from './audio/modes/surround-3d';

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
      processedBuffer = await processSlowedReverb(buffer, onProgress, analysis);
      break;
    case 'remix':
      processedBuffer = await processRemix(buffer, onProgress, analysis);
      break;
    case 'lofi':
      processedBuffer = await processLoFi(buffer, onProgress, analysis);
      break;
    case '8d-spatial':
      processedBuffer = await process8DSpatial(buffer, onProgress, analysis);
      break;
    case '3d-surround':
      processedBuffer = await process3DSurround(buffer, onProgress, analysis);
      break;
  }

  onProgress({ stage: 'Encoding MP3...', percent: 95 });
  return audioBufferToMp3(processedBuffer);
}

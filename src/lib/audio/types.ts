export type ProcessingMode = 'slowed-reverb' | 'hard-bass' | 'lofi';

export interface ProcessingProgress {
  stage: string;
  percent: number;
}

export type ProgressCallback = (progress: ProcessingProgress) => void;

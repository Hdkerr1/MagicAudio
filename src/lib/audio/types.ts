export type ProcessingMode = 'slowed-reverb' | 'remix' | 'lofi';

export interface ProcessingProgress {
  stage: string;
  percent: number;
}

export type ProgressCallback = (progress: ProcessingProgress) => void;

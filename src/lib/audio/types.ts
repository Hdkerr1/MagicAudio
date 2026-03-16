export type ProcessingMode = 'slowed-reverb' | 'remix' | 'lofi' | '8d-spatial' | '3d-surround';

export interface ProcessingProgress {
  stage: string;
  percent: number;
}

export type ProgressCallback = (progress: ProcessingProgress) => void;

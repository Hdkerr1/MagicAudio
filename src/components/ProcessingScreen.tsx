import { useEffect, useState, useRef } from 'react';
import { processAudio, type ProcessingMode, type ProcessingProgress } from '@/lib/audioProcessor';

interface ProcessingScreenProps {
  file: File;
  mode: ProcessingMode;
  onComplete: (blob: Blob) => void;
  onError: (error: string) => void;
}

const modeLabels: Record<ProcessingMode, string> = {
  'slowed-reverb': 'Slowed + Reverb',
  'remix': 'Remix',
  'lofi': 'Lo-Fi',
};

const modeColors: Record<ProcessingMode, string> = {
  'slowed-reverb': 'stroke-primary',
  'remix': 'stroke-accent',
  'lofi': 'stroke-glow-warm',
};

const ProcessingScreen = ({ file, mode, onComplete, onError }: ProcessingScreenProps) => {
  const [progress, setProgress] = useState<ProcessingProgress>({ stage: 'Initializing...', percent: 0 });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    processAudio(file, mode, setProgress)
      .then(onComplete)
      .catch((err) => onError(err.message || 'Processing failed'));
  }, [file, mode, onComplete, onError]);

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (progress.percent / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-hero px-4">
      <div className="relative w-52 h-52 mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
          <circle
            cx="100" cy="100" r={radius}
            fill="none"
            className="stroke-secondary"
            strokeWidth="6"
          />
          <circle
            cx="100" cy="100" r={radius}
            fill="none"
            className={`${modeColors[mode]} transition-all duration-500`}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-foreground">
            {Math.round(progress.percent)}%
          </span>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-foreground mb-2">
        Applying {modeLabels[mode]}
      </h3>
      <p className="text-muted-foreground font-mono text-sm animate-pulse-glow">
        {progress.stage}
      </p>
    </div>
  );
};

export default ProcessingScreen;

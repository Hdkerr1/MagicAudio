import { useRef, useState, useEffect } from 'react';
import { Play, Pause, Download, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProcessingMode } from '@/lib/audioProcessor';

interface ResultScreenProps {
  blob: Blob;
  originalName: string;
  mode: ProcessingMode;
  onReset: () => void;
}

const modeLabels: Record<ProcessingMode, string> = {
  'slowed-reverb': 'Slowed + Reverb',
  'remix': 'Remix',
  'lofi': 'Lo-Fi',
};

const ResultScreen = ({ blob, originalName, mode, onReset }: ResultScreenProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    const baseName = originalName.replace(/\.[^.]+$/, '');
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `${baseName}_${mode}.wav`;
    a.click();
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-hero px-4">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono mb-4">
            {modeLabels[mode]}
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Processing Complete</h2>
          <p className="text-muted-foreground text-sm font-mono">{originalName}</p>
        </div>

        {/* Player card */}
        <div className="bg-gradient-card border border-border rounded-2xl p-6 mb-6">
          {/* Progress bar */}
          <div
            className="w-full h-1.5 bg-secondary rounded-full mb-4 cursor-pointer group"
            onClick={seekTo}
          >
            <div
              className="h-full bg-primary rounded-full transition-all relative"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono text-muted-foreground">{formatTime(currentTime)}</span>
            <span className="text-xs font-mono text-muted-foreground">{formatTime(duration)}</span>
          </div>

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors glow-primary"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-primary-foreground" />
              ) : (
                <Play className="w-6 h-6 text-primary-foreground ml-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={handleDownload}
            className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <Download className="w-4 h-4" />
            Download WAV
          </Button>
          <Button
            onClick={onReset}
            variant="outline"
            className="h-12 gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            New Track
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ResultScreen;

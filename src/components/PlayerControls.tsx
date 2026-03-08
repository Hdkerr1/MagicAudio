import { Play, Pause, Download, RotateCcw, Loader2 } from 'lucide-react';
import type { PlaybackMode } from '@/lib/audio/engine';

interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  mode: PlaybackMode;
  fileName: string;
  isExporting: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onExport: () => void;
  onReset: () => void;
}

const formatTime = (t: number) => {
  if (!t || !isFinite(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const modeLabels: Record<string, string> = {
  'slowed-reverb': 'Slowed + Reverb',
  'remix': 'Remix',
  'lofi': 'Slowed Lo-Fi',
};

const PlayerControls = ({
  isPlaying,
  currentTime,
  duration,
  mode,
  fileName,
  isExporting,
  onTogglePlay,
  onSeek,
  onExport,
  onReset,
}: PlayerControlsProps) => {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pct * duration);
  };

  return (
    <div className="w-full glass-strong rounded-2xl p-5 space-y-4">
      {/* Track info */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm text-foreground font-medium truncate">{fileName}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {mode ? modeLabels[mode] : 'No Effect'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onExport}
            disabled={isExporting || !mode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium 
              bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20
              disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export
          </button>
          <button
            onClick={onReset}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            title="New track"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="w-full h-1.5 bg-secondary/60 rounded-full cursor-pointer group relative"
        onClick={handleSeek}
      >
        <div
          className="h-full bg-primary rounded-full transition-[width] duration-100 relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Time + controls */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground w-12">{formatTime(currentTime)}</span>

        <button
          onClick={onTogglePlay}
          className="w-12 h-12 rounded-full bg-primary flex items-center justify-center 
            hover:bg-primary/90 transition-all glow-primary active:scale-95"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 text-primary-foreground" />
          ) : (
            <Play className="w-5 h-5 text-primary-foreground ml-0.5" />
          )}
        </button>

        <span className="text-xs font-mono text-muted-foreground w-12 text-right">{formatTime(duration)}</span>
      </div>
    </div>
  );
};

export default PlayerControls;

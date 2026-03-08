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
  'lofi': 'Vintage Lo-Fi',
};

const PlayerControls = ({
  isPlaying,
  currentTime,
  duration,
  mode,
  fileName,
  isExporting,
  onTogglePlay,
  onExport,
  onReset,
}: PlayerControlsProps) => {
  return (
    <div className="w-full glass-strong rounded-2xl p-4 space-y-3">
      {/* Track info + actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground font-medium truncate">{fileName}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {mode ? modeLabels[mode] : 'No Effect'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onExport}
            disabled={isExporting || !mode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium 
              bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20
              disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={onReset}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors active:scale-95"
            title="New track"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Time + play button */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground w-12">{formatTime(currentTime)}</span>

        <button
          onClick={onTogglePlay}
          className="w-11 h-11 rounded-full bg-primary flex items-center justify-center 
            hover:bg-primary/90 transition-all glow-primary active:scale-90"
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
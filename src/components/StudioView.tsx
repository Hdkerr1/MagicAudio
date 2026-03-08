import { Music } from 'lucide-react';
import ModeToggle, { getModeAccentColor } from './ModeToggle';
import PlayerControls from './PlayerControls';
import Visualizer from './Visualizer';
import type { PlaybackMode } from '@/lib/audio/engine';
import type { EngineState } from '@/lib/audio/engine';

interface StudioViewProps {
  state: EngineState;
  fileName: string;
  isExporting: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onModeChange: (mode: PlaybackMode) => void;
  onExport: () => void;
  onReset: () => void;
  getAnalyser: () => AnalyserNode | null;
}

const StudioView = ({
  state,
  fileName,
  isExporting,
  onTogglePlay,
  onSeek,
  onModeChange,
  onExport,
  onReset,
  getAnalyser,
}: StudioViewProps) => {
  const accentColor = getModeAccentColor(state.mode);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-hero">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] rounded-full bg-primary/4 blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/4 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border/30">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Music className="w-5 h-5 text-primary" />
          </div>
          <span className="text-lg font-bold text-gradient-primary tracking-tight">SoundForge</span>
        </div>
      </header>

      {/* Mode selector */}
      <div className="relative z-10 flex justify-center px-4 py-6">
        <ModeToggle activeMode={state.mode} onModeChange={onModeChange} />
      </div>

      {/* Visualizer area */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-3xl h-48 md:h-64 rounded-2xl overflow-hidden glass">
          <Visualizer
            getAnalyser={getAnalyser}
            isPlaying={state.isPlaying}
            accentColor={accentColor}
          />
        </div>
      </div>

      {/* Player */}
      <div className="relative z-10 px-4 pb-6 pt-4">
        <div className="max-w-2xl mx-auto">
          <PlayerControls
            isPlaying={state.isPlaying}
            currentTime={state.currentTime}
            duration={state.duration}
            mode={state.mode}
            fileName={fileName}
            isExporting={isExporting}
            onTogglePlay={onTogglePlay}
            onSeek={onSeek}
            onExport={onExport}
            onReset={onReset}
          />
        </div>
      </div>
    </div>
  );
};

export default StudioView;

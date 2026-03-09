import { Music, ArrowLeft, Waves, Volume2, Radio } from 'lucide-react';
import UsageBadge from './UsageBadge';
import { getModeAccentColor } from './ModeToggle';
import PlayerControls from './PlayerControls';
import Visualizer from './Visualizer';
import ParamSliders from './ParamSliders';
import Waveform from './Waveform';
import type { PlaybackMode, ModeParams } from '@/lib/audio/engine';
import type { EngineState } from '@/lib/audio/engine';
import { useEffect, useCallback } from 'react';

const modeInfo: Record<string, { label: string; icon: typeof Waves; colorClass: string; bgClass: string }> = {
  'slowed-reverb': { label: 'Slowed + Reverb', icon: Waves, colorClass: 'text-primary', bgClass: 'bg-primary/15 border-primary/40' },
  'remix': { label: 'Remix', icon: Volume2, colorClass: 'text-accent', bgClass: 'bg-accent/15 border-accent/40' },
  'lofi': { label: 'Vintage Lo-Fi', icon: Radio, colorClass: 'text-glow-warm', bgClass: 'bg-glow-warm/15 border-glow-warm/40' },
};

interface StudioViewProps {
  state: EngineState;
  params: ModeParams;
  fileName: string;
  isExporting: boolean;
  bpm: number | null;
  bypassed: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onParamChange: <M extends keyof ModeParams>(mode: M, key: keyof ModeParams[M], value: number) => void;
  onExport: () => void;
  onReset: () => void;
  onBackToModes: () => void;
  onToggleBypass: () => void;
  onSetBypass: (value: boolean) => void;
  getAnalyser: () => AnalyserNode | null;
  getAudioBuffer: () => AudioBuffer | null;
}

const StudioView = ({
  state, params, fileName, isExporting, bpm, bypassed,
  onTogglePlay, onSeek, onParamChange,
  onExport, onReset, onBackToModes, onToggleBypass, onSetBypass, getAnalyser, getAudioBuffer,
}: StudioViewProps) => {
  const accentColor = getModeAccentColor(state.mode);
  const currentMode = state.mode ? modeInfo[state.mode] : null;
  const ModeIcon = currentMode?.icon || Waves;

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        onTogglePlay();
        break;
      case 'KeyB':
        e.preventDefault();
        onToggleBypass();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        onSeek(Math.max(0, state.currentTime - 5));
        break;
      case 'ArrowRight':
        e.preventDefault();
        onSeek(Math.min(state.duration, state.currentTime + 5));
        break;
    }
  }, [onTogglePlay, onToggleBypass, onSeek, state.currentTime, state.duration]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-hero">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] rounded-full bg-primary/4 blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/4 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 md:px-6 py-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToModes}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Change Mode</span>
          </button>
          <div className="h-4 w-px bg-border/40 hidden sm:block" />
          <div className="flex items-center gap-2 hidden sm:flex">
            <div className="p-1 rounded-lg bg-primary/10">
              <Music className="w-4 h-4 text-primary" />
            </div>
            <span className="text-base font-bold text-gradient-primary tracking-tight">TuneSence</span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* A/B Toggle pill */}
          <div className="flex rounded-full border border-border/50 overflow-hidden">
            <button
              onClick={() => onSetBypass(true)}
              className={`px-2.5 md:px-3 py-1.5 text-xs md:text-sm font-semibold transition-colors duration-150 select-none active:scale-95 ${
                bypassed
                  ? 'bg-primary/15 text-primary'
                  : 'bg-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Original
            </button>
            <button
              onClick={() => onSetBypass(false)}
              className={`px-2.5 md:px-3 py-1.5 text-xs md:text-sm font-semibold transition-colors duration-150 select-none active:scale-95 ${
                !bypassed
                  ? 'bg-primary/15 text-primary'
                  : 'bg-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Processed
            </button>
          </div>

          {bpm && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 bg-secondary/30">
              <span className="text-xs font-mono text-muted-foreground">♪</span>
              <span className="text-sm font-bold font-mono text-foreground">{bpm}</span>
              <span className="text-xs font-mono text-muted-foreground">BPM</span>
            </div>
          )}

          {currentMode && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${currentMode.bgClass}`}>
              <ModeIcon className={`w-3.5 h-3.5 ${currentMode.colorClass}`} />
              <span className={`text-xs md:text-sm font-semibold ${currentMode.colorClass}`}>{currentMode.label}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main content: visualizer + params side by side */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-stretch gap-3 p-3 md:p-4">
        {/* Visualizer */}
        <div className="w-full lg:flex-1 h-40 md:h-56 lg:h-auto rounded-2xl overflow-hidden glass">
          <Visualizer
            getAnalyser={getAnalyser}
            isPlaying={state.isPlaying}
            accentColor={accentColor}
          />
        </div>

        {/* Parameter sliders */}
        {state.mode && (
          <div className="w-full lg:w-72 shrink-0">
            <ParamSliders
              mode={state.mode}
              params={params}
              onParamChange={onParamChange}
            />
          </div>
        )}
      </div>

      {/* Player */}
      <div className="relative z-10 px-3 md:px-4 pb-4 pt-2">
        <div className="max-w-2xl mx-auto space-y-2">
          {/* Waveform */}
          <div className="glass rounded-xl p-2.5">
            <Waveform
              getAudioBuffer={getAudioBuffer}
              currentTime={state.currentTime}
              duration={state.duration}
              onSeek={onSeek}
              accentColor={accentColor}
            />
          </div>

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

        {/* Keyboard shortcut hints */}
        <div className="hidden md:flex items-center justify-center gap-4 mt-3 text-[10px] font-mono text-muted-foreground/50">
          <span><kbd className="px-1.5 py-0.5 rounded border border-border/40 bg-secondary/30 text-muted-foreground/60">Space</kbd> Play/Pause</span>
          <span><kbd className="px-1.5 py-0.5 rounded border border-border/40 bg-secondary/30 text-muted-foreground/60">B</kbd> Bypass</span>
          <span><kbd className="px-1.5 py-0.5 rounded border border-border/40 bg-secondary/30 text-muted-foreground/60">←→</kbd> Seek ±5s</span>
        </div>
      </div>
    </div>
  );
};

export default StudioView;
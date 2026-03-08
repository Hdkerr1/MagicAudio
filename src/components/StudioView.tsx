import { Music, ArrowLeft, Waves, Volume2, Radio, ToggleLeft, ToggleRight } from 'lucide-react';
import { getModeAccentColor } from './ModeToggle';
import PlayerControls from './PlayerControls';
import Visualizer from './Visualizer';
import ParamSliders from './ParamSliders';
import Waveform from './Waveform';
import type { PlaybackMode, ModeParams } from '@/lib/audio/engine';
import type { EngineState } from '@/lib/audio/engine';

const modeInfo: Record<string, { label: string; icon: typeof Waves; colorClass: string; bgClass: string }> = {
  'slowed-reverb': { label: 'Slowed + Reverb', icon: Waves, colorClass: 'text-primary', bgClass: 'bg-primary/15 border-primary/40' },
  'remix': { label: 'Remix', icon: Volume2, colorClass: 'text-accent', bgClass: 'bg-accent/15 border-accent/40' },
  'lofi': { label: 'Slowed Lo-Fi', icon: Radio, colorClass: 'text-glow-warm', bgClass: 'bg-glow-warm/15 border-glow-warm/40' },
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
  getAnalyser: () => AnalyserNode | null;
  getAudioBuffer: () => AudioBuffer | null;
}

const StudioView = ({
  state, params, fileName, isExporting, bpm, bypassed,
  onTogglePlay, onSeek, onParamChange,
  onExport, onReset, onBackToModes, onToggleBypass, getAnalyser, getAudioBuffer,
}: StudioViewProps) => {
  const accentColor = getModeAccentColor(state.mode);
  const currentMode = state.mode ? modeInfo[state.mode] : null;
  const ModeIcon = currentMode?.icon || Waves;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-hero">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] rounded-full bg-primary/4 blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/4 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border/30">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToModes}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Change Mode</span>
          </button>
          <div className="h-5 w-px bg-border/40" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Music className="w-5 h-5 text-primary" />
            </div>
            <span className="text-lg font-bold text-gradient-primary tracking-tight">SoundForge</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {bpm && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-border/50 bg-secondary/30">
              <span className="text-xs font-mono text-muted-foreground">♪</span>
              <span className="text-sm font-bold font-mono text-foreground">{bpm}</span>
              <span className="text-xs font-mono text-muted-foreground">BPM</span>
            </div>
          )}
          {currentMode && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${currentMode.bgClass}`}>
              <ModeIcon className={`w-4 h-4 ${currentMode.colorClass}`} />
              <span className={`text-sm font-semibold ${currentMode.colorClass}`}>{currentMode.label}</span>
            </div>
          )}
        </div>
      </header>


      {/* Main content: visualizer + params side by side on larger screens */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-4 px-4 md:px-6">
        {/* Visualizer */}
        <div className="w-full lg:flex-1 max-w-3xl h-48 md:h-64 lg:h-auto rounded-2xl overflow-hidden glass">
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
      <div className="relative z-10 px-4 pb-6 pt-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {/* Waveform overview */}
          <div className="glass rounded-xl p-3">
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
      </div>
    </div>
  );
};

export default StudioView;

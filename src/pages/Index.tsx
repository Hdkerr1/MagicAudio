import { useCallback, useState, useEffect, useRef } from 'react';
import ModeSelector from '@/components/ModeSelector';
import StudioView from '@/components/StudioView';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { toast } from 'sonner';
import type { ProcessingMode } from '@/lib/audioProcessor';

type AppStep = 'select-mode' | 'upload' | 'processing' | 'studio';

const Index = () => {
  const {
    state, params, isLoaded, fileName, isExporting, analysis, bypassed,
    loadFile, togglePlay, seekTo, setMode, getAnalyser, getAudioBuffer,
    updateParam, exportAudio, reset, play, pause, toggleBypass, setBypassValue,
  } = useAudioEngine();

  const [step, setStep] = useState<AppStep>('select-mode');
  const [selectedMode, setSelectedMode] = useState<ProcessingMode | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Step 1: User picks a mode — always show upload screen
  const handleModeSelect = useCallback((mode: ProcessingMode) => {
    setSelectedMode(mode);
    setStep('upload');
  }, []);

  // Step 2: User uploads audio → processing starts
  const handleFileSelected = useCallback(async (f: File) => {
    if (!selectedMode) return;
    try {
      // Pause any currently playing audio before loading new file
      if (state.isPlaying) pause();
      await loadFile(f);
      setMode(selectedMode);
      setStep('processing');

      timerRef.current = setTimeout(() => {
        setStep('studio');
        setTimeout(() => play(), 100);
      }, 3000);
    } catch {
      toast.error('Failed to decode audio file');
    }
  }, [loadFile, selectedMode, setMode, play, pause, state.isPlaying]);

  const handleReset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    reset();
    setStep('select-mode');
    setSelectedMode(null);
  }, [reset]);

  // Back to mode selection from studio — keep audio playing in background
  const handleBackToModesFromStudio = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Don't pause — let the song continue playing in background
    setStep('select-mode');
    setSelectedMode(null);
  }, []);

  const handleBackToModes = useCallback(() => {
    setStep('select-mode');
    setSelectedMode(null);
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const blob = await exportAudio();
      if (!blob) return;
      const baseName = fileName.replace(/\.[^.]+$/, '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_${state.mode || 'processed'}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Audio exported successfully');
    } catch {
      toast.error('Export failed');
    }
  }, [exportAudio, fileName, state.mode]);

  // Demo track handler: fetch the file, load it, then show mode selection for it
  const handleDemoSelect = useCallback(async (demoUrl: string, demoName: string) => {
    try {
      const response = await fetch(demoUrl);
      const blob = await response.blob();
      const file = new File([blob], demoName + '.mp3', { type: 'audio/mpeg' });
      await loadFile(file);
      setStep('select-mode');
      // Mark that we have a demo loaded by setting the fileName via loadFile
    } catch {
      toast.error('Failed to load demo track');
    }
  }, [loadFile]);

  // Step 1: Choose mode
  if (step === 'select-mode') {
    return (
      <ModeSelector
        fileName={isLoaded ? fileName : ''}
        onModeSelect={(mode) => {
          if (isLoaded) {
            // File already loaded (demo), go straight to processing
            setSelectedMode(mode);
            setMode(mode);
            setStep('processing');
            timerRef.current = setTimeout(() => {
              setStep('studio');
              setTimeout(() => play(), 100);
            }, 3000);
          } else {
            handleModeSelect(mode);
          }
        }}
        onBack={() => {}}
        onDemoSelect={handleDemoSelect}
      />
    );
  }

  // Step 2: Upload audio
  if (step === 'upload' && selectedMode) {
    return <UploadForMode mode={selectedMode} onFileSelected={handleFileSelected} onBack={handleBackToModes} />;
  }

  // Step 3: Converting
  if (step === 'processing' && selectedMode) {
    return <BufferingScreen mode={selectedMode} fileName={fileName} bpm={analysis?.bpm} />;
  }

  // Step 4: Studio player
  return (
    <StudioView
      state={state}
      params={params}
      fileName={fileName}
      isExporting={isExporting}
      bpm={analysis?.bpm ?? null}
      bypassed={bypassed}
      onTogglePlay={togglePlay}
      onSeek={seekTo}
      onParamChange={updateParam}
      onExport={handleExport}
      onReset={handleReset}
      onBackToModes={handleBackToModesFromStudio}
      onToggleBypass={toggleBypass}
      onSetBypass={setBypassValue}
      getAnalyser={getAnalyser}
      getAudioBuffer={getAudioBuffer}
    />
  );
};

// === Upload screen showing which mode was selected ===
const modeLabels: Record<ProcessingMode, string> = {
  'slowed-reverb': 'Slowed + Reverb',
  'remix': 'Remix',
  'lofi': 'Vintage Lo-Fi',
};

const modeColors: Record<ProcessingMode, string> = {
  'slowed-reverb': 'text-primary',
  'remix': 'text-accent',
  'lofi': 'text-glow-warm',
};

const modeBgColors: Record<ProcessingMode, string> = {
  'slowed-reverb': 'bg-primary/10 border-primary/30',
  'remix': 'bg-accent/10 border-accent/30',
  'lofi': 'bg-glow-warm/10 border-glow-warm/30',
};

function UploadForMode({
  mode,
  onFileSelected,
  onBack,
}: {
  mode: ProcessingMode;
  onFileSelected: (file: File) => void;
  onBack: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) onFileSelected(file);
  }, [onFileSelected]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
  }, [onFileSelected]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-hero px-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-[120px] animate-pulse-glow" />
      </div>

      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors z-20"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back
      </button>

      {/* Selected mode badge */}
      <div className={`relative z-10 mb-6 px-5 py-2.5 rounded-full border ${modeBgColors[mode]}`}>
        <span className={`text-sm font-semibold ${modeColors[mode]}`}>
          {modeLabels[mode]}
        </span>
      </div>

      <h2 className="relative z-10 text-3xl font-bold text-foreground mb-2">Upload Your Track</h2>
      <p className="relative z-10 text-muted-foreground mb-8">
        Drop your audio file to convert it to <span className={`font-semibold ${modeColors[mode]}`}>{modeLabels[mode]}</span>
      </p>

      <label
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          relative z-10 cursor-pointer w-full max-w-xl aspect-[16/9] rounded-2xl
          flex flex-col items-center justify-center gap-5 transition-all duration-300
          ${isDragging
            ? 'glass-strong glow-primary scale-[1.02] border-primary/40'
            : 'glass hover:glass-strong hover:border-primary/20'
          }
        `}
      >
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileInput}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <div className={`p-5 rounded-2xl transition-all duration-300 ${isDragging ? 'bg-primary/15' : 'bg-secondary/60'}`}>
          <svg className={`w-10 h-10 ${isDragging ? 'text-primary animate-bounce' : 'text-muted-foreground'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="text-foreground font-medium text-lg">
            {isDragging ? 'Drop your track here' : 'Drop audio file or click to browse'}
          </p>
          <p className="text-muted-foreground text-sm mt-1.5 font-mono">
            MP3 · WAV · FLAC · OGG — up to 50MB
          </p>
        </div>
      </label>
    </div>
  );
}

// === Processing/buffering screen ===
function BufferingScreen({ mode, fileName, bpm }: { mode: ProcessingMode; fileName: string; bpm?: number }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const duration = 3000;
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (elapsed < duration) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  const stages = [
    { at: 0, text: 'Analyzing song characteristics...' },
    { at: 20, text: bpm ? `Detected ${bpm} BPM — syncing effects to beat...` : 'Detecting tempo...' },
    { at: 45, text: 'Auto-tuning effect parameters...' },
    { at: 65, text: 'Building audio chain...' },
    { at: 85, text: 'Preparing playback...' },
  ];
  const currentStage = [...stages].reverse().find(s => progress >= s.at)?.text || stages[0].text;

  const barBgColors: Record<ProcessingMode, string> = {
    'slowed-reverb': 'bg-primary',
    'remix': 'bg-accent',
    'lofi': 'bg-glow-warm',
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-hero px-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-primary/6 blur-[150px] animate-pulse-glow" />
      </div>

      {/* Spinner */}
      <div className="relative z-10 mb-8">
        <div className="w-24 h-24 relative">
          <div className="absolute inset-0 rounded-full border-4 border-secondary/30" />
          <div className={`absolute inset-0 rounded-full border-4 border-transparent border-t-current ${modeColors[mode]} animate-spin`} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-lg font-bold font-mono ${modeColors[mode]}`}>
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>

      <h3 className={`relative z-10 text-2xl font-bold text-foreground mb-1`}>
        Converting song to <span className={modeColors[mode]}>{modeLabels[mode]}</span>
      </h3>
      <p className="relative z-10 text-muted-foreground text-xs font-mono mb-1">
        {fileName}
      </p>
      <p className="relative z-10 text-muted-foreground text-sm font-mono mb-6">
        {currentStage}
      </p>

      {/* Progress bar */}
      <div className="relative z-10 w-64 h-1.5 bg-secondary/40 rounded-full overflow-hidden">
        <div
          className={`h-full ${barBgColors[mode]} rounded-full transition-all duration-100`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default Index;

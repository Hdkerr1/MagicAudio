import { useCallback, useState, useEffect, useRef } from 'react';
import DropZone from '@/components/DropZone';
import ModeSelector from '@/components/ModeSelector';
import StudioView from '@/components/StudioView';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { toast } from 'sonner';
import type { ProcessingMode } from '@/lib/audioProcessor';

type AppStep = 'upload' | 'select-mode' | 'processing' | 'studio';

const Index = () => {
  const {
    state, params, isLoaded, fileName, isExporting, analysis,
    loadFile, togglePlay, seekTo, setMode, getAnalyser, getAudioBuffer,
    updateParam, exportAudio, reset, play,
  } = useAudioEngine();

  const [step, setStep] = useState<AppStep>('upload');
  const [selectedMode, setSelectedMode] = useState<ProcessingMode | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleFileSelected = useCallback(async (f: File) => {
    try {
      await loadFile(f);
      setStep('select-mode');
      toast.success('Track analyzed — parameters auto-tuned to your song');
    } catch {
      toast.error('Failed to decode audio file');
    }
  }, [loadFile]);

  const handleModeSelect = useCallback((mode: ProcessingMode) => {
    setSelectedMode(mode);
    setMode(mode);
    setStep('processing');

    // Buffering period, then auto-play
    timerRef.current = setTimeout(() => {
      setStep('studio');
      // Auto-start playback after entering studio
      setTimeout(() => play(), 100);
    }, 3000);
  }, [setMode, play]);

  const handleReset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    reset();
    setStep('upload');
    setSelectedMode(null);
  }, [reset]);

  const handleExport = useCallback(async () => {
    try {
      const blob = await exportAudio();
      if (!blob) return;
      const baseName = fileName.replace(/\.[^.]+$/, '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_${state.mode || 'processed'}.wav`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Audio exported successfully');
    } catch {
      toast.error('Export failed');
    }
  }, [exportAudio, fileName, state.mode]);

  if (step === 'upload') {
    return <DropZone onFileSelected={handleFileSelected} />;
  }

  if (step === 'select-mode') {
    return (
      <ModeSelector
        fileName={fileName}
        onModeSelect={handleModeSelect}
        onBack={handleReset}
      />
    );
  }

  if (step === 'processing' && selectedMode) {
    return <BufferingScreen mode={selectedMode} />;
  }

  return (
    <StudioView
      state={state}
      params={params}
      fileName={fileName}
      isExporting={isExporting}
      onTogglePlay={togglePlay}
      onSeek={seekTo}
      onModeChange={setMode}
      onParamChange={updateParam}
      onExport={handleExport}
      onReset={handleReset}
      getAnalyser={getAnalyser}
      getAudioBuffer={getAudioBuffer}
    />
  );
};

// Buffering/processing animation screen
function BufferingScreen({ mode }: { mode: ProcessingMode }) {
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

  const labels: Record<ProcessingMode, string> = {
    'slowed-reverb': 'Slowed + Reverb',
    'remix': 'Remix',
    'lofi': 'Slowed Lo-Fi',
  };

  const stages = [
    { at: 0, text: 'Analyzing song characteristics...' },
    { at: 25, text: 'Auto-tuning effect parameters...' },
    { at: 50, text: 'Building audio chain...' },
    { at: 75, text: 'Preparing playback...' },
  ];
  const currentStage = [...stages].reverse().find(s => progress >= s.at)?.text || stages[0].text;

  const colors: Record<ProcessingMode, string> = {
    'slowed-reverb': 'text-primary',
    'remix': 'text-accent',
    'lofi': 'text-glow-warm',
  };

  const bgColors: Record<ProcessingMode, string> = {
    'slowed-reverb': 'bg-primary',
    'remix': 'bg-accent',
    'lofi': 'bg-glow-warm',
  };

  const barColors: Record<ProcessingMode, string> = {
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
          <div className={`absolute inset-0 rounded-full border-4 border-transparent border-t-current ${colors[mode]} animate-spin`} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-lg font-bold font-mono ${colors[mode]}`}>
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>

      <h3 className={`relative z-10 text-2xl font-bold ${colors[mode]} mb-2`}>
        Preparing {labels[mode]}
      </h3>
      <p className="relative z-10 text-muted-foreground text-sm font-mono mb-6">
        {currentStage}
      </p>

      {/* Progress bar */}
      <div className="relative z-10 w-64 h-1.5 bg-secondary/40 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColors[mode]} rounded-full transition-all duration-100`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default Index;

import { useCallback, useState } from 'react';
import DropZone from '@/components/DropZone';
import ModeSelector from '@/components/ModeSelector';
import ProcessingScreen from '@/components/ProcessingScreen';
import StudioView from '@/components/StudioView';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { toast } from 'sonner';
import type { ProcessingMode } from '@/lib/audioProcessor';

type AppStep = 'upload' | 'select-mode' | 'processing' | 'studio';

const Index = () => {
  const {
    state, params, isLoaded, fileName, isExporting,
    loadFile, togglePlay, seekTo, setMode, getAnalyser, getAudioBuffer,
    updateParam, exportAudio, reset,
  } = useAudioEngine();

  const [step, setStep] = useState<AppStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [selectedMode, setSelectedMode] = useState<ProcessingMode | null>(null);

  const handleFileSelected = useCallback(async (f: File) => {
    try {
      setFile(f);
      await loadFile(f);
      setStep('select-mode');
    } catch {
      toast.error('Failed to decode audio file');
    }
  }, [loadFile]);

  const handleModeSelect = useCallback((mode: ProcessingMode) => {
    setSelectedMode(mode);
    setMode(mode);
    setStep('processing');

    // Simulate a processing/buffering period then go to studio
    setTimeout(() => {
      setStep('studio');
    }, 3000);
  }, [setMode]);

  const handleReset = useCallback(() => {
    reset();
    setStep('upload');
    setFile(null);
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
  const labels: Record<ProcessingMode, string> = {
    'slowed-reverb': 'Slowed + Reverb',
    'remix': 'Remix',
    'lofi': 'Slowed Lo-Fi',
  };

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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-hero px-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-primary/6 blur-[150px] animate-pulse-glow" />
      </div>

      {/* Spinner */}
      <div className="relative z-10 mb-8">
        <div className="w-24 h-24 relative">
          <div className={`absolute inset-0 rounded-full border-4 border-secondary/30`} />
          <div className={`absolute inset-0 rounded-full border-4 border-transparent border-t-current ${colors[mode]} animate-spin`} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`w-3 h-3 rounded-full ${bgColors[mode]} animate-pulse-glow`} />
          </div>
        </div>
      </div>

      <h3 className={`relative z-10 text-2xl font-bold ${colors[mode]} mb-2`}>
        Preparing {labels[mode]}
      </h3>
      <p className="relative z-10 text-muted-foreground text-sm font-mono animate-pulse-glow">
        Building audio chain...
      </p>

      {/* Progress dots */}
      <div className="relative z-10 flex gap-2 mt-6">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${bgColors[mode]} animate-pulse-glow`}
            style={{ animationDelay: `${i * 0.3}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export default Index;

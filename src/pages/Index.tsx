import { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ModeSelector from '@/components/ModeSelector';
import StudioView from '@/components/StudioView';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useAuth } from '@/hooks/useAuth';
import { useUsageLimit } from '@/hooks/useUsageLimit';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { ProcessingMode } from '@/lib/audioProcessor';

type AppStep = 'select-mode' | 'upload' | 'processing' | 'studio';

const modeLabels: Record<ProcessingMode, string> = {
  'slowed-reverb': 'Slowed + Reverb',
  'remix': 'Remix',
  'lofi': 'Vintage Lo-Fi',
  '8d-spatial': '8D Spatial Audio',
  '3d-surround': '3D Surround Sound',
};

const modeColors: Record<ProcessingMode, string> = {
  'slowed-reverb': 'text-primary',
  'remix': 'text-accent',
  'lofi': 'text-glow-warm',
  '8d-spatial': 'text-primary',
  '3d-surround': 'text-accent',
};

const modeBgColors: Record<ProcessingMode, string> = {
  'slowed-reverb': 'bg-primary/10 border-primary/30',
  'remix': 'bg-accent/10 border-accent/30',
  'lofi': 'bg-glow-warm/10 border-glow-warm/30',
  '8d-spatial': 'bg-primary/10 border-primary/30',
  '3d-surround': 'bg-accent/10 border-accent/30',
};

const Index = () => {
  const {
    state, params, isLoaded, fileName, isExporting, analysis, bypassed,
    loadFile, togglePlay, seekTo, setMode, getAnalyser, getAudioBuffer,
    updateParam, exportAudio, reset, play, pause, toggleBypass, setBypassValue,
  } = useAudioEngine();

  const { user, loading: authLoading } = useAuth();
  const { canConvert, remaining, isPremium, recordConversion } = useUsageLimit();
  const navigate = useNavigate();

  const [step, setStep] = useState<AppStep>('select-mode');
  const [selectedMode, setSelectedMode] = useState<ProcessingMode | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const requireAuth = useCallback(() => {
    if (!user) {
      toast.error('Please sign in to convert tracks');
      navigate('/auth');
      return true;
    }
    return false;
  }, [user, navigate]);

  const checkUsage = useCallback(() => {
    if (!canConvert) {
      toast.error(`Daily limit reached! Upgrade to Premium for unlimited conversions.`);
      navigate('/pricing');
      return false;
    }
    return true;
  }, [canConvert, navigate]);

  const handleModeSelect = useCallback((mode: ProcessingMode) => {
    setSelectedMode(mode);
    setStep('upload');
  }, []);

  const handleFileSelected = useCallback(async (f: File) => {
    if (!selectedMode) return;
    if (requireAuth()) return;
    if (!checkUsage()) return;
    try {
      if (state.isPlaying) pause();
      await loadFile(f);
      setMode(selectedMode);
      await recordConversion(f.name, selectedMode);
      setStep('processing');

      timerRef.current = setTimeout(() => {
        setStep('studio');
        setTimeout(() => play(), 100);
      }, 3000);
    } catch {
      toast.error('Failed to decode audio file');
    }
  }, [loadFile, selectedMode, setMode, play, pause, state.isPlaying, requireAuth, checkUsage, recordConversion]);

  const handleReset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    reset();
    setStep('select-mode');
    setSelectedMode(null);
  }, [reset]);

  const handleBackToModesFromStudio = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStep('select-mode');
    setSelectedMode(null);
  }, []);

  const handleBackToModes = useCallback(() => {
    setStep('select-mode');
    setSelectedMode(null);
  }, []);

  // Save to library after export
  const saveToLibrary = useCallback(async (blob: Blob, originalName: string, mode: string) => {
    if (!user) return;
    const baseName = originalName.replace(/\.[^.]+$/, '');
    const outputName = `${baseName}_${mode}.mp3`;
    const storagePath = `${user.id}/${Date.now()}_${outputName}`;

    const { error: uploadError } = await supabase.storage
      .from('converted-songs')
      .upload(storagePath, blob, { contentType: 'audio/mpeg' });

    if (uploadError) {
      console.error('Storage upload failed:', uploadError);
      return;
    }

    await supabase.from('song_library').insert({
      user_id: user.id,
      file_name: outputName,
      original_name: originalName,
      mode,
      file_size: blob.size,
      storage_path: storagePath,
    });
  }, [user]);

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
      
      // Save to library
      await saveToLibrary(blob, fileName, state.mode || 'processed');
      
      toast.success('Audio exported & saved to library!');
    } catch {
      toast.error('Export failed');
    }
  }, [exportAudio, fileName, state.mode, saveToLibrary]);

  const handleDemoSelect = useCallback(async (demoUrl: string, demoName: string) => {
    if (requireAuth()) return;
    if (!checkUsage()) return;
    try {
      const response = await fetch(demoUrl);
      const blob = await response.blob();
      const file = new File([blob], demoName + '.mp3', { type: 'audio/mpeg' });
      await loadFile(file);
      setStep('select-mode');
    } catch {
      toast.error('Failed to load demo track');
    }
  }, [loadFile, requireAuth, checkUsage]);

  // Batch file handler for upload screen
  const handleBatchFiles = useCallback(async (files: File[]) => {
    if (!selectedMode) return;
    if (requireAuth()) return;
    if (!checkUsage()) return;

    // Process first file in studio, queue info about batch
    const firstFile = files[0];
    try {
      if (state.isPlaying) pause();
      await loadFile(firstFile);
      setMode(selectedMode);

      // Record all conversions
      for (const f of files) {
        await recordConversion(f.name, selectedMode);
      }

      setStep('processing');
      timerRef.current = setTimeout(() => {
        setStep('studio');
        setTimeout(() => play(), 100);
      }, 3000);

      if (files.length > 1) {
        toast.info(`Processing ${firstFile.name}. ${files.length - 1} more queued — export & process next.`);
      }
    } catch {
      toast.error('Failed to decode audio file');
    }
  }, [loadFile, selectedMode, setMode, play, pause, state.isPlaying, requireAuth, checkUsage, recordConversion]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-hero">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (step === 'select-mode') {
    return (
      <ModeSelector
        fileName={isLoaded ? fileName : ''}
        onModeSelect={(mode) => {
          if (requireAuth()) return;
          if (!checkUsage()) return;
          if (isLoaded) {
            setSelectedMode(mode);
            setMode(mode);
            recordConversion(fileName, mode);
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

  if (step === 'upload' && selectedMode) {
    return <UploadForMode mode={selectedMode} onFileSelected={handleFileSelected} onBatchFiles={handleBatchFiles} onBack={handleBackToModes} remaining={remaining} />;
  }

  if (step === 'processing' && selectedMode) {
    return <BufferingScreen mode={selectedMode} fileName={fileName} bpm={analysis?.bpm} />;
  }

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

// === Upload screen with batch support ===
function UploadForMode({ mode, onFileSelected, onBatchFiles, onBack, remaining }: {
  mode: ProcessingMode;
  onFileSelected: (file: File) => void;
  onBatchFiles: (files: File[]) => void;
  onBack: () => void;
  remaining: number;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const maxFiles = Math.min(5, remaining === Infinity ? 5 : remaining);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/')).slice(0, maxFiles);
    if (files.length === 1) {
      onFileSelected(files[0]);
    } else if (files.length > 1) {
      setSelectedFiles(files);
    }
  }, [onFileSelected, maxFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, maxFiles);
    if (files.length === 1) {
      onFileSelected(files[0]);
    } else if (files.length > 1) {
      setSelectedFiles(files);
    }
  }, [onFileSelected, maxFiles]);

  const handleProcessBatch = () => {
    if (selectedFiles.length > 0) onBatchFiles(selectedFiles);
  };

  const removeFile = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-hero px-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-[120px] animate-pulse-glow" />
      </div>
      <button onClick={onBack} className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors z-20">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back
      </button>
      <div className={`relative z-10 mb-6 px-5 py-2.5 rounded-full border ${modeBgColors[mode]}`}>
        <span className={`text-sm font-semibold ${modeColors[mode]}`}>{modeLabels[mode]}</span>
      </div>
      <h2 className="relative z-10 text-3xl font-bold text-foreground mb-2">Upload Your Tracks</h2>
      <p className="relative z-10 text-muted-foreground mb-2">
        Drop up to <span className="font-semibold text-foreground">{maxFiles} files</span> to convert to{' '}
        <span className={`font-semibold ${modeColors[mode]}`}>{modeLabels[mode]}</span>
      </p>
      <p className="relative z-10 text-xs text-muted-foreground/60 mb-6 font-mono">
        {remaining === Infinity ? 'Unlimited' : `${remaining} conversions remaining today`}
      </p>

      {selectedFiles.length === 0 ? (
        <label
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative z-10 cursor-pointer w-full max-w-xl aspect-[16/9] rounded-2xl flex flex-col items-center justify-center gap-5 transition-all duration-300 ${isDragging ? 'glass-strong glow-primary scale-[1.02] border-primary/40' : 'glass hover:glass-strong hover:border-primary/20'}`}
        >
          <input type="file" accept="audio/*" multiple onChange={handleFileInput} className="absolute inset-0 opacity-0 cursor-pointer" />
          <div className={`p-5 rounded-2xl transition-all duration-300 ${isDragging ? 'bg-primary/15' : 'bg-secondary/60'}`}>
            <svg className={`w-10 h-10 ${isDragging ? 'text-primary animate-bounce' : 'text-muted-foreground'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="text-foreground font-medium text-lg">{isDragging ? 'Drop your tracks here' : 'Drop audio files or click to browse'}</p>
            <p className="text-muted-foreground text-sm mt-1.5 font-mono">MP3 · WAV · FLAC · OGG — up to 5 files, 50MB each</p>
          </div>
        </label>
      ) : (
        <div className="relative z-10 w-full max-w-xl space-y-3">
          {selectedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 glass rounded-xl">
              <div className="p-2 rounded-lg bg-primary/10">
                <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13M9 18c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3zM21 16c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                <p className="text-xs text-muted-foreground">{(f.size / (1024 * 1024)).toFixed(1)} MB</p>
              </div>
              <button onClick={() => removeFile(i)} className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
          <button
            onClick={handleProcessBatch}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            Process {selectedFiles.length} Track{selectedFiles.length > 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}

// === Processing screen ===
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
    '8d-spatial': 'bg-primary',
    '3d-surround': 'bg-accent',
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-hero px-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-primary/6 blur-[150px] animate-pulse-glow" />
      </div>
      <div className="relative z-10 mb-8">
        <div className="w-24 h-24 relative">
          <div className="absolute inset-0 rounded-full border-4 border-secondary/30" />
          <div className={`absolute inset-0 rounded-full border-4 border-transparent border-t-current ${modeColors[mode]} animate-spin`} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-lg font-bold font-mono ${modeColors[mode]}`}>{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
      <h3 className="relative z-10 text-2xl font-bold text-foreground mb-1">
        Converting song to <span className={modeColors[mode]}>{modeLabels[mode]}</span>
      </h3>
      <p className="relative z-10 text-muted-foreground text-xs font-mono mb-1">{fileName}</p>
      <p className="relative z-10 text-muted-foreground text-sm font-mono mb-6">{currentStage}</p>
      <div className="relative z-10 w-64 h-1.5 bg-secondary/40 rounded-full overflow-hidden">
        <div className={`h-full ${barBgColors[mode]} rounded-full transition-all duration-100`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export default Index;

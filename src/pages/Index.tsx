import { useCallback } from 'react';
import DropZone from '@/components/DropZone';
import StudioView from '@/components/StudioView';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { toast } from 'sonner';

const Index = () => {
  const {
    state,
    isLoaded,
    fileName,
    isExporting,
    loadFile,
    togglePlay,
    seekTo,
    setMode,
    getAnalyser,
    exportAudio,
    reset,
  } = useAudioEngine();

  const handleFileSelected = useCallback(async (file: File) => {
    try {
      await loadFile(file);
      toast.success('Track loaded — choose an effect to get started');
    } catch {
      toast.error('Failed to decode audio file');
    }
  }, [loadFile]);

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

  if (!isLoaded) {
    return <DropZone onFileSelected={handleFileSelected} />;
  }

  return (
    <StudioView
      state={state}
      fileName={fileName}
      isExporting={isExporting}
      onTogglePlay={togglePlay}
      onSeek={seekTo}
      onModeChange={setMode}
      onExport={handleExport}
      onReset={reset}
      getAnalyser={getAnalyser}
    />
  );
};

export default Index;

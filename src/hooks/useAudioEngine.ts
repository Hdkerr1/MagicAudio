import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioEngine, type PlaybackMode, type EngineState } from '@/lib/audio/engine';

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine | null>(null);
  const [state, setState] = useState<EngineState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    mode: null,
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [fileName, setFileName] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const engine = new AudioEngine();
    engine.setOnStateChange(setState);
    engineRef.current = engine;
    return () => engine.destroy();
  }, []);

  const loadFile = useCallback(async (file: File) => {
    if (!engineRef.current) return;
    setFileName(file.name);
    await engineRef.current.loadFile(file);
    setIsLoaded(true);
  }, []);

  const play = useCallback(() => engineRef.current?.play(), []);
  const pause = useCallback(() => engineRef.current?.pause(), []);
  const seekTo = useCallback((t: number) => engineRef.current?.seekTo(t), []);

  const setMode = useCallback((mode: PlaybackMode) => {
    engineRef.current?.setMode(mode);
  }, []);

  const togglePlay = useCallback(() => {
    if (!engineRef.current) return;
    if (engineRef.current.getIsPlaying()) engineRef.current.pause();
    else engineRef.current.play();
  }, []);

  const getAnalyser = useCallback(() => engineRef.current?.getAnalyser() ?? null, []);

  const exportAudio = useCallback(async () => {
    if (!engineRef.current) return null;
    setIsExporting(true);
    try {
      return await engineRef.current.exportProcessed();
    } finally {
      setIsExporting(false);
    }
  }, []);

  const reset = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.destroy();
      const engine = new AudioEngine();
      engine.setOnStateChange(setState);
      engineRef.current = engine;
    }
    setIsLoaded(false);
    setFileName('');
    setState({ isPlaying: false, currentTime: 0, duration: 0, mode: null });
  }, []);

  return {
    state,
    isLoaded,
    fileName,
    isExporting,
    loadFile,
    play,
    pause,
    togglePlay,
    seekTo,
    setMode,
    getAnalyser,
    exportAudio,
    reset,
  };
}

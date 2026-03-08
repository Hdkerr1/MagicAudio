import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioEngine, type PlaybackMode, type EngineState, type ModeParams, defaultParams } from '@/lib/audio/engine';

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine | null>(null);
  const [state, setState] = useState<EngineState>({
    isPlaying: false, currentTime: 0, duration: 0, mode: null,
  });
  const [params, setParams] = useState<ModeParams>(JSON.parse(JSON.stringify(defaultParams)));
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
  const setMode = useCallback((mode: PlaybackMode) => engineRef.current?.setMode(mode), []);
  const togglePlay = useCallback(() => {
    if (!engineRef.current) return;
    if (engineRef.current.getIsPlaying()) engineRef.current.pause();
    else engineRef.current.play();
  }, []);
  const getAnalyser = useCallback(() => engineRef.current?.getAnalyser() ?? null, []);
  const getAudioBuffer = useCallback(() => engineRef.current?.getAudioBuffer() ?? null, []);

  const updateParam = useCallback(<M extends keyof ModeParams>(mode: M, key: keyof ModeParams[M], value: number) => {
    engineRef.current?.updateParam(mode, key, value);
    setParams(prev => ({
      ...prev,
      [mode]: { ...prev[mode], [key]: value },
    }));
  }, []);

  const exportAudio = useCallback(async () => {
    if (!engineRef.current) return null;
    setIsExporting(true);
    try { return await engineRef.current.exportProcessed(); }
    finally { setIsExporting(false); }
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
    setParams(JSON.parse(JSON.stringify(defaultParams)));
    setState({ isPlaying: false, currentTime: 0, duration: 0, mode: null });
  }, []);

  return {
    state, params, isLoaded, fileName, isExporting,
    loadFile, play, pause, togglePlay, seekTo, setMode,
    getAnalyser, getAudioBuffer, updateParam, exportAudio, reset,
  };
}

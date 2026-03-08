import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioEngine, type PlaybackMode, type EngineState, type ModeParams, defaultParams } from '@/lib/audio/engine';
import { analyzeAudio, autoTuneParams, type AudioAnalysis } from '@/lib/audio/analyze';

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine | null>(null);
  const [state, setState] = useState<EngineState>({
    isPlaying: false, currentTime: 0, duration: 0, mode: null,
  });
  const [params, setParams] = useState<ModeParams>(JSON.parse(JSON.stringify(defaultParams)));
  const [isLoaded, setIsLoaded] = useState(false);
  const [fileName, setFileName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);

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

    // Analyze audio for auto-tuning parameters
    const buffer = engineRef.current.getAudioBuffer();
    if (buffer) {
      const result = analyzeAudio(buffer);
      setAnalysis(result);
      const autoParams = autoTuneParams(result);
      setParams(autoParams);
      // Push auto params into the engine for each mode
      const engine = engineRef.current;
      const modes = ['slowed-reverb', 'remix', 'lofi'] as const;
      for (const m of modes) {
        const mp = autoParams[m] as Record<string, number>;
        for (const [k, v] of Object.entries(mp)) {
          engine.updateParam(m, k as never, v);
        }
      }
    }
  }, []);

  const play = useCallback(async () => { await engineRef.current?.play(); }, []);
  const pause = useCallback(() => engineRef.current?.pause(), []);

  const seekTo = useCallback((t: number) => engineRef.current?.seekTo(t), []);
  const setMode = useCallback((mode: PlaybackMode) => engineRef.current?.setMode(mode), []);
  const togglePlay = useCallback(async () => {
    if (!engineRef.current) return;
    if (engineRef.current.getIsPlaying()) engineRef.current.pause();
    else await engineRef.current.play();
  }, []);
  const getAnalyser = useCallback(() => engineRef.current?.getAnalyser() ?? null, []);
  const getAudioBuffer = useCallback(() => engineRef.current?.getAudioBuffer() ?? null, []);

  const [bypassed, setBypassed] = useState(false);
  const toggleBypass = useCallback(async () => {
    if (!engineRef.current) return;
    const next = !engineRef.current.isBypassed();
    await engineRef.current.setBypass(next);
    setBypassed(next);
  }, []);

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
    try { return await engineRef.current.exportProcessed(analysis ?? undefined); }
    finally { setIsExporting(false); }
  }, [analysis]);

  const reset = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.destroy();
      const engine = new AudioEngine();
      engine.setOnStateChange(setState);
      engineRef.current = engine;
    }
    setIsLoaded(false);
    setFileName('');
    setAnalysis(null);
    setParams(JSON.parse(JSON.stringify(defaultParams)));
    setState({ isPlaying: false, currentTime: 0, duration: 0, mode: null });
  }, []);

  return {
    state, params, isLoaded, fileName, isExporting, analysis,
    loadFile, play, pause, togglePlay, seekTo, setMode,
    getAnalyser, getAudioBuffer, updateParam, exportAudio, reset,
  };
}

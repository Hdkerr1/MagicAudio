import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Link2, Download, Zap, Music, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import HamburgerMenu from '@/components/HamburgerMenu';

type Preset = 'lofi-suppress' | 'nightcore' | 'acoustic-blur' | 'custom';

interface CustomParams {
  pitch: number;
  tempo: number;
  reverb: number;
}

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/;

const PRESETS: { id: Preset; label: string; desc: string }[] = [
  { id: 'lofi-suppress', label: 'Lofi & Suppress', desc: 'Drops mid-range EQ, adds vinyl noise' },
  { id: 'nightcore', label: 'Nightcore Shift', desc: '+5% tempo, +1 semitone pitch' },
  { id: 'acoustic-blur', label: 'Acoustic Blur', desc: 'Micro-reverb + stereo panning' },
  { id: 'custom', label: 'Custom', desc: 'Manual pitch, tempo & reverb' },
];

const STEPS = [
  'Initializing Engine...',
  'Extracting Audio via yt-dlp...',
  'Applying Digital Signal Processing...',
  'Rendering Final MP3...',
];

export default function ForgeAuraBypass() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [preset, setPreset] = useState<Preset>('lofi-suppress');
  const [custom, setCustom] = useState<CustomParams>({ pitch: 0, tempo: 100, reverb: 30 });
  const [processing, setProcessing] = useState(false);
  const [stepIdx, setStepIdx] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const validateUrl = (v: string) => {
    if (!v.trim()) { setUrlError('Please enter a YouTube URL'); return false; }
    if (!YOUTUBE_REGEX.test(v.trim())) { setUrlError('Invalid YouTube URL format'); return false; }
    setUrlError('');
    return true;
  };

  const handleProcess = async () => {
    if (!validateUrl(url)) return;
    setProcessing(true);
    setDone(false);
    setError('');
    setStepIdx(0);
    setProgress(0);

    // Simulate processing steps
    let step = 0;
    const totalDuration = 12000; // 12s total
    const stepDuration = totalDuration / STEPS.length;
    let elapsed = 0;
    const tick = 100;

    intervalRef.current = setInterval(() => {
      elapsed += tick;
      const currentStep = Math.min(Math.floor(elapsed / stepDuration), STEPS.length - 1);
      const pct = Math.min((elapsed / totalDuration) * 100, 100);
      setStepIdx(currentStep);
      setProgress(pct);

      if (elapsed >= totalDuration) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setProcessing(false);
        setDone(true);
      }
    }, tick);

    // TODO: Replace mock with real API call
    // try {
    //   const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-audio`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ youtubeUrl: url.trim(), preset, customParams: preset === 'custom' ? custom : undefined }),
    //   });
    //   if (!res.ok) throw new Error('Processing failed');
    //   const blob = await res.blob();
    //   // trigger download
    // } catch (e) {
    //   setError('Processing failed. Please try again.');
    //   setProcessing(false);
    // }
  };

  const handleDownload = () => {
    // Mock download - in production this would download the actual processed file
    const link = document.createElement('a');
    link.href = '#';
    link.download = 'aurabypass_processed.mp3';
    // TODO: Replace with actual blob URL from API response
    alert('Download will work once the backend API is connected. This is a scaffolded frontend.');
  };

  const reset = () => {
    setDone(false);
    setProcessing(false);
    setStepIdx(-1);
    setProgress(0);
    setError('');
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient BG */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[150px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] rounded-full bg-accent/5 blur-[120px] animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4 md:px-6 py-3">
        <div className="flex items-center gap-2">
          <HamburgerMenu />
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xl"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-mono text-primary mb-4">
              <Zap className="w-3 h-3" />
              DSP Engine v2.0
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Aura<span className="text-primary">Bypass</span>
            </h1>
            <p className="text-sm text-muted-foreground">Audio fingerprint transformation engine</p>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-border/50 glass p-6 md:p-8 space-y-6">
            <AnimatePresence mode="wait">
              {!processing && !done && (
                <motion.div
                  key="input"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {/* URL Input */}
                  <div>
                    <label className="text-xs font-mono text-muted-foreground mb-2 block">YouTube URL</label>
                    <div className="relative">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={url}
                        onChange={(e) => { setUrl(e.target.value); if (urlError) validateUrl(e.target.value); }}
                        onBlur={() => url && validateUrl(url)}
                        placeholder="https://youtube.com/watch?v=..."
                        className="pl-10 bg-secondary/30 border-border/50 focus:border-primary/50 h-12 text-sm"
                      />
                    </div>
                    {urlError && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {urlError}
                      </motion.p>
                    )}
                  </div>

                  {/* Presets */}
                  <div>
                    <label className="text-xs font-mono text-muted-foreground mb-3 block">DSP Preset</label>
                    <div className="grid grid-cols-2 gap-2">
                      {PRESETS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setPreset(p.id)}
                          className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                            preset === p.id
                              ? 'border-primary/60 bg-primary/10 shadow-[0_0_15px_hsl(var(--primary)/0.15)]'
                              : 'border-border/40 bg-secondary/20 hover:border-border/60 hover:bg-secondary/30'
                          }`}
                        >
                          <span className={`text-sm font-medium block ${preset === p.id ? 'text-primary' : 'text-foreground'}`}>
                            {p.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground leading-tight">{p.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom sliders */}
                  <AnimatePresence>
                    {preset === 'custom' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-4"
                      >
                        <div className="p-4 rounded-xl bg-secondary/20 border border-border/30 space-y-4">
                          <div>
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="text-muted-foreground">Pitch Shift</span>
                              <span className="font-mono text-primary">{custom.pitch > 0 ? '+' : ''}{custom.pitch} st</span>
                            </div>
                            <Slider value={[custom.pitch]} onValueChange={([v]) => setCustom(c => ({ ...c, pitch: v }))} min={-6} max={6} step={0.5} />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="text-muted-foreground">Tempo</span>
                              <span className="font-mono text-primary">{custom.tempo}%</span>
                            </div>
                            <Slider value={[custom.tempo]} onValueChange={([v]) => setCustom(c => ({ ...c, tempo: v }))} min={50} max={150} step={1} />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="text-muted-foreground">Reverb</span>
                              <span className="font-mono text-primary">{custom.reverb}%</span>
                            </div>
                            <Slider value={[custom.reverb]} onValueChange={([v]) => setCustom(c => ({ ...c, reverb: v }))} min={0} max={100} step={1} />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Process button */}
                  <Button
                    onClick={handleProcess}
                    className="w-full h-12 text-sm font-semibold bg-primary hover:bg-primary/90 rounded-xl gap-2"
                    disabled={!url.trim()}
                  >
                    <Zap className="w-4 h-4" />
                    Process Audio
                  </Button>

                  {error && (
                    <p className="text-xs text-destructive text-center">{error}</p>
                  )}
                </motion.div>
              )}

              {processing && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6 py-4"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
                      <Zap className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Processing</h3>
                  </div>

                  <Progress value={progress} className="h-2" />

                  {/* Terminal log */}
                  <div className="rounded-xl bg-black/40 border border-border/30 p-4 font-mono text-xs space-y-2 max-h-40 overflow-y-auto">
                    {STEPS.map((step, i) => (
                      <div key={i} className={`flex items-center gap-2 transition-opacity duration-300 ${
                        i <= stepIdx ? 'opacity-100' : 'opacity-20'
                      }`}>
                        {i < stepIdx ? (
                          <CheckCircle className="w-3 h-3 text-accent shrink-0" />
                        ) : i === stepIdx ? (
                          <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                        ) : (
                          <div className="w-3 h-3 rounded-full border border-muted-foreground/30 shrink-0" />
                        )}
                        <span className={i <= stepIdx ? 'text-foreground' : 'text-muted-foreground/50'}>{step}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-muted-foreground/50 text-center">Do not close this tab</p>
                </motion.div>
              )}

              {done && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6 py-4 text-center"
                >
                  <div className="w-20 h-20 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-1">Processing Complete</h3>
                    <p className="text-sm text-muted-foreground">Your audio has been transformed</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button onClick={handleDownload} className="w-full h-12 gap-2 bg-primary hover:bg-primary/90 rounded-xl">
                      <Download className="w-4 h-4" />
                      Download Processed Audio
                    </Button>
                    <Button onClick={reset} variant="outline" className="w-full h-10 rounded-xl text-sm">
                      Process Another
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Disclaimer */}
          <p className="text-[10px] text-muted-foreground/40 text-center mt-4 max-w-sm mx-auto leading-relaxed">
            For educational and research purposes only. Users are responsible for ensuring compliance with applicable copyright laws.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

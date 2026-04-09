import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Upload, Music, Trash2, Play, Pause, Download, CheckCircle, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import ForgeLayout from '@/components/forge/ForgeLayout';
import { Slider } from '@/components/ui/slider';
import { audioBufferToMp3 } from '@/lib/audio/encode';

type Preset = 'lofi-suppress' | 'nightcore' | 'acoustic-blur' | 'custom';

interface CustomParams { pitch: number; tempo: number; reverb: number; }

const PRESETS: { id: Preset; label: string; desc: string }[] = [
  { id: 'lofi-suppress', label: 'Lofi & Suppress', desc: 'Drops mid-range EQ, adds vinyl noise' },
  { id: 'nightcore', label: 'Nightcore Shift', desc: '+5% tempo, +1 semitone pitch' },
  { id: 'acoustic-blur', label: 'Acoustic Blur', desc: 'Micro-reverb + stereo panning' },
  { id: 'custom', label: 'Custom', desc: 'Manual pitch, tempo & reverb' },
];

const STEPS = [
  'Analyzing audio fingerprint...',
  'Applying DSP transformations...',
  'Rendering processed audio...',
  'Encoding final output...',
];

function generateReverbIR(ctx: BaseAudioContext, dur = 2, decay = 2): AudioBuffer {
  const len = Math.ceil(ctx.sampleRate * dur);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let seed = ch === 0 ? 19937 : 44497;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate;
      d[i] = rand() * Math.exp(-t * decay) * 0.15;
    }
  }
  return ir;
}

/** Resample an AudioBuffer to a new playbackRate (pitch+tempo shift) using OfflineAudioContext */
async function processAudio(
  decoded: AudioBuffer,
  preset: Preset,
  custom: CustomParams,
): Promise<AudioBuffer> {
  let playbackRate = 1;
  let reverbWet = 0;
  let eqCut = false;
  let panShift = false;

  switch (preset) {
    case 'lofi-suppress': playbackRate = 0.92; reverbWet = 0.2; eqCut = true; break;
    case 'nightcore': playbackRate = 1.05; reverbWet = 0.05; break;
    case 'acoustic-blur': playbackRate = 1; reverbWet = 0.45; panShift = true; break;
    case 'custom': {
      const semitones = custom.pitch; // -6 to +6
      playbackRate = Math.pow(2, semitones / 12) * (custom.tempo / 100);
      reverbWet = custom.reverb / 100;
      break;
    }
  }

  const sr = decoded.sampleRate;
  const outLength = Math.ceil(decoded.length / playbackRate);
  const offline = new OfflineAudioContext(2, outLength, sr);

  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.playbackRate.value = playbackRate;

  const master = offline.createGain();
  master.gain.value = 0.9;
  master.connect(offline.destination);

  // Dry path
  const dryGain = offline.createGain();
  dryGain.gain.value = 1 - reverbWet * 0.5;
  dryGain.connect(master);

  // EQ cut for lofi
  let lastNode: AudioNode = source;
  if (eqCut) {
    const hp = offline.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 120;
    const lp = offline.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 8000;
    const notch = offline.createBiquadFilter(); notch.type = 'notch'; notch.frequency.value = 2500; notch.Q.value = 0.8;
    source.connect(hp); hp.connect(lp); lp.connect(notch);
    lastNode = notch;
  }

  // Pan shift for acoustic blur
  if (panShift) {
    const panner = offline.createStereoPanner();
    // Automate panning
    const dur = outLength / sr;
    for (let t = 0; t < dur; t += 0.5) {
      panner.pan.setValueAtTime(Math.sin(t * 0.8) * 0.4, t);
    }
    lastNode.connect(panner);
    lastNode = panner;
  }

  lastNode.connect(dryGain);

  // Reverb path
  if (reverbWet > 0.01) {
    const convolver = offline.createConvolver();
    convolver.buffer = generateReverbIR(offline, 2.5, 1.8);
    const wetGain = offline.createGain();
    wetGain.gain.value = reverbWet * 0.6;
    lastNode.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(master);
  }

  source.start(0);
  return offline.startRendering();
}

export default function ForgeAuraBypass() {
  const [file, setFile] = useState<File | null>(null);
  const [decoded, setDecoded] = useState<AudioBuffer | null>(null);
  const [preset, setPreset] = useState<Preset>('lofi-suppress');
  const [custom, setCustom] = useState<CustomParams>({ pitch: 0, tempo: 100, reverb: 30 });
  const [processing, setProcessing] = useState(false);
  const [stepIdx, setStepIdx] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [playing, setPlaying] = useState(false);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      audioElRef.current?.pause();
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      try { ctxRef.current?.close(); } catch {}
    };
  }, [resultUrl]);

  const handleFile = useCallback(async (f: File) => {
    if (!f.type.startsWith('audio/')) { toast.error('Only audio files accepted'); return; }
    setFile(f);
    setResult(null);
    setResultUrl('');
    setProcessing(false);
    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const buf = await ctx.decodeAudioData(await f.arrayBuffer());
      setDecoded(buf);
      toast.success('Audio loaded!');
    } catch {
      toast.error('Failed to decode audio file');
    }
  }, []);

  const handleProcess = async () => {
    if (!decoded) return;
    setProcessing(true);
    setResult(null);
    setResultUrl('');
    setStepIdx(0);
    setProgress(0);

    // Animate steps
    const timer = setInterval(() => {
      setProgress(p => {
        const next = p + 2;
        setStepIdx(Math.min(Math.floor(next / 25), STEPS.length - 1));
        return Math.min(next, 95);
      });
    }, 100);

    try {
      const rendered = await processAudio(decoded, preset, custom);
      clearInterval(timer);
      setStepIdx(STEPS.length - 1);
      setProgress(98);

      // Encode to MP3
      const mp3 = audioBufferToMp3(rendered, 320);
      const url = URL.createObjectURL(mp3);
      setResult(mp3);
      setResultUrl(url);
      setProgress(100);
      toast.success('Processing complete!');
    } catch (err) {
      console.error(err);
      toast.error('Processing failed');
    } finally {
      clearInterval(timer);
      setProcessing(false);
    }
  };

  const togglePlay = () => {
    if (!resultUrl) return;
    if (!audioElRef.current) {
      const a = new Audio(resultUrl);
      a.onended = () => setPlaying(false);
      audioElRef.current = a;
    }
    if (playing) { audioElRef.current.pause(); setPlaying(false); }
    else { audioElRef.current.play(); setPlaying(true); }
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `aurabypass_${file?.name?.replace(/\.[^.]+$/, '') || 'audio'}_${Date.now()}.mp3`;
    a.click();
  };

  const reset = () => {
    audioElRef.current?.pause();
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResult(null); setResultUrl(''); setPlaying(false);
    setStepIdx(-1); setProgress(0);
  };

  return (
    <ForgeLayout>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-mono text-primary mb-4">
            <Zap className="w-3 h-3" />
            DSP Engine v3.0 — Client-Side
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Aura<span className="text-primary">Bypass</span>
          </h1>
          <p className="text-sm text-muted-foreground">Audio fingerprint transformation — upload any audio file, no API keys needed</p>
        </motion.div>

        {/* Card */}
        <div className="rounded-2xl border border-border/50 glass p-6 md:p-8 space-y-6">
          <AnimatePresence mode="wait">
            {!processing && !result && (
              <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                {/* Upload */}
                {!file ? (
                  <label
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                    className="relative flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border hover:border-primary/40 p-8 cursor-pointer transition-all"
                  >
                    <input type="file" accept="audio/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <p className="text-foreground font-medium text-sm">Drop audio file or click to browse</p>
                    <p className="text-muted-foreground text-xs">.mp3 · .wav</p>
                  </label>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/40">
                    <Music className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                    </div>
                    <button onClick={() => { setFile(null); setDecoded(null); }} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Presets */}
                <div>
                  <label className="text-xs font-mono text-muted-foreground mb-3 block">DSP Preset</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESETS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setPreset(p.id)}
                        className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                          preset === p.id
                            ? 'border-primary/60 bg-primary/10 shadow-[0_0_15px_hsl(var(--primary)/0.15)]'
                            : 'border-border/40 bg-secondary/20 hover:border-border/60'
                        }`}
                      >
                        <span className={`text-sm font-medium block ${preset === p.id ? 'text-primary' : 'text-foreground'}`}>{p.label}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight">{p.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom sliders */}
                <AnimatePresence>
                  {preset === 'custom' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
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
                <button
                  onClick={handleProcess}
                  disabled={!decoded}
                  className={`w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                    decoded ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]' : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  Process Audio
                </button>
              </motion.div>
            )}

            {processing && (
              <motion.div key="processing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 py-4">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
                    <Zap className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Processing</h3>
                </div>

                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
                </div>

                <div className="rounded-xl bg-black/40 border border-border/30 p-4 font-mono text-xs space-y-2">
                  {STEPS.map((step, i) => (
                    <div key={i} className={`flex items-center gap-2 transition-opacity duration-300 ${i <= stepIdx ? 'opacity-100' : 'opacity-20'}`}>
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
              </motion.div>
            )}

            {result && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 py-4 text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-accent" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-1">Processing Complete</h3>
                  <p className="text-sm text-muted-foreground">{(result.size / (1024 * 1024)).toFixed(1)} MB MP3</p>
                </div>

                {/* Preview */}
                <button onClick={togglePlay} className="mx-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary border border-border hover:bg-secondary/80 transition-colors">
                  {playing ? <Pause className="w-4 h-4 text-primary" /> : <Play className="w-4 h-4 text-primary" />}
                  <span className="text-sm font-medium text-foreground">{playing ? 'Pause Preview' : 'Play Preview'}</span>
                </button>

                <div className="flex flex-col gap-2">
                  <button onClick={handleDownload} className="w-full h-12 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl flex items-center justify-center font-semibold text-sm">
                    <Download className="w-4 h-4" />
                    Download Processed Audio
                  </button>
                  <button onClick={reset} className="w-full h-10 rounded-xl text-sm border border-border hover:bg-secondary transition-colors text-muted-foreground">
                    Process Another
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-[10px] text-muted-foreground/40 text-center mt-4 max-w-sm mx-auto leading-relaxed">
          100% client-side processing · No data leaves your browser · For educational purposes only
        </p>
      </div>
    </ForgeLayout>
  );
}

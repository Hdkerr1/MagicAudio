import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CloudRain, Disc3, Coffee, Waves, Bug, CloudLightning,
  Upload, Play, Pause, Mic, Square, Download, Music, Trash2,
  Volume2,
} from 'lucide-react';
import { toast } from 'sonner';
import ForgeLayout from '@/components/forge/ForgeLayout';
import { Slider } from '@/components/ui/slider';

/* ─── Ambient Pad Definitions ─── */
interface Pad {
  id: string;
  label: string;
  icon: typeof CloudRain;
  color: string;
  active: boolean;
  volume: number;
}

const INITIAL_PADS: Pad[] = [
  { id: 'rain', label: 'Heavy Rain', icon: CloudRain, color: 'text-blue-400', active: false, volume: 60 },
  { id: 'vinyl', label: 'Vinyl Crackle', icon: Disc3, color: 'text-amber-400', active: false, volume: 40 },
  { id: 'cafe', label: 'Cafe Murmur', icon: Coffee, color: 'text-orange-400', active: false, volume: 50 },
  { id: 'ocean', label: 'Ocean Waves', icon: Waves, color: 'text-cyan-400', active: false, volume: 55 },
  { id: 'crickets', label: 'Night Crickets', icon: Bug, color: 'text-emerald-400', active: false, volume: 35 },
  { id: 'thunder', label: 'Thunder', icon: CloudLightning, color: 'text-purple-400', active: false, volume: 45 },
];

/* ─── Noise Generators using Web Audio API ─── */
type NoiseEngine = { source: AudioBufferSourceNode | OscillatorNode; gain: GainNode; filter?: BiquadFilterNode };

function createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const length = ctx.sampleRate * durationSec;
  const buf = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

function createPadEngine(ctx: AudioContext, dest: AudioNode, padId: string, noiseBuf: AudioBuffer): NoiseEngine {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(dest);

  let source: AudioBufferSourceNode | OscillatorNode;
  let filter: BiquadFilterNode | undefined;

  switch (padId) {
    case 'rain': {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 800; f.Q.value = 0.5;
      s.connect(f); f.connect(gain); source = s; filter = f; break;
    }
    case 'vinyl': {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 0.3;
      const f2 = ctx.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = 500;
      s.connect(f); f.connect(f2); f2.connect(gain); source = s; filter = f; break;
    }
    case 'cafe': {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 0.8;
      s.connect(f); f.connect(gain); source = s; filter = f; break;
    }
    case 'ocean': {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; f.Q.value = 1;
      s.connect(f); f.connect(gain); source = s; filter = f; break;
    }
    case 'crickets': {
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 4200;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4200; f.Q.value = 12;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 8;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.5;
      lfo.connect(lfoGain); lfoGain.connect(gain.gain);
      lfo.start(); osc.connect(f); f.connect(gain); source = osc; filter = f; break;
    }
    case 'thunder': {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 200; f.Q.value = 2;
      s.connect(f); f.connect(gain); source = s; filter = f; break;
    }
    default: {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      s.connect(gain); source = s; break;
    }
  }

  source.start();
  return { source, gain, filter };
}

/* ─── Visualizer Styles ─── */
type VisStyle = 'bars' | 'circle' | 'particles';

function drawBars(ctx2d: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array) {
  const barCount = 64;
  const barW = w / barCount;
  for (let i = 0; i < barCount; i++) {
    const idx = Math.floor((i / barCount) * data.length);
    const val = data[idx] / 255;
    const barH = val * h * 0.85;
    const hue = 260 + (i / barCount) * 60;
    ctx2d.fillStyle = `hsla(${hue}, 80%, 60%, ${0.6 + val * 0.4})`;
    ctx2d.fillRect(i * barW + 1, h - barH, barW - 2, barH);
  }
}

function drawCircle(ctx2d: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array) {
  const cx = w / 2, cy = h / 2;
  const baseR = Math.min(w, h) * 0.2;
  const bassAvg = Array.from(data.slice(0, 8)).reduce((a, b) => a + b, 0) / (8 * 255);
  const r = baseR + bassAvg * baseR * 1.5;
  const sliceAngle = (2 * Math.PI) / data.length;

  ctx2d.beginPath();
  for (let i = 0; i < data.length; i++) {
    const val = data[i] / 255;
    const rad = r + val * baseR * 0.8;
    const angle = i * sliceAngle - Math.PI / 2;
    const x = cx + Math.cos(angle) * rad;
    const y = cy + Math.sin(angle) * rad;
    i === 0 ? ctx2d.moveTo(x, y) : ctx2d.lineTo(x, y);
  }
  ctx2d.closePath();
  ctx2d.strokeStyle = `hsla(280, 90%, 65%, 0.7)`;
  ctx2d.lineWidth = 2;
  ctx2d.stroke();
  ctx2d.fillStyle = `hsla(280, 60%, 50%, 0.08)`;
  ctx2d.fill();
}

const particles: { x: number; y: number; vx: number; vy: number; life: number; size: number }[] = [];
function drawParticles(ctx2d: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array) {
  const energy = Array.from(data.slice(0, 16)).reduce((a, b) => a + b, 0) / (16 * 255);
  // Spawn
  if (energy > 0.3 && particles.length < 200) {
    for (let n = 0; n < Math.floor(energy * 5); n++) {
      particles.push({
        x: Math.random() * w, y: h,
        vx: (Math.random() - 0.5) * 2,
        vy: -(1 + Math.random() * 3 * energy),
        life: 1, size: 2 + Math.random() * 4 * energy,
      });
    }
  }
  // Update & draw
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.life -= 0.008;
    if (p.life <= 0 || p.y < -10) { particles.splice(i, 1); continue; }
    const hue = 200 + p.x / w * 80;
    ctx2d.beginPath();
    ctx2d.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx2d.fillStyle = `hsla(${hue}, 80%, 60%, ${p.life * 0.7})`;
    ctx2d.fill();
  }
}

/* ─── Main Component ─── */
export default function ForgeLofiMixer() {
  const [pads, setPads] = useState<Pad[]>(INITIAL_PADS);
  const [file, setFile] = useState<File | null>(null);
  const [trackPlaying, setTrackPlaying] = useState(false);
  const [masterVol, setMasterVol] = useState(80);
  const [recording, setRecording] = useState(false);
  const [visStyle, setVisStyle] = useState<VisStyle>('bars');

  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const padEnginesRef = useRef<Map<string, NoiseEngine>>(new Map());
  const noiseBufRef = useRef<AudioBuffer | null>(null);
  const trackSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const trackUrlRef = useRef<string>('');

  // Initialize AudioContext
  const ensureCtx = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = masterVol / 100;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const dest = ctx.createMediaStreamDestination();
    master.connect(analyser);
    analyser.connect(ctx.destination);
    master.connect(dest);
    ctxRef.current = ctx;
    masterRef.current = master;
    analyserRef.current = analyser;
    destRef.current = dest;
    noiseBufRef.current = createNoiseBuffer(ctx, 4);
    return ctx;
  }, [masterVol]);

  // Cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      padEnginesRef.current.forEach(e => { try { e.source.stop(); } catch {} });
      try { ctxRef.current?.close(); } catch {}
      if (trackUrlRef.current) URL.revokeObjectURL(trackUrlRef.current);
    };
  }, []);

  // Master volume
  useEffect(() => {
    if (masterRef.current) masterRef.current.gain.setTargetAtTime(masterVol / 100, masterRef.current.context.currentTime, 0.05);
  }, [masterVol]);

  // Toggle pad
  const togglePad = useCallback((id: string) => {
    const ctx = ensureCtx();
    setPads(prev => prev.map(p => {
      if (p.id !== id) return p;
      const next = { ...p, active: !p.active };
      const engine = padEnginesRef.current.get(id);
      if (next.active) {
        if (!engine && noiseBufRef.current && masterRef.current) {
          const e = createPadEngine(ctx, masterRef.current, id, noiseBufRef.current);
          e.gain.gain.setTargetAtTime(p.volume / 100, ctx.currentTime, 0.1);
          padEnginesRef.current.set(id, e);
        } else if (engine) {
          engine.gain.gain.setTargetAtTime(p.volume / 100, ctx.currentTime, 0.1);
        }
      } else {
        if (engine) {
          engine.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
          setTimeout(() => { try { engine.source.stop(); } catch {} padEnginesRef.current.delete(id); }, 200);
        }
      }
      return next;
    }));
  }, [ensureCtx]);

  // Pad volume change
  const setPadVolume = useCallback((id: string, vol: number) => {
    setPads(prev => prev.map(p => p.id === id ? { ...p, volume: vol } : p));
    const engine = padEnginesRef.current.get(id);
    if (engine && ctxRef.current) {
      engine.gain.gain.setTargetAtTime(vol / 100, ctxRef.current.currentTime, 0.05);
    }
  }, []);

  // Handle file upload
  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith('audio/')) { toast.error('Only audio files accepted'); return; }
    const ctx = ensureCtx();
    if (trackUrlRef.current) URL.revokeObjectURL(trackUrlRef.current);
    const url = URL.createObjectURL(f);
    trackUrlRef.current = url;
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    audio.loop = false;
    audioElRef.current = audio;
    setFile(f);
    setTrackPlaying(false);

    // Connect once metadata is ready
    audio.addEventListener('canplay', () => {
      if (trackSourceRef.current) return; // already connected
      try {
        const source = ctx.createMediaElementSource(audio);
        source.connect(masterRef.current!);
        trackSourceRef.current = source;
      } catch {}
    }, { once: true });
    audio.addEventListener('ended', () => setTrackPlaying(false));
  }, [ensureCtx]);

  const toggleTrack = useCallback(() => {
    if (!audioElRef.current) return;
    if (trackPlaying) { audioElRef.current.pause(); setTrackPlaying(false); }
    else { audioElRef.current.play(); setTrackPlaying(true); }
  }, [trackPlaying]);

  // Recording
  const toggleRecording = useCallback(() => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
    } else {
      ensureCtx();
      if (!destRef.current) return;
      chunksRef.current = [];
      const recorder = new MediaRecorder(destRef.current.stream, { mimeType: 'audio/webm;codecs=opus' });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `lofi_mix_${Date.now()}.webm`; a.click();
        URL.revokeObjectURL(url);
        toast.success('Recording saved!');
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      toast.info('Recording started — all audio is being captured');
    }
  }, [recording, ensureCtx]);

  // Visualizer loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);
      // Dark BG
      ctx2d.fillStyle = 'rgba(10, 8, 20, 0.85)';
      ctx2d.fillRect(0, 0, w, h);

      if (analyserRef.current) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        if (visStyle === 'bars') drawBars(ctx2d, w, h, data);
        else if (visStyle === 'circle') drawCircle(ctx2d, w, h, data);
        else drawParticles(ctx2d, w, h, data);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [visStyle]);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
      canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <ForgeLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/15">
              <Disc3 className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Lo-Fi Ambient Mixer</h1>
          </div>
          <p className="text-muted-foreground max-w-xl">
            Layer ambient soundscapes over your music, visualize the frequencies in real-time, and record the mix — all in-browser.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          {/* Left: Visualizer + Track */}
          <div className="space-y-5">
            {/* Visualizer */}
            <div className="relative rounded-2xl overflow-hidden border border-border bg-card">
              <canvas ref={canvasRef} className="w-full h-56 md:h-72" />
              {/* Vis style toggles */}
              <div className="absolute top-3 right-3 flex gap-1">
                {(['bars', 'circle', 'particles'] as VisStyle[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setVisStyle(s)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-colors ${
                      visStyle === s ? 'bg-primary/20 text-primary' : 'bg-background/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s === 'bars' ? 'Bars' : s === 'circle' ? 'Circle' : 'Particles'}
                  </button>
                ))}
              </div>
              {/* Record button */}
              <div className="absolute bottom-3 right-3">
                <button
                  onClick={toggleRecording}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    recording
                      ? 'bg-destructive text-destructive-foreground animate-pulse'
                      : 'bg-primary/15 text-primary hover:bg-primary/25'
                  }`}
                >
                  {recording ? <><Square className="w-3 h-3" /> Stop</> : <><Mic className="w-3 h-3" /> Record Mix</>}
                </button>
              </div>
            </div>

            {/* Track Uploader */}
            {!file ? (
              <label
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-secondary/20 p-10 cursor-pointer transition-all"
              >
                <input type="file" accept="audio/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="absolute inset-0 opacity-0 cursor-pointer" style={{ position: 'absolute' }} />
                <Upload className="w-7 h-7 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-foreground font-medium">Drop your base track here</p>
                  <p className="text-muted-foreground text-xs mt-1">.mp3 · .wav</p>
                </div>
              </label>
            ) : (
              <div className="p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-center gap-3">
                  <button onClick={toggleTrack} className="p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    {trackPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                  </div>
                  <button onClick={() => {
                    audioElRef.current?.pause();
                    if (trackUrlRef.current) URL.revokeObjectURL(trackUrlRef.current);
                    trackSourceRef.current = null; audioElRef.current = null;
                    setFile(null); setTrackPlaying(false);
                  }} className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {/* Master Volume */}
                <div className="mt-3 flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Slider value={[masterVol]} min={0} max={100} step={1} onValueChange={([v]) => setMasterVol(v)} className="flex-1" />
                  <span className="text-xs font-mono text-muted-foreground w-8 text-right">{masterVol}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Soundboard */}
          <div className="space-y-3">
            <h3 className="text-sm font-mono text-muted-foreground/60 uppercase tracking-widest px-1">Ambient Pads</h3>
            {pads.map(pad => {
              const Icon = pad.icon;
              return (
                <div key={pad.id} className={`rounded-xl border p-3 transition-all duration-200 ${
                  pad.active ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
                }`}>
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      onClick={() => togglePad(pad.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        pad.active ? 'bg-primary/20 text-primary' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                    <span className={`text-sm font-medium ${pad.active ? 'text-foreground' : 'text-muted-foreground'}`}>{pad.label}</span>
                    <span className="ml-auto text-xs font-mono text-muted-foreground">{pad.volume}%</span>
                  </div>
                  <Slider
                    value={[pad.volume]}
                    min={0} max={100} step={1}
                    disabled={!pad.active}
                    onValueChange={([v]) => setPadVolume(pad.id, v)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/40 text-center mt-8 font-mono">
          100% client-side · Web Audio API · No data leaves your browser
        </p>
      </div>
    </ForgeLayout>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CloudRain, Disc3, Coffee, Waves, Bug, CloudLightning,
  Upload, Play, Pause, Video, Square, Music, Trash2,
  Volume2,
} from 'lucide-react';
import { toast } from 'sonner';
import ForgeLayout from '@/components/forge/ForgeLayout';
import { Slider } from '@/components/ui/slider';
import StudioVisualizer from '@/components/StudioVisualizer';
/* ─── Ambient Pad Definitions ─── */
interface Pad {
  id: string;
  label: string;
  icon: typeof CloudRain;
  hue: number;
  active: boolean;
  volume: number;
}

const INITIAL_PADS: Pad[] = [
  { id: 'rain', label: 'Heavy Rain', icon: CloudRain, hue: 210, active: false, volume: 60 },
  { id: 'vinyl', label: 'Vinyl Crackle', icon: Disc3, hue: 40, active: false, volume: 40 },
  { id: 'cafe', label: 'Cafe Murmur', icon: Coffee, hue: 25, active: false, volume: 50 },
  { id: 'ocean', label: 'Ocean Waves', icon: Waves, hue: 185, active: false, volume: 55 },
  { id: 'crickets', label: 'Night Crickets', icon: Bug, hue: 150, active: false, volume: 35 },
  { id: 'thunder', label: 'Thunder', icon: CloudLightning, hue: 270, active: false, volume: 45 },
];

/* ─── Noise Generators ─── */
type NoiseEngine = { source: AudioBufferSourceNode | OscillatorNode; gain: GainNode; filter?: BiquadFilterNode };

function createNoiseBuffer(ctx: AudioContext, sec: number): AudioBuffer {
  const len = ctx.sampleRate * sec;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
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
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.5;
      lfo.connect(lfoG); lfoG.connect(gain.gain);
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

/* ─── (Visualizer moved to StudioVisualizer component) ─── */

/* ─── Main Component ─── */
export default function ForgeLofiMixer() {
  const [pads, setPads] = useState<Pad[]>(INITIAL_PADS);
  const [file, setFile] = useState<File | null>(null);
  const [trackPlaying, setTrackPlaying] = useState(false);
  const [masterVol, setMasterVol] = useState(80);
  const [recording, setRecording] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const padEnginesRef = useRef<Map<string, NoiseEngine>>(new Map());
  const noiseBufRef = useRef<AudioBuffer | null>(null);
  const trackSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const visCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const trackUrlRef = useRef('');

  const ensureCtx = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = masterVol / 100;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.65;
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

  useEffect(() => {
    return () => {
      padEnginesRef.current.forEach(e => { try { e.source.stop(); } catch {} });
      try { ctxRef.current?.close(); } catch {}
      if (trackUrlRef.current) URL.revokeObjectURL(trackUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (masterRef.current) masterRef.current.gain.setTargetAtTime(masterVol / 100, masterRef.current.context.currentTime, 0.05);
  }, [masterVol]);

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

  const setPadVolume = useCallback((id: string, vol: number) => {
    setPads(prev => prev.map(p => p.id === id ? { ...p, volume: vol } : p));
    const engine = padEnginesRef.current.get(id);
    if (engine && ctxRef.current) engine.gain.gain.setTargetAtTime(vol / 100, ctxRef.current.currentTime, 0.05);
  }, []);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith('audio/')) { toast.error('Only audio files accepted'); return; }
    const ctx = ensureCtx();
    if (trackUrlRef.current) URL.revokeObjectURL(trackUrlRef.current);
    const url = URL.createObjectURL(f);
    trackUrlRef.current = url;
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    audioElRef.current = audio;
    setFile(f); setTrackPlaying(false);

    audio.addEventListener('canplay', () => {
      if (trackSourceRef.current) return;
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

  // Video recording — canvas + audio
  const toggleRecording = useCallback(() => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
    } else {
      ensureCtx();
      const canvas = visCanvasRef.current;
      if (!canvas || !destRef.current) return;

      const videoStream = canvas.captureStream(30);
      const audioStream = destRef.current.stream;
      const merged = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioStream.getAudioTracks(),
      ]);

      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      const recorder = new MediaRecorder(merged, { mimeType });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `tunesence_mix_${Date.now()}.webm`; a.click();
        URL.revokeObjectURL(url);
        toast.success('Video mix saved!');
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      toast.info('Recording video + audio…');
    }
  }, [recording, ensureCtx]);

  const getAnalyser = useCallback(() => analyserRef.current, []);

  return (
    <ForgeLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl glass-3d glow-cyan">
              <Disc3 className="w-6 h-6 text-accent" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gradient-cyberpunk">TuneSence Studio V2</h1>
          </div>
          <p className="text-muted-foreground max-w-xl">
            Layer ambient soundscapes, visualize with a Neon Depth Ring, and export video mixes — 100% in-browser.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
          {/* Left: Visualizer + Track */}
          <div className="space-y-5">
            {/* Visualizer */}
            <div className="relative">
              <StudioVisualizer getAnalyser={getAnalyser} />
              {/* Record Video button */}
              <div className="absolute bottom-3 right-3 z-10">
                <button
                  onClick={toggleRecording}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    recording
                      ? 'bg-destructive text-destructive-foreground animate-recording'
                      : 'glass-3d text-accent hover:glow-cyan'
                  }`}
                >
                  {recording ? <><Square className="w-3.5 h-3.5" /> Stop Recording</> : <><Video className="w-3.5 h-3.5" /> Record Video Mix</>}
                </button>
              </div>
              {recording && (
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/20 border border-destructive/40 z-10">
                  <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-[10px] font-mono text-destructive">REC</span>
                </div>
              )}
            </div>

            {/* Track Uploader */}
            {!file ? (
              <label
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                className="relative flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent/20 hover:border-accent/50 hover:glow-cyan p-10 cursor-pointer transition-all glass-3d"
              >
                <input type="file" accept="audio/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Upload className="w-7 h-7 text-accent/60" />
                <div className="text-center">
                  <p className="text-foreground font-medium">Drop your base track here</p>
                  <p className="text-muted-foreground text-xs mt-1">.mp3 · .wav</p>
                </div>
              </label>
            ) : (
              <div className="p-4 rounded-2xl glass-3d">
                <div className="flex items-center gap-3">
                  <button onClick={toggleTrack} className="p-3 rounded-xl bg-accent text-accent-foreground hover:bg-accent/85 transition-colors glow-cyan">
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
                <div className="mt-3 flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Slider value={[masterVol]} min={0} max={100} step={1} onValueChange={([v]) => setMasterVol(v)} className="flex-1" />
                  <span className="text-xs font-mono text-muted-foreground w-8 text-right">{masterVol}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: 3D Soundboard */}
          <div className="space-y-3">
            <h3 className="text-sm font-mono text-accent/50 uppercase tracking-widest px-1">Ambient Pads</h3>
            <div className="grid grid-cols-2 gap-3">
              {pads.map(pad => {
                const Icon = pad.icon;
                return (
                  <motion.div
                    key={pad.id}
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className={`rounded-xl border p-3 transition-all duration-200 cursor-pointer ${
                      pad.active
                        ? 'border-accent/40 glass-3d'
                        : 'border-border bg-card hover:border-accent/20'
                    }`}
                    style={pad.active ? { boxShadow: `0 0 20px hsla(${pad.hue}, 80%, 55%, 0.25)` } : undefined}
                    onClick={() => togglePad(pad.id)}
                  >
                    <div className="flex flex-col items-center gap-1.5 mb-2">
                      <div className={`p-2 rounded-lg transition-colors ${
                        pad.active ? 'bg-accent/20' : 'bg-secondary/50'
                      }`}>
                        <Icon className={`w-5 h-5 ${pad.active ? 'text-accent' : 'text-muted-foreground'}`} />
                      </div>
                      <span className={`text-xs font-medium text-center ${pad.active ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {pad.label}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Volume sliders for active pads */}
            {pads.filter(p => p.active).length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">Levels</h4>
                {pads.filter(p => p.active).map(pad => (
                  <div key={pad.id} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16 truncate">{pad.label}</span>
                    <Slider
                      value={[pad.volume]}
                      min={0} max={100} step={1}
                      onValueChange={([v]) => setPadVolume(pad.id, v)}
                      className="flex-1"
                    />
                    <span className="text-[10px] font-mono text-muted-foreground w-7 text-right">{pad.volume}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/40 text-center mt-8 font-mono">
          100% client-side · Web Audio API + Canvas · Video export via MediaRecorder
        </p>
      </div>
    </ForgeLayout>
  );
}

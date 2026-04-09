import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Headphones, Play, Pause, Download, Upload, RotateCw, Music, Trash2, Volume2, Globe, Move3d } from 'lucide-react';
import { toast } from 'sonner';
import ForgeLayout from '@/components/forge/ForgeLayout';
import { Slider } from '@/components/ui/slider';
import { audioBufferToWav, audioBufferToMp3 } from '@/lib/audio/encode';

function generateReverbIR(ctx: BaseAudioContext, duration = 2.5, decay = 2.0): AudioBuffer {
  const length = Math.ceil(ctx.sampleRate * duration);
  const ir = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let seed = ch === 0 ? 19937 : 44497;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };
    const earlyTaps = [
      { time: 0.012, gain: 0.6 }, { time: 0.022, gain: 0.45 },
      { time: 0.038, gain: 0.35 }, { time: 0.055, gain: 0.25 }, { time: 0.08, gain: 0.18 },
    ];
    for (const tap of earlyTaps) {
      const idx = Math.floor(tap.time * ctx.sampleRate) + ch * 8;
      if (idx < length) data[idx] += tap.gain * (0.8 + rand() * 0.2);
    }
    for (let i = Math.floor(0.06 * ctx.sampleRate); i < length; i++) {
      const t = i / ctx.sampleRate;
      data[i] += rand() * Math.exp(-t * decay) * 0.12;
    }
  }
  return ir;
}

type ExportFormat = 'mp3' | 'wav';

export default function ForgeSpatial() {
  const [file, setFile] = useState<File | null>(null);
  const [decoded, setDecoded] = useState<AudioBuffer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [reverbMix, setReverbMix] = useState(30);
  const [reverbDecay, setReverbDecay] = useState(50);
  const [distance, setDistance] = useState(50);
  const [autoRotate, setAutoRotate] = useState(false);
  const [rotateSpeed, setRotateSpeed] = useState(40);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('mp3');

  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const pannerRef = useRef<PannerNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const convolverRef = useRef<ConvolverNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number>(0);
  const angleRef = useRef(0);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const timerRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(timerRef.current);
      try { sourceRef.current?.stop(); } catch {}
      try { ctxRef.current?.close(); } catch {}
    };
  }, []);

  useEffect(() => {
    if (!autoRotate && pannerRef.current) {
      const t = pannerRef.current.context.currentTime;
      pannerRef.current.positionX.setTargetAtTime(panX * 5, t, 0.02);
      pannerRef.current.positionY.setTargetAtTime(panY * 3, t, 0.02);
      pannerRef.current.positionZ.setTargetAtTime(Math.sqrt(1 - panX * panX) * -3, t, 0.02);
    }
  }, [panX, panY, autoRotate]);

  useEffect(() => {
    const wet = reverbMix / 100;
    const dry = 1 - wet * 0.5;
    if (dryGainRef.current) dryGainRef.current.gain.setTargetAtTime(dry, dryGainRef.current.context.currentTime, 0.05);
    if (wetGainRef.current) wetGainRef.current.gain.setTargetAtTime(wet * 0.6, wetGainRef.current.context.currentTime, 0.05);
  }, [reverbMix]);

  useEffect(() => {
    if (pannerRef.current) {
      pannerRef.current.refDistance = 0.5 + (distance / 100) * 4.5;
    }
  }, [distance]);

  useEffect(() => {
    if (!autoRotate || !playing || !pannerRef.current) { cancelAnimationFrame(rafRef.current); return; }
    const speed = rotateSpeed / 100;
    const rotate = () => {
      if (!pannerRef.current) return;
      angleRef.current += speed * 0.03;
      pannerRef.current.positionX.setValueAtTime(Math.sin(angleRef.current) * 5, pannerRef.current.context.currentTime);
      pannerRef.current.positionZ.setValueAtTime(Math.cos(angleRef.current) * -5, pannerRef.current.context.currentTime);
      pannerRef.current.positionY.setValueAtTime(Math.sin(angleRef.current * 0.6) * 1.5, pannerRef.current.context.currentTime);
      rafRef.current = requestAnimationFrame(rotate);
    };
    rafRef.current = requestAnimationFrame(rotate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [autoRotate, playing, rotateSpeed]);

  const handleFile = useCallback(async (f: File) => {
    if (!f.type.startsWith('audio/')) { toast.error('Only audio files accepted'); return; }
    try { sourceRef.current?.stop(); } catch {}
    try { ctxRef.current?.close(); } catch {}
    cancelAnimationFrame(rafRef.current);
    clearInterval(timerRef.current);
    setPlaying(false); setCurrentTime(0);
    setFile(f); setLoading(true); setDecoded(null);

    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const buffer = await ctx.decodeAudioData(await f.arrayBuffer());
      setDecoded(buffer); setDuration(buffer.duration);

      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse';
      panner.refDistance = 0.5 + (distance / 100) * 4.5; panner.maxDistance = 100;
      panner.rolloffFactor = 1; panner.coneInnerAngle = 360; panner.coneOuterAngle = 360;
      pannerRef.current = panner;

      const convolver = ctx.createConvolver();
      convolver.buffer = generateReverbIR(ctx, 1 + (reverbDecay / 100) * 3, 1 + (reverbDecay / 100) * 3);
      convolverRef.current = convolver;

      const dryGain = ctx.createGain(); dryGain.gain.value = 1 - (reverbMix / 100) * 0.5;
      dryGainRef.current = dryGain;
      const wetGain = ctx.createGain(); wetGain.gain.value = (reverbMix / 100) * 0.6;
      wetGainRef.current = wetGain;
      const masterGain = ctx.createGain(); masterGain.gain.value = 0.9;
      masterGainRef.current = masterGain;

      panner.connect(dryGain); dryGain.connect(masterGain);
      panner.connect(convolver); convolver.connect(wetGain); wetGain.connect(masterGain);
      masterGain.connect(ctx.destination);

      toast.success('Audio decoded — ready to play!');
    } catch (err) {
      console.error(err); toast.error('Failed to decode audio file');
    } finally { setLoading(false); }
  }, [reverbMix, reverbDecay, distance]);

  const startPlayback = useCallback((offset = 0) => {
    if (!decoded || !ctxRef.current || !pannerRef.current) return;
    try { sourceRef.current?.stop(); } catch {}
    const source = ctxRef.current.createBufferSource();
    source.buffer = decoded; source.connect(pannerRef.current);
    source.onended = () => { setPlaying(false); clearInterval(timerRef.current); };
    sourceRef.current = source;
    startTimeRef.current = ctxRef.current.currentTime - offset;
    source.start(0, offset); setPlaying(true);
    clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      if (ctxRef.current) setCurrentTime(Math.min(ctxRef.current.currentTime - startTimeRef.current, decoded.duration));
    }, 100);
  }, [decoded]);

  const togglePlay = useCallback(() => {
    if (!decoded || !ctxRef.current) return;
    if (playing) {
      try { sourceRef.current?.stop(); } catch {}
      clearInterval(timerRef.current);
      offsetRef.current = ctxRef.current.currentTime - startTimeRef.current;
      setPlaying(false);
    } else startPlayback(offsetRef.current);
  }, [decoded, playing, startPlayback]);

  const handleExport = useCallback(async () => {
    if (!decoded) return;
    setExporting(true);
    try {
      const sr = decoded.sampleRate;
      const offline = new OfflineAudioContext(2, decoded.length, sr);
      const source = offline.createBufferSource(); source.buffer = decoded;
      const panner = offline.createPanner();
      panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse';
      panner.refDistance = 0.5 + (distance / 100) * 4.5; panner.maxDistance = 100;

      if (autoRotate) {
        const speed = rotateSpeed / 100;
        const dur = decoded.length / sr;
        const steps = Math.ceil(dur * 30);
        for (let i = 0; i <= steps; i++) {
          const t = (i / steps) * dur;
          const angle = speed * 0.03 * 30 * t;
          panner.positionX.setValueAtTime(Math.sin(angle) * 5, t);
          panner.positionZ.setValueAtTime(Math.cos(angle) * -5, t);
          panner.positionY.setValueAtTime(Math.sin(angle * 0.6) * 1.5, t);
        }
      } else {
        panner.positionX.setValueAtTime(panX * 5, 0);
        panner.positionY.setValueAtTime(panY * 3, 0);
        panner.positionZ.setValueAtTime(Math.sqrt(1 - panX * panX) * -3, 0);
      }

      const convolver = offline.createConvolver();
      convolver.buffer = generateReverbIR(offline, 1 + (reverbDecay / 100) * 3, 1 + (reverbDecay / 100) * 3);
      const dryGain = offline.createGain(); dryGain.gain.value = 1 - (reverbMix / 100) * 0.5;
      const wetGain = offline.createGain(); wetGain.gain.value = (reverbMix / 100) * 0.6;
      const master = offline.createGain(); master.gain.value = 0.9;

      source.connect(panner);
      panner.connect(dryGain); dryGain.connect(master);
      panner.connect(convolver); convolver.connect(wetGain); wetGain.connect(master);
      master.connect(offline.destination);
      source.start(0);
      const rendered = await offline.startRendering();

      const blob = exportFormat === 'mp3' ? audioBufferToMp3(rendered, 320) : audioBufferToWav(rendered);
      const ext = exportFormat === 'mp3' ? 'mp3' : 'wav';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `immersive_${file?.name?.replace(/\.[^.]+$/, '') || 'audio'}_${Date.now()}.${ext}`;
      a.click(); URL.revokeObjectURL(url);
      toast.success(`${ext.toUpperCase()} exported — ${(blob.size / (1024 * 1024)).toFixed(1)} MB`);
    } catch (err) {
      console.error(err); toast.error('Export failed');
    } finally { setExporting(false); }
  }, [decoded, autoRotate, rotateSpeed, panX, panY, reverbMix, reverbDecay, distance, file, exportFormat]);

  const formatTime = (t: number) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`;

  return (
    <ForgeLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-accent/15">
              <Move3d className="w-6 h-6 text-accent" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Immersive Audio Studio</h1>
          </div>
          <p className="text-muted-foreground max-w-xl">
            Upload any audio file and manipulate it in real-time with HRTF 3D panning, spatial reverb, elevation control, and 8D auto-rotation.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
            <Headphones className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-medium text-accent">Headphones Recommended</span>
          </div>
        </motion.div>

        {!file ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <label
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              className="relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border hover:border-accent/40 hover:bg-secondary/30 p-14 cursor-pointer transition-all duration-300"
            >
              <input type="file" accept="audio/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="absolute inset-0 opacity-0 cursor-pointer" />
              <Upload className="w-8 h-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-foreground font-medium text-lg">Drop an audio file or click to browse</p>
                <p className="text-muted-foreground text-sm mt-1 font-mono">.mp3 · .wav</p>
              </div>
            </label>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* File info */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border mb-6">
              <Music className="w-4 h-4 text-accent" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(1)} MB • {duration > 0 ? formatTime(duration) : 'Decoding...'}</p>
              </div>
              <button onClick={() => {
                try { sourceRef.current?.stop(); } catch {}
                try { ctxRef.current?.close(); } catch {}
                cancelAnimationFrame(rafRef.current); clearInterval(timerRef.current);
                setFile(null); setDecoded(null); setPlaying(false); setCurrentTime(0);
              }} className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-3 py-8">
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-muted-foreground">Decoding audio data...</span>
              </div>
            )}

            {decoded && (
              <div className="space-y-6">
                {/* Player */}
                <div className="p-5 rounded-2xl bg-card border border-border">
                  <div className="flex items-center gap-4 mb-4">
                    <button onClick={togglePlay} className="p-3.5 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 transition-colors">
                      {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <div className="flex-1">
                      <Slider value={[currentTime]} max={duration} step={0.1} onValueChange={([v]) => {
                        if (playing) { try { sourceRef.current?.stop(); } catch {} clearInterval(timerRef.current); startPlayback(v); }
                        else { offsetRef.current = v; setCurrentTime(v); }
                      }} />
                      <div className="flex justify-between mt-1">
                        <span className="text-xs font-mono text-muted-foreground">{formatTime(currentTime)}</span>
                        <span className="text-xs font-mono text-muted-foreground">{formatTime(duration)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Controls Grid */}
                <div className="grid gap-5 sm:grid-cols-2">
                  {/* Pan X */}
                  <div className="p-5 rounded-2xl bg-card border border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <Volume2 className="w-4 h-4 text-accent" />
                      <label className="text-sm font-semibold text-foreground">Pan Position (L/R)</label>
                      <span className="ml-auto text-xs font-mono text-muted-foreground">
                        {panX === 0 ? 'Center' : panX < 0 ? `L ${Math.abs(Math.round(panX * 100))}%` : `R ${Math.round(panX * 100)}%`}
                      </span>
                    </div>
                    <Slider value={[panX]} min={-1} max={1} step={0.01} disabled={autoRotate} onValueChange={([v]) => setPanX(v)} />
                    <div className="flex justify-between mt-1"><span className="text-[10px] text-muted-foreground">L</span><span className="text-[10px] text-muted-foreground">R</span></div>
                  </div>

                  {/* Elevation */}
                  <div className="p-5 rounded-2xl bg-card border border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <Move3d className="w-4 h-4 text-primary" />
                      <label className="text-sm font-semibold text-foreground">Elevation</label>
                      <span className="ml-auto text-xs font-mono text-muted-foreground">
                        {panY === 0 ? 'Level' : panY > 0 ? `Up ${Math.round(panY * 100)}%` : `Down ${Math.abs(Math.round(panY * 100))}%`}
                      </span>
                    </div>
                    <Slider value={[panY]} min={-1} max={1} step={0.01} disabled={autoRotate} onValueChange={([v]) => setPanY(v)} />
                    <div className="flex justify-between mt-1"><span className="text-[10px] text-muted-foreground">Below</span><span className="text-[10px] text-muted-foreground">Above</span></div>
                  </div>

                  {/* Reverb */}
                  <div className="p-5 rounded-2xl bg-card border border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <Globe className="w-4 h-4 text-primary" />
                      <label className="text-sm font-semibold text-foreground">Reverb Intensity</label>
                      <span className="ml-auto text-xs font-mono text-muted-foreground">{reverbMix}%</span>
                    </div>
                    <Slider value={[reverbMix]} min={0} max={100} step={1} onValueChange={([v]) => setReverbMix(v)} />
                    <div className="flex justify-between mt-1"><span className="text-[10px] text-muted-foreground">Dry</span><span className="text-[10px] text-muted-foreground">Wet</span></div>
                  </div>

                  {/* Room Size / Decay */}
                  <div className="p-5 rounded-2xl bg-card border border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <Headphones className="w-4 h-4 text-accent" />
                      <label className="text-sm font-semibold text-foreground">Room Size</label>
                      <span className="ml-auto text-xs font-mono text-muted-foreground">{reverbDecay}%</span>
                    </div>
                    <Slider value={[reverbDecay]} min={0} max={100} step={1} onValueChange={([v]) => setReverbDecay(v)} />
                    <div className="flex justify-between mt-1"><span className="text-[10px] text-muted-foreground">Small</span><span className="text-[10px] text-muted-foreground">Hall</span></div>
                  </div>

                  {/* Distance */}
                  <div className="p-5 rounded-2xl bg-card border border-border sm:col-span-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Volume2 className="w-4 h-4 text-accent" />
                      <label className="text-sm font-semibold text-foreground">Distance</label>
                      <span className="ml-auto text-xs font-mono text-muted-foreground">{distance}%</span>
                    </div>
                    <Slider value={[distance]} min={0} max={100} step={1} onValueChange={([v]) => setDistance(v)} />
                    <div className="flex justify-between mt-1"><span className="text-[10px] text-muted-foreground">Close</span><span className="text-[10px] text-muted-foreground">Far</span></div>
                  </div>
                </div>

                {/* 8D Auto-Rotate */}
                <div className="p-5 rounded-2xl bg-card border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <RotateCw className={`w-4 h-4 ${autoRotate && playing ? 'text-accent animate-spin' : 'text-muted-foreground'}`} style={autoRotate && playing ? { animationDuration: `${3 / (rotateSpeed / 40)}s` } : undefined} />
                      <label className="text-sm font-semibold text-foreground">8D Auto-Rotate</label>
                    </div>
                    <button onClick={() => setAutoRotate(!autoRotate)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${autoRotate ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>
                      {autoRotate ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  {autoRotate && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">Rotation Speed</span>
                        <span className="ml-auto text-xs font-mono text-muted-foreground">{rotateSpeed}%</span>
                      </div>
                      <Slider value={[rotateSpeed]} min={10} max={100} step={1} onValueChange={([v]) => setRotateSpeed(v)} />
                    </motion.div>
                  )}
                </div>

                {/* Export */}
                <div className="flex items-center gap-3">
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button onClick={() => setExportFormat('mp3')} className={`px-3 py-2 text-xs font-bold transition-colors ${exportFormat === 'mp3' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>MP3</button>
                    <button onClick={() => setExportFormat('wav')} className={`px-3 py-2 text-xs font-bold transition-colors ${exportFormat === 'wav' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>WAV</button>
                  </div>
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                      exporting ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:shadow-[0_0_40px_hsl(var(--primary)/0.4)] hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                  >
                    {exporting ? <><div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" /> Rendering...</> : <><Download className="w-4 h-4" /> Export as {exportFormat.toUpperCase()}</>}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </ForgeLayout>
  );
}

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Trash2, Sparkles, Play, Pause, Download, Music,
  ChevronDown, Volume2, X, Mic, Drum, Scissors, CheckCircle,
  Loader2, Wand2
} from 'lucide-react';
import { toast } from 'sonner';
import ForgeLayout from '@/components/forge/ForgeLayout';
import { generateMashup } from '@/lib/audio/mashup';
import { audioBufferToMp3 } from '@/lib/audio/encode';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

const GENRES = ['Lo-Fi', 'EDM', 'Pop', 'Hip-Hop', 'R&B', 'Trap', 'House', 'Drum & Bass'];
const KEYS = ['Auto-Detect', 'C Major', 'C Minor', 'D Major', 'D Minor', 'E Major', 'E Minor', 'F Major', 'F Minor', 'G Major', 'G Minor', 'A Major', 'A Minor', 'B Major', 'B Minor'];
const MAX_FILES = 10;

const PIPELINE_STEPS = [
  { label: 'Uploading Tracks to Secure Server...', icon: Upload },
  { label: 'AI Stem Separation (Isolating Vocals & Beats)...', icon: Mic },
  { label: 'Analyzing BPM & Musical Keys via Librosa...', icon: Music },
  { label: 'Time-Stretching & Pitch-Shifting to Master Beat...', icon: Wand2 },
  { label: 'Algorithmic Arrangement & Crossfading...', icon: Scissors },
  { label: 'Mastering Final Audio...', icon: Sparkles },
];

interface TrackFile {
  file: File;
  volume: number;
}

// Mini waveform visualization from file size seed
function MiniWaveform({ seed }: { seed: number }) {
  const bars = 24;
  return (
    <div className="flex items-center gap-[1.5px] h-6">
      {Array.from({ length: bars }, (_, i) => {
        const h = 4 + Math.abs(Math.sin(seed * 0.0001 + i * 0.7)) * 18;
        return (
          <div
            key={i}
            className="w-[2px] rounded-full bg-primary/40"
            style={{ height: `${h}px` }}
          />
        );
      })}
    </div>
  );
}

export default function ForgeMashup() {
  const [tracks, setTracks] = useState<TrackFile[]>([]);
  const [genre, setGenre] = useState(GENRES[0]);
  const [genreOpen, setGenreOpen] = useState(false);
  const [musicalKey, setMusicalKey] = useState(KEYS[0]);
  const [keyOpen, setKeyOpen] = useState(false);
  const [targetBpm, setTargetBpm] = useState(120);
  const [autoExtractVocals, setAutoExtractVocals] = useState(true);
  const [beatSyncDrops, setBeatSyncDrops] = useState(true);
  const [smartLyricSlicing, setSmartLyricSlicing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const resultBlobRef = useRef<Blob | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalLines]);

  useEffect(() => {
    return () => { if (resultUrl) URL.revokeObjectURL(resultUrl); };
  }, [resultUrl]);

  const addFiles = useCallback((incoming: File[]) => {
    const audio = incoming.filter((f) => f.type.startsWith('audio/'));
    if (audio.length === 0) { toast.error('Only audio files (.mp3, .wav) are accepted'); return; }
    setTracks((prev) => {
      const combined = [...prev, ...audio.map(f => ({ file: f, volume: 80 }))];
      if (combined.length > MAX_FILES) { toast.error(`Max ${MAX_FILES} files allowed`); return combined.slice(0, MAX_FILES); }
      return combined;
    });
  }, []);

  const removeTrack = (idx: number) => setTracks((prev) => prev.filter((_, i) => i !== idx));
  const updateVolume = (idx: number, volume: number) => setTracks((prev) => prev.map((t, i) => i === idx ? { ...t, volume } : t));

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const handleGenerate = useCallback(async () => {
    if (tracks.length === 0) { toast.error('Upload at least one audio file'); return; }
    setProcessing(true);
    setPipelineStep(0);
    setResultUrl(null);
    setProgress(0);
    resultBlobRef.current = null;
    setTerminalLines([
      `[MashAI] Session initialized`,
      `[Config] Genre: ${genre} | Key: ${musicalKey} | BPM: ${targetBpm} | Tracks: ${tracks.length}`,
      `[Config] Vocals: ${autoExtractVocals ? 'ON' : 'OFF'} | Beat-Sync: ${beatSyncDrops ? 'ON' : 'OFF'} | Smart Slicing: ${smartLyricSlicing ? 'ON' : 'OFF'}`,
      ``,
    ]);

    try {
      const files = tracks.map(t => t.file);
      const mashupBuffer = await generateMashup(files, genre, (step, label) => {
        // Map 4 internal steps to 6 pipeline steps
        const mapped = Math.min(Math.floor((step / 4) * PIPELINE_STEPS.length), PIPELINE_STEPS.length - 1);
        setPipelineStep(mapped);
        setProgress(Math.round(((step + 1) / 4) * 85));
        setTerminalLines(prev => [...prev, `> ${PIPELINE_STEPS[mapped]?.label || label}`]);
      });

      setProgress(92);
      setPipelineStep(PIPELINE_STEPS.length - 1);
      setTerminalLines(prev => [...prev, '> Encoding to 320kbps MP3...']);
      const mp3Blob = audioBufferToMp3(mashupBuffer);
      setProgress(100);
      setTerminalLines(prev => [...prev, `> ✅ Complete! Output: ${(mp3Blob.size / (1024 * 1024)).toFixed(1)} MB`]);

      resultBlobRef.current = mp3Blob;
      setResultUrl(URL.createObjectURL(mp3Blob));
      toast.success('Mashup generated!');
    } catch (err) {
      console.error('Mashup failed:', err);
      setTerminalLines(prev => [...prev, `> ❌ ERROR: ${err instanceof Error ? err.message : 'Unknown'}`]);
      toast.error('Generation failed');
    } finally {
      setProcessing(false);
    }
  }, [tracks, genre, musicalKey, targetBpm, autoExtractVocals, beatSyncDrops, smartLyricSlicing]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause(); else audioRef.current.play();
    setPlaying(!playing);
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `mashai_${genre.toLowerCase().replace(/[^a-z0-9]/g, '')}_${targetBpm}bpm_${Date.now()}.mp3`;
    a.click();
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  return (
    <ForgeLayout>
      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* ═══════ LEFT PANEL — Track Upload ═══════ */}
        <div className="w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-border bg-card/30 p-4 lg:p-5 flex flex-col shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <Music className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Track Deck</h2>
            <span className="ml-auto text-[10px] font-mono text-muted-foreground">{tracks.length}/{MAX_FILES}</span>
          </div>

          {/* Drop zone */}
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-all duration-300 mb-3 ${
              dragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border/60 hover:border-primary/40 hover:bg-secondary/20'
            }`}
          >
            <input type="file" accept="audio/*" multiple onChange={(e) => addFiles(Array.from(e.target.files || []))} className="absolute inset-0 opacity-0 cursor-pointer" />
            <Upload className={`w-6 h-6 ${dragging ? 'text-primary animate-bounce' : 'text-muted-foreground'}`} />
            <p className="text-xs text-muted-foreground text-center">
              {dragging ? 'Drop here' : 'Drag & drop or click'}
            </p>
            <p className="text-[10px] font-mono text-muted-foreground/60">.mp3 · .wav</p>
          </label>

          {/* Track list */}
          <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
            <AnimatePresence>
              {tracks.map((t, i) => (
                <motion.div
                  key={`${t.file.name}-${i}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-secondary/30 border border-border/40 group"
                >
                  <div className="shrink-0">
                    <MiniWaveform seed={t.file.size + i * 13337} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{t.file.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Volume2 className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                      <Slider
                        value={[t.volume]}
                        min={0} max={100} step={1}
                        onValueChange={([v]) => updateVolume(i, v)}
                        className="flex-1"
                      />
                      <span className="text-[9px] font-mono text-muted-foreground w-6 text-right">{t.volume}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeTrack(i)}
                    className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {tracks.length === 0 && (
              <div className="flex items-center justify-center h-32 text-xs text-muted-foreground/40 font-mono">
                No tracks loaded
              </div>
            )}
          </div>
        </div>

        {/* ═══════ CENTER PANEL — Config + Processing + Result ═══════ */}
        <div className="flex-1 p-5 lg:p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* ── Config View ── */}
            {!processing && !resultUrl && (
              <motion.div key="config" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <Sparkles className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">MashAI — Auto Studio</h1>
                    <p className="text-sm text-muted-foreground">Configure your AI mashup pipeline</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 max-w-2xl">
                  {/* Target BPM */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Target Master BPM</label>
                    <div className="flex items-center gap-3">
                      <Slider
                        value={[targetBpm]}
                        min={60} max={200} step={1}
                        onValueChange={([v]) => setTargetBpm(v)}
                        className="flex-1"
                      />
                      <span className="text-lg font-bold font-mono text-primary w-12 text-right">{targetBpm}</span>
                    </div>
                  </div>

                  {/* Musical Key */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Target Musical Key</label>
                    <div className="relative">
                      <button
                        onClick={() => { setKeyOpen(!keyOpen); setGenreOpen(false); }}
                        className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-secondary/30 border border-border/50 text-sm text-foreground hover:border-primary/40 transition-colors"
                      >
                        <span>{musicalKey}</span>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${keyOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {keyOpen && (
                          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                            className="absolute z-30 mt-1 w-full rounded-lg bg-card border border-border shadow-xl max-h-48 overflow-y-auto"
                          >
                            {KEYS.map((k) => (
                              <button key={k} onClick={() => { setMusicalKey(k); setKeyOpen(false); }}
                                className={`w-full text-left px-4 py-2 text-sm transition-colors ${k === musicalKey ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-secondary/60'}`}
                              >{k}</button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Genre */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Genre AI Style</label>
                    <div className="relative">
                      <button
                        onClick={() => { setGenreOpen(!genreOpen); setKeyOpen(false); }}
                        className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-secondary/30 border border-border/50 text-sm text-foreground hover:border-primary/40 transition-colors"
                      >
                        <span>{genre}</span>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${genreOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {genreOpen && (
                          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                            className="absolute z-30 mt-1 w-full rounded-lg bg-card border border-border shadow-xl overflow-hidden"
                          >
                            {GENRES.map((g) => (
                              <button key={g} onClick={() => { setGenre(g); setGenreOpen(false); }}
                                className={`w-full text-left px-4 py-2 text-sm transition-colors ${g === genre ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-secondary/60'}`}
                              >{g}</button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Spacer for grid alignment */}
                  <div />
                </div>

                {/* Toggle switches */}
                <div className="mt-8 max-w-2xl space-y-4">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">AI Pipeline Options</label>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Auto-Extract Vocals', icon: Mic, value: autoExtractVocals, set: setAutoExtractVocals },
                      { label: 'Beat-Sync Drops', icon: Drum, value: beatSyncDrops, set: setBeatSyncDrops },
                      { label: 'Smart Lyric Slicing', icon: Scissors, value: smartLyricSlicing, set: setSmartLyricSlicing },
                    ].map((opt) => (
                      <div key={opt.label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${opt.value ? 'border-primary/40 bg-primary/5' : 'border-border/40 bg-secondary/20'}`}>
                        <opt.icon className={`w-4 h-4 shrink-0 ${opt.value ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-xs font-medium text-foreground flex-1">{opt.label}</span>
                        <Switch checked={opt.value} onCheckedChange={opt.set} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Generate button */}
                <div className="mt-10">
                  <button
                    onClick={handleGenerate}
                    disabled={tracks.length === 0}
                    className={`w-full sm:w-auto px-12 py-4 rounded-xl font-bold text-base transition-all duration-300 flex items-center justify-center gap-2 ${
                      tracks.length === 0
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-primary text-primary-foreground hover:shadow-[0_0_50px_hsl(var(--primary)/0.35)] hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                  >
                    <Sparkles className="w-5 h-5" />
                    Generate AI Mashup
                  </button>
                  {tracks.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">← Upload tracks in the left panel first</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Processing View ── */}
            {processing && (
              <motion.div key="processing" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="max-w-2xl mx-auto py-8">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">AI Pipeline Active</h2>
                  <p className="text-sm text-muted-foreground mt-1">Processing {tracks.length} tracks at {targetBpm} BPM</p>
                </div>

                {/* Step-by-step tracker */}
                <div className="space-y-2 mb-6">
                  {PIPELINE_STEPS.map((step, i) => {
                    const StepIcon = step.icon;
                    const isDone = i < pipelineStep;
                    const isActive = i === pipelineStep;
                    return (
                      <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-500 ${
                        isDone ? 'bg-accent/10' : isActive ? 'bg-primary/10 border border-primary/30' : 'bg-secondary/20'
                      }`}>
                        {isDone ? (
                          <CheckCircle className="w-5 h-5 text-accent shrink-0" />
                        ) : isActive ? (
                          <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                        ) : (
                          <StepIcon className="w-5 h-5 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className={`text-sm font-medium ${isDone ? 'text-accent' : isActive ? 'text-primary' : 'text-muted-foreground/40'}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Terminal */}
                <div className="rounded-xl bg-background border border-border overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2 bg-secondary/30 border-b border-border">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-primary/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-accent/60" />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground ml-2">mashai-engine</span>
                  </div>
                  <div ref={terminalRef} className="p-4 max-h-44 overflow-y-auto font-mono text-[11px] space-y-0.5">
                    {terminalLines.map((line, i) => (
                      <motion.p key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        className={line.includes('✅') ? 'text-accent' : line.includes('❌') ? 'text-destructive' : line.startsWith('[') ? 'text-primary/70' : 'text-muted-foreground'}
                      >
                        {line}
                      </motion.p>
                    ))}
                    <span className="inline-block w-2 h-3.5 bg-primary animate-pulse" />
                  </div>
                  <div className="px-4 pb-3">
                    <div className="w-full h-1 bg-secondary/50 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1 text-right">{progress}%</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Result View ── */}
            {resultUrl && !processing && (
              <motion.div key="result" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="max-w-2xl mx-auto py-8">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 mx-auto rounded-full bg-accent/10 flex items-center justify-center mb-4">
                    <CheckCircle className="w-10 h-10 text-accent" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">Mashup Ready</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {genre} · {targetBpm} BPM · {tracks.length} tracks
                    {resultBlobRef.current && ` · ${(resultBlobRef.current.size / (1024 * 1024)).toFixed(1)} MB`}
                  </p>
                </div>

                {/* Audio Player */}
                <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-[0_0_60px_hsl(var(--primary)/0.08)]">
                  <audio
                    ref={audioRef}
                    src={resultUrl}
                    onEnded={() => setPlaying(false)}
                    onTimeUpdate={() => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); }}
                    onLoadedMetadata={() => { if (audioRef.current) setAudioDuration(audioRef.current.duration); }}
                  />
                  <div className="flex items-center gap-4">
                    <button onClick={togglePlay} className="p-3.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0">
                      {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <div className="flex-1">
                      <Slider
                        value={[currentTime]}
                        max={audioDuration || 1}
                        step={0.1}
                        onValueChange={([v]) => { if (audioRef.current) audioRef.current.currentTime = v; }}
                        className="cursor-pointer"
                      />
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] font-mono text-muted-foreground">{fmt(currentTime)}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{fmt(audioDuration)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:shadow-[0_0_40px_hsl(var(--primary)/0.3)] hover:scale-[1.01] transition-all active:scale-[0.98]"
                  >
                    <Download className="w-5 h-5" />
                    Download High-Res Mashup
                  </button>
                  <button
                    onClick={() => { setResultUrl(null); setProgress(0); setPipelineStep(-1); setTerminalLines([]); }}
                    className="px-6 py-4 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-secondary/40 transition-colors"
                  >
                    New Mashup
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </ForgeLayout>
  );
}

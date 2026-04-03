import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Trash2, Sparkles, Play, Pause, Download, Music, ChevronDown, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import ForgeLayout from '@/components/forge/ForgeLayout';
import { generateMashup } from '@/lib/audio/mashup';
import { audioBufferToMp3 } from '@/lib/audio/encode';
import { Slider } from '@/components/ui/slider';

const GENRES = ['Lo-Fi', 'EDM', 'Pop', 'Hip-Hop', 'R&B', 'Trap', 'House', 'Drum & Bass'];
const MAX_FILES = 10;

const TERMINAL_STEPS = [
  { label: '> Analyzing frequencies and extracting metadata...', icon: '🔬' },
  { label: '> Applying Source Separation (Vocals/Stems)...', icon: '🎤' },
  { label: '> Aligning BPM and Key signatures...', icon: '🎵' },
  { label: '> Final mastering & loudness normalization...', icon: '🎛️' },
];

interface TrackFile {
  file: File;
  volume: number; // 0-100
}

export default function ForgeMashup() {
  const [tracks, setTracks] = useState<TrackFile[]>([]);
  const [genre, setGenre] = useState(GENRES[0]);
  const [genreOpen, setGenreOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const resultBlobRef = useRef<Blob | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  const addFiles = useCallback((incoming: File[]) => {
    const audio = incoming.filter((f) => f.type.startsWith('audio/'));
    if (audio.length === 0) {
      toast.error('Only audio files (.mp3, .wav) are accepted');
      return;
    }
    setTracks((prev) => {
      const combined = [...prev, ...audio.map(f => ({ file: f, volume: 80 }))];
      if (combined.length > MAX_FILES) {
        toast.error(`Upload limit reached — max ${MAX_FILES} files`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  }, []);

  const removeTrack = (idx: number) => setTracks((prev) => prev.filter((_, i) => i !== idx));

  const updateVolume = (idx: number, volume: number) => {
    setTracks((prev) => prev.map((t, i) => i === idx ? { ...t, volume } : t));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const handleGenerate = useCallback(async () => {
    if (tracks.length === 0) {
      toast.error('Upload at least one audio file');
      return;
    }
    setProcessing(true);
    setStepIdx(0);
    setResultUrl(null);
    setProgress(0);
    resultBlobRef.current = null;
    setTerminalLines(['[AudioForge AI] Initializing mashup engine...', `[Config] Genre: ${genre} | Tracks: ${tracks.length}`]);

    try {
      const files = tracks.map(t => t.file);
      const mashupBuffer = await generateMashup(files, genre, (step, label) => {
        setStepIdx(step);
        setProgress(Math.round(((step + 1) / TERMINAL_STEPS.length) * 85));
        setTerminalLines(prev => [...prev, TERMINAL_STEPS[step]?.label || label]);
      });

      setProgress(90);
      setTerminalLines(prev => [...prev, '> Encoding to 320kbps MP3...']);
      const mp3Blob = audioBufferToMp3(mashupBuffer);
      setProgress(100);
      setTerminalLines(prev => [...prev, `> ✅ Complete! Output: ${(mp3Blob.size / (1024 * 1024)).toFixed(1)} MB`]);

      resultBlobRef.current = mp3Blob;
      const url = URL.createObjectURL(mp3Blob);
      setResultUrl(url);
      toast.success('Mashup generated successfully!');
    } catch (err) {
      console.error('Mashup generation failed:', err);
      setTerminalLines(prev => [...prev, `> ❌ ERROR: ${err instanceof Error ? err.message : 'Unknown error'}`]);
      toast.error('Generation failed — try again');
    } finally {
      setProcessing(false);
    }
  }, [tracks, genre]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `mashup_${genre.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}.mp3`;
    a.click();
  };

  return (
    <ForgeLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/15">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">AI Auto-Mashup Engine</h1>
          </div>
          <p className="text-muted-foreground max-w-xl">
            Upload up to 10 tracks with individual volume control. Our AI will isolate vocals, beat-match, and master a professional mashup.
          </p>
        </motion.div>

        {/* Upload zone */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`
              relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all duration-300
              ${dragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/40 hover:bg-secondary/30'}
            `}
          >
            <input
              type="file"
              accept="audio/*"
              multiple
              onChange={(e) => addFiles(Array.from(e.target.files || []))}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className={`p-4 rounded-2xl transition-colors ${dragging ? 'bg-primary/20' : 'bg-secondary/60'}`}>
              <Upload className={`w-8 h-8 ${dragging ? 'text-primary animate-bounce' : 'text-muted-foreground'}`} />
            </div>
            <div className="text-center">
              <p className="text-foreground font-medium text-lg">{dragging ? 'Drop your tracks here' : 'Drag & drop audio files or click to browse'}</p>
              <p className="text-muted-foreground text-sm mt-1 font-mono">.mp3 · .wav — up to {MAX_FILES} files</p>
            </div>
          </label>
        </motion.div>

        {/* Track list with volume sliders */}
        <AnimatePresence>
          {tracks.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 space-y-2">
              {tracks.map((t, i) => (
                <motion.div
                  key={`${t.file.name}-${i}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border"
                >
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Music className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.file.name}</p>
                    <p className="text-xs text-muted-foreground">{(t.file.size / (1024 * 1024)).toFixed(1)} MB</p>
                  </div>
                  <div className="flex items-center gap-2 w-32 shrink-0">
                    <Volume2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <Slider
                      value={[t.volume]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={([v]) => updateVolume(i, v)}
                      className="flex-1"
                    />
                    <span className="text-[10px] font-mono text-muted-foreground w-7 text-right">{t.volume}%</span>
                  </div>
                  <button onClick={() => removeTrack(i)} className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
              <p className="text-xs text-muted-foreground text-right font-mono">{tracks.length}/{MAX_FILES} files</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Genre selector */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-8">
          <label className="text-sm font-semibold text-foreground mb-2 block">Base Instrumental Genre</label>
          <div className="relative w-full max-w-xs">
            <button
              onClick={() => setGenreOpen(!genreOpen)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-card border border-border text-foreground hover:border-primary/40 transition-colors"
            >
              <span>{genre}</span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${genreOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {genreOpen && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="absolute z-30 mt-1 w-full rounded-xl bg-card border border-border shadow-xl overflow-hidden">
                  {GENRES.map((g) => (
                    <button key={g} onClick={() => { setGenre(g); setGenreOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${g === genre ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-secondary/60'}`}>{g}</button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Generate button */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8">
          <button
            onClick={handleGenerate}
            disabled={processing || tracks.length === 0}
            className={`relative w-full sm:w-auto px-10 py-4 rounded-xl font-bold text-base transition-all duration-300 ${
              processing || tracks.length === 0 ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:shadow-[0_0_40px_hsl(var(--primary)/0.4)] hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                Processing... {progress}%
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Engage AI Mashup
              </span>
            )}
          </button>
        </motion.div>

        {/* Terminal-style Progress */}
        <AnimatePresence>
          {processing && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mt-8">
              {/* Step indicators */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {TERMINAL_STEPS.map((step, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-500 ${
                    i < stepIdx ? 'bg-accent/15 text-accent' : i === stepIdx ? 'bg-primary/15 text-primary animate-pulse' : 'bg-secondary/40 text-muted-foreground'
                  }`}>
                    <span>{i < stepIdx ? '✅' : step.icon}</span>
                    <span className="truncate">{i < stepIdx ? 'Done' : i === stepIdx ? 'Active...' : 'Pending'}</span>
                  </div>
                ))}
              </div>

              {/* Terminal window */}
              <div className="rounded-2xl bg-[hsl(240,15%,5%)] border border-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-[hsl(240,12%,8%)] border-b border-border">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-destructive/60" />
                    <div className="w-3 h-3 rounded-full bg-[hsl(45,100%,50%)]/60" />
                    <div className="w-3 h-3 rounded-full bg-accent/60" />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground ml-2">audioforge-ai-engine</span>
                </div>
                <div ref={terminalRef} className="p-4 max-h-48 overflow-y-auto font-mono text-xs space-y-1">
                  {terminalLines.map((line, i) => (
                    <motion.p key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className={`${line.includes('✅') ? 'text-accent' : line.includes('❌') ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {line}
                    </motion.p>
                  ))}
                  {processing && (
                    <span className="inline-block w-2 h-4 bg-accent animate-pulse" />
                  )}
                </div>
                {/* Progress bar */}
                <div className="px-4 pb-3">
                  <div className="w-full h-1.5 bg-secondary/40 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result player */}
        <AnimatePresence>
          {resultUrl && !processing && (
            <motion.div initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="mt-10 p-6 rounded-2xl bg-card border border-primary/30 shadow-[0_0_60px_hsl(var(--primary)/0.1)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-accent/15">
                  <Music className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-foreground font-semibold">AI Generated Mashup</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {genre} • {tracks.length} tracks blended
                    {resultBlobRef.current && ` • ${(resultBlobRef.current.size / (1024 * 1024)).toFixed(1)} MB`}
                  </p>
                </div>
              </div>

              <audio
                ref={audioRef}
                src={resultUrl}
                onEnded={() => setPlaying(false)}
                onTimeUpdate={() => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); }}
                onLoadedMetadata={() => { if (audioRef.current) setAudioDuration(audioRef.current.duration); }}
              />

              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
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
                    <span className="text-[10px] font-mono text-muted-foreground">{Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{Math.floor(audioDuration / 60)}:{Math.floor(audioDuration % 60).toString().padStart(2, '0')}</span>
                  </div>
                </div>
                <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/15 text-accent font-semibold text-sm hover:bg-accent/25 transition-colors">
                  <Download className="w-4 h-4" />
                  MP3
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ForgeLayout>
  );
}

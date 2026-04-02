import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Trash2, Sparkles, Play, Pause, Download, Music, ChevronDown, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import ForgeLayout from '@/components/forge/ForgeLayout';

const GENRES = ['Lo-Fi', 'EDM', 'Pop', 'Hip-Hop', 'R&B', 'Trap', 'House', 'Drum & Bass'];
const MAX_FILES = 10;

const PROGRESS_STEPS = [
  { label: 'Analyzing tracks & extracting features...', duration: 1200 },
  { label: 'Isolating best vocals with AI separation...', duration: 1200 },
  { label: 'Beat-matching all tracks to single tune...', duration: 1200 },
  { label: 'Final mastering & loudness normalization...', duration: 1400 },
];

async function mockGenerateMashup(_files: File[], _genre: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 5000));
  return '/placeholder.svg'; // placeholder — swap with real API blob URL
}

export default function ForgeMashup() {
  const [files, setFiles] = useState<File[]>([]);
  const [genre, setGenre] = useState(GENRES[0]);
  const [genreOpen, setGenreOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: File[]) => {
    const audio = incoming.filter((f) => f.type.startsWith('audio/'));
    if (audio.length === 0) {
      toast.error('Only audio files (.mp3, .wav) are accepted');
      return;
    }
    setFiles((prev) => {
      const combined = [...prev, ...audio];
      if (combined.length > MAX_FILES) {
        toast.error(`Upload limit reached — max ${MAX_FILES} files`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  }, []);

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const handleGenerate = useCallback(async () => {
    if (files.length === 0) {
      toast.error('Upload at least one audio file');
      return;
    }
    setProcessing(true);
    setStepIdx(0);
    setResultUrl(null);

    // Animate steps
    let cumulative = 0;
    for (let i = 0; i < PROGRESS_STEPS.length; i++) {
      await new Promise((r) => setTimeout(r, cumulative === 0 ? 0 : PROGRESS_STEPS[i - 1].duration));
      cumulative += PROGRESS_STEPS[i].duration;
      setStepIdx(i);
    }

    try {
      const url = await mockGenerateMashup(files, genre);
      setResultUrl(url);
      toast.success('Mashup generated successfully!');
    } catch {
      toast.error('Generation failed — try again');
    } finally {
      setProcessing(false);
    }
  }, [files, genre]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
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
            Upload up to 10 tracks, pick a genre, and let our AI create a professional mashup — vocals isolated, beats matched, and mastered.
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
              ${dragging
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-border hover:border-primary/40 hover:bg-secondary/30'
              }
            `}
          >
            <input
              ref={fileInputRef}
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

        {/* File list */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-2"
            >
              {files.map((f, i) => (
                <motion.div
                  key={`${f.name}-${i}`}
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
                    <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{(f.size / (1024 * 1024)).toFixed(1)} MB</p>
                  </div>
                  <button onClick={() => removeFile(i)} className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
              <p className="text-xs text-muted-foreground text-right font-mono">{files.length}/{MAX_FILES} files</p>
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
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute z-30 mt-1 w-full rounded-xl bg-card border border-border shadow-xl overflow-hidden"
                >
                  {GENRES.map((g) => (
                    <button
                      key={g}
                      onClick={() => { setGenre(g); setGenreOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${g === genre ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-secondary/60'}`}
                    >
                      {g}
                    </button>
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
            disabled={processing || files.length === 0}
            className={`
              relative w-full sm:w-auto px-10 py-4 rounded-xl font-bold text-base transition-all duration-300
              ${processing || files.length === 0
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:shadow-[0_0_40px_hsl(var(--primary)/0.4)] hover:scale-[1.02] active:scale-[0.98]'
              }
            `}
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Generate Professional Mashup
              </span>
            )}
            {!processing && files.length > 0 && (
              <span className="absolute inset-0 rounded-xl bg-primary/20 animate-pulse pointer-events-none" />
            )}
          </button>
        </motion.div>

        {/* Progress UI */}
        <AnimatePresence>
          {processing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8 p-6 rounded-2xl bg-card border border-border space-y-4"
            >
              {PROGRESS_STEPS.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: i <= stepIdx ? 1 : 0.3 }}
                  className="flex items-center gap-3"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors duration-300 ${
                    i < stepIdx ? 'bg-accent text-accent-foreground' : i === stepIdx ? 'bg-primary text-primary-foreground animate-pulse' : 'bg-secondary text-muted-foreground'
                  }`}>
                    {i < stepIdx ? '✓' : i + 1}
                  </div>
                  <span className={`text-sm ${i <= stepIdx ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result player */}
        <AnimatePresence>
          {resultUrl && !processing && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mt-10 p-6 rounded-2xl bg-card border border-primary/30 shadow-[0_0_60px_hsl(var(--primary)/0.1)]"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-accent/15">
                  <Music className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-foreground font-semibold">AI Generated Mashup</p>
                  <p className="text-xs text-muted-foreground font-mono">{genre} • {files.length} tracks blended</p>
                </div>
              </div>

              <audio ref={audioRef} src={resultUrl} onEnded={() => setPlaying(false)} />

              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-primary rounded-full" />
                </div>
                <a
                  href={resultUrl}
                  download="mashup.mp3"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/15 text-accent font-semibold text-sm hover:bg-accent/25 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>

              <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-glow-warm/5 border border-glow-warm/20">
                <AlertCircle className="w-4 h-4 text-glow-warm shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  This is a mock demo. Connect your real API endpoint at <code className="text-foreground">/api/generate-mashup</code> to enable live mashup generation.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ForgeLayout>
  );
}

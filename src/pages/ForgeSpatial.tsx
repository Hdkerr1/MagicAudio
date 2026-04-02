import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Play, Pause, Download, ChevronDown, AlertCircle, Loader2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import ForgeLayout from '@/components/forge/ForgeLayout';

const ENGINES = [
  { id: '8d-immersive', label: '8D Immersive Engine', desc: '360° binaural rotation with HRTF panning' },
  { id: '3d-surround', label: '3D Surround Sound', desc: 'Mid/Side stereo expansion with Haas delays' },
  { id: 'concert-hall', label: 'Live Concert Hall', desc: 'Stadium reverb with crowd ambience layer' },
  { id: 'bass-boost', label: 'Studio Bass Boost', desc: 'Sub-harmonic synthesis with controlled dynamics' },
];

const PROGRESS_STEPS = [
  { label: 'Validating YouTube URL...', duration: 800 },
  { label: 'Extracting high-quality audio stream...', duration: 1200 },
  { label: 'Applying spatial audio algorithms...', duration: 1200 },
  { label: 'Mastering & finalizing output...', duration: 800 },
];

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be');
  } catch {
    return false;
  }
}

async function mockConvertSpatial(_url: string, _engine: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 4000));
  return '/placeholder.svg';
}

export default function ForgeSpatial() {
  const [url, setUrl] = useState('');
  const [engine, setEngine] = useState(ENGINES[0]);
  const [engineOpen, setEngineOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleConvert = useCallback(async () => {
    if (!url.trim()) {
      toast.error('Please paste a YouTube URL');
      return;
    }
    if (!isValidUrl(url.trim())) {
      toast.error('Invalid link — please use a valid YouTube URL');
      return;
    }

    setProcessing(true);
    setStepIdx(0);
    setResultUrl(null);

    let cumulative = 0;
    for (let i = 0; i < PROGRESS_STEPS.length; i++) {
      await new Promise((r) => setTimeout(r, cumulative === 0 ? 0 : PROGRESS_STEPS[i - 1].duration));
      cumulative += PROGRESS_STEPS[i].duration;
      setStepIdx(i);
    }

    try {
      const result = await mockConvertSpatial(url, engine.id);
      setResultUrl(result);
      toast.success('Spatial audio generated!');
    } catch {
      toast.error('Conversion failed — try again');
    } finally {
      setProcessing(false);
    }
  }, [url, engine]);

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
            <div className="p-2.5 rounded-xl bg-accent/15">
              <Globe className="w-6 h-6 text-accent" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">YouTube → Spatial Audio</h1>
          </div>
          <p className="text-muted-foreground max-w-xl">
            Paste any YouTube link and convert it into immersive 3D/8D spatial audio with professional-grade processing.
          </p>
        </motion.div>

        {/* URL Input */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="relative">
            <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste YouTube Link here..."
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-card border-2 border-border text-foreground text-lg placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent/60 focus:shadow-[0_0_30px_hsl(var(--accent)/0.1)] transition-all"
            />
          </div>
        </motion.div>

        {/* Engine selector */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6">
          <label className="text-sm font-semibold text-foreground mb-2 block">Spatial Engine</label>
          <div className="relative w-full max-w-md">
            <button
              onClick={() => setEngineOpen(!engineOpen)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-card border border-border text-foreground hover:border-accent/40 transition-colors"
            >
              <div className="text-left">
                <p className="font-medium">{engine.label}</p>
                <p className="text-xs text-muted-foreground">{engine.desc}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 ml-2 transition-transform ${engineOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {engineOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute z-30 mt-1 w-full rounded-xl bg-card border border-border shadow-xl overflow-hidden"
                >
                  {ENGINES.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => { setEngine(e); setEngineOpen(false); }}
                      className={`w-full text-left px-4 py-3 transition-colors ${e.id === engine.id ? 'bg-accent/15' : 'hover:bg-secondary/60'}`}
                    >
                      <p className={`text-sm font-medium ${e.id === engine.id ? 'text-accent' : 'text-foreground'}`}>{e.label}</p>
                      <p className="text-xs text-muted-foreground">{e.desc}</p>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Convert button */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8">
          <button
            onClick={handleConvert}
            disabled={processing || !url.trim()}
            className={`
              relative w-full sm:w-auto px-10 py-4 rounded-xl font-bold text-base transition-all duration-300
              ${processing || !url.trim()
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-accent text-accent-foreground hover:shadow-[0_0_40px_hsl(var(--accent)/0.4)] hover:scale-[1.02] active:scale-[0.98]'
              }
            `}
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Converting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Convert & Process
              </span>
            )}
          </button>
        </motion.div>

        {/* Progress */}
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
                    i < stepIdx ? 'bg-primary text-primary-foreground' : i === stepIdx ? 'bg-accent text-accent-foreground animate-pulse' : 'bg-secondary text-muted-foreground'
                  }`}>
                    {i < stepIdx ? '✓' : i + 1}
                  </div>
                  <span className={`text-sm ${i <= stepIdx ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result */}
        <AnimatePresence>
          {resultUrl && !processing && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mt-10 p-6 rounded-2xl bg-card border border-accent/30 shadow-[0_0_60px_hsl(var(--accent)/0.1)]"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/15">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-foreground font-semibold">Spatial Audio Output</p>
                  <p className="text-xs text-muted-foreground font-mono">{engine.label} • 🎧 Best with headphones</p>
                </div>
              </div>

              <audio ref={audioRef} src={resultUrl} onEnded={() => setPlaying(false)} />

              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="p-3 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 transition-colors">
                  {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-accent rounded-full" />
                </div>
                <a
                  href={resultUrl}
                  download="spatial-audio.mp3"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/15 text-primary font-semibold text-sm hover:bg-primary/25 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>

              <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-glow-warm/5 border border-glow-warm/20">
                <AlertCircle className="w-4 h-4 text-glow-warm shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  This is a mock demo. Connect your API at <code className="text-foreground">/api/convert-spatial</code> to enable live processing.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ForgeLayout>
  );
}

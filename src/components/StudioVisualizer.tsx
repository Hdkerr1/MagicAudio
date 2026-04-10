import { useRef, useEffect, useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, BarChart3, Orbit } from 'lucide-react';

type VisMode = 'spectrum' | 'rta' | 'aura';

interface StudioVisualizerProps {
  getAnalyser: () => AnalyserNode | null;
}

/* ─── Bass isolation: average of bins covering ~20-250Hz ─── */
function calcBassValue(data: Uint8Array, binCount: number, sampleRate: number): number {
  const nyquist = sampleRate / 2;
  const lowBin = Math.floor((20 / nyquist) * binCount);
  const highBin = Math.min(Math.floor((250 / nyquist) * binCount), binCount - 1);
  let sum = 0;
  for (let i = lowBin; i <= highBin; i++) sum += data[i];
  return sum / ((highBin - lowBin + 1) * 255);
}

/* ─── Peak hold state for RTA ─── */
const peakHold: Float32Array = new Float32Array(128);
const peakDecay: Float32Array = new Float32Array(128);

/* ─── Particle pool for Aura ─── */
interface Particle { x: number; y: number; vx: number; vy: number; life: number; size: number; hue: number }
const particles: Particle[] = [];

/* ─── Drawing Functions ─── */

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'hsla(240, 10%, 25%, 0.25)';
  ctx.lineWidth = 0.5;
  // Horizontal
  const hLines = 8;
  for (let i = 1; i < hLines; i++) {
    const y = (h / hLines) * i;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  // Vertical
  const vLines = 16;
  for (let i = 1; i < vLines; i++) {
    const x = (w / vLines) * i;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
}

function drawFreqLabels(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = 'hsla(240, 5%, 40%, 0.6)';
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  const freqs = [50, 100, 200, 500, '1k', '2k', '5k', '10k', '20k'];
  freqs.forEach((f, i) => {
    const x = ((i + 0.5) / freqs.length) * w;
    ctx.fillText(String(f), x, h - 4);
  });
  // dB labels
  ctx.textAlign = 'right';
  const dbs = [0, -6, -12, -24, -48];
  dbs.forEach((db, i) => {
    const y = (i / (dbs.length - 1)) * (h - 20) + 12;
    ctx.fillText(`${db}dB`, w - 4, y);
  });
}

/* ── Style 1: Studio Spectrum Analyzer (Parametric EQ curve) ── */
function drawSpectrum(ctx: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array, bassVal: number) {
  drawGrid(ctx, w, h);
  drawFreqLabels(ctx, w, h);

  const count = data.length;
  const usableH = h - 16;

  // Build smooth curve points with logarithmic frequency mapping
  const points: [number, number][] = [];
  for (let i = 1; i < count; i++) {
    const logX = Math.log10(i) / Math.log10(count);
    const x = logX * w;
    const val = data[i] / 255;
    const y = usableH - val * usableH;
    points.push([x, y]);
  }

  // Filled gradient area
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, `hsla(185, 100%, 50%, ${0.25 + bassVal * 0.35})`);
  grad.addColorStop(0.5, `hsla(250, 90%, 55%, ${0.2 + bassVal * 0.3})`);
  grad.addColorStop(1, `hsla(270, 95%, 60%, ${0.15 + bassVal * 0.25})`);

  ctx.beginPath();
  ctx.moveTo(0, usableH);
  
  // Smooth Bézier curve
  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      ctx.lineTo(points[0][0], points[0][1]);
    } else {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev[0] + curr[0]) / 2;
      ctx.quadraticCurveTo(prev[0], prev[1], cpx, (prev[1] + curr[1]) / 2);
    }
  }
  if (points.length > 0) {
    const last = points[points.length - 1];
    ctx.lineTo(last[0], last[1]);
  }
  ctx.lineTo(w, usableH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Stroke the top edge with glow
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      ctx.moveTo(points[0][0], points[0][1]);
    } else {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev[0] + curr[0]) / 2;
      ctx.quadraticCurveTo(prev[0], prev[1], cpx, (prev[1] + curr[1]) / 2);
    }
  }
  ctx.strokeStyle = `hsla(185, 100%, 60%, ${0.6 + bassVal * 0.4})`;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = 'hsla(185, 100%, 50%, 0.5)';
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/* ── Style 2: Hardware RTA LED Blocks ── */
function drawRTA(ctx: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array, bassVal: number) {
  drawGrid(ctx, w, h);

  const barCount = 48;
  const segmentCount = 24;
  const barW = (w / barCount) * 0.72;
  const gap = (w / barCount) * 0.28;
  const segH = (h - 20) / segmentCount;
  const segGap = 1.5;
  const usableH = h - 20;

  for (let i = 0; i < barCount; i++) {
    // Log-mapped frequency index
    const freqIdx = Math.floor(Math.pow(i / barCount, 1.8) * data.length * 0.8);
    const val = data[freqIdx] / 255;
    const activeSegs = Math.floor(val * segmentCount);
    const x = i * (barW + gap) + gap / 2;

    // Draw LED segments
    for (let s = 0; s < activeSegs; s++) {
      const y = usableH - (s + 1) * segH;
      const ratio = s / segmentCount;

      let color: string;
      if (ratio > 0.85) color = `hsla(0, 85%, 55%, 0.95)`;       // Red peak
      else if (ratio > 0.7) color = `hsla(30, 95%, 55%, 0.9)`;   // Orange
      else if (ratio > 0.5) color = `hsla(50, 90%, 50%, 0.85)`;  // Yellow
      else color = `hsla(160, 80%, 45%, 0.8)`;                     // Green

      ctx.fillStyle = color;
      ctx.fillRect(x, y, barW, segH - segGap);
    }

    // Peak hold
    if (peakHold.length <= i) continue;
    if (val > peakHold[i]) {
      peakHold[i] = val;
      peakDecay[i] = 0;
    } else {
      peakDecay[i] += 0.008;
      peakHold[i] = Math.max(0, peakHold[i] - peakDecay[i] * 0.02);
    }

    const peakSeg = Math.floor(peakHold[i] * segmentCount);
    if (peakSeg > 0) {
      const peakY = usableH - peakSeg * segH;
      const peakRatio = peakSeg / segmentCount;
      let peakColor: string;
      if (peakRatio > 0.85) peakColor = 'hsla(0, 90%, 60%, 1)';
      else if (peakRatio > 0.5) peakColor = 'hsla(50, 95%, 60%, 1)';
      else peakColor = 'hsla(160, 85%, 55%, 1)';

      ctx.fillStyle = peakColor;
      ctx.shadowColor = peakColor;
      ctx.shadowBlur = 4;
      ctx.fillRect(x, peakY, barW, 2);
      ctx.shadowBlur = 0;
    }
  }

  // Bass thump - subtle screen flash
  if (bassVal > 0.5) {
    ctx.fillStyle = `hsla(185, 100%, 50%, ${(bassVal - 0.5) * 0.06})`;
    ctx.fillRect(0, 0, w, h);
  }

  drawFreqLabels(ctx, w, h);
}

/* ── Style 3: 3D Immersive Beat React Aura ── */
function drawAura(ctx: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array, bassVal: number, time: number) {
  const cx = w / 2, cy = h / 2;
  const baseR = Math.min(w, h) * 0.18;
  const r = baseR + bassVal * baseR * 1.6;
  const midAvg = Array.from(data.slice(10, 80)).reduce((a, b) => a + b, 0) / (70 * 255);
  const highAvg = Array.from(data.slice(80, 200)).reduce((a, b) => a + b, 0) / (120 * 255);

  // Background radial glow
  const bgGrad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 3.5);
  bgGrad.addColorStop(0, `hsla(185, 100%, 50%, ${0.03 + bassVal * 0.08})`);
  bgGrad.addColorStop(0.4, `hsla(270, 90%, 55%, ${0.02 + bassVal * 0.04})`);
  bgGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Multiple concentric rings with depth
  const ringCount = 4;
  for (let layer = 0; layer < ringCount; layer++) {
    const layerR = r * (0.5 + layer * 0.22);
    const alpha = 0.1 + layer * 0.2;
    const hue = 185 + layer * 30;
    const sliceAngle = (2 * Math.PI) / data.length;

    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const val = data[i] / 255;
      const rad = layerR + val * baseR * (0.2 + layer * 0.15);
      const angle = i * sliceAngle - Math.PI / 2 + time * 0.0002 * (layer + 1);
      const x = cx + Math.cos(angle) * rad;
      const y = cy + Math.sin(angle) * rad;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = `hsla(${hue}, 90%, 60%, ${alpha})`;
    ctx.lineWidth = 1.8 - layer * 0.3;
    ctx.shadowColor = `hsla(${hue}, 100%, 55%, 0.5)`;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Central glowing core — radius scales with bass
  const coreR = baseR * 0.3 + bassVal * baseR * 0.5;
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
  coreGrad.addColorStop(0, `hsla(185, 100%, 75%, ${0.15 + bassVal * 0.45})`);
  coreGrad.addColorStop(0.6, `hsla(270, 80%, 60%, ${0.1 + bassVal * 0.2})`);
  coreGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
  ctx.fill();

  // Neon ring outline
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
  ctx.strokeStyle = `hsla(185, 100%, 60%, ${0.3 + bassVal * 0.5})`;
  ctx.lineWidth = 2;
  ctx.shadowColor = 'hsla(185, 100%, 50%, 0.6)';
  ctx.shadowBlur = 16;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Spawn particles on bass hits
  if (bassVal > 0.3 && particles.length < 150) {
    const spawnCount = Math.floor(bassVal * 8);
    for (let n = 0; n < spawnCount; n++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4 * bassVal;
      particles.push({
        x: cx + Math.cos(angle) * r * 0.4,
        y: cy + Math.sin(angle) * r * 0.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        size: 1 + Math.random() * 3 * midAvg,
        hue: 185 + Math.random() * 90,
      });
    }
  }

  // Update & draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.99;
    p.vy *= 0.99;
    p.life -= 0.01;
    if (p.life <= 0) { particles.splice(i, 1); continue; }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${p.hue}, 90%, 65%, ${p.life * 0.7})`;
    ctx.shadowColor = `hsla(${p.hue}, 100%, 60%, 0.3)`;
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Outer burst lines on high energy
  if (highAvg > 0.25) {
    const lineCount = 24;
    for (let i = 0; i < lineCount; i++) {
      const angle = (i / lineCount) * Math.PI * 2 + time * 0.0005;
      const innerR = r * 0.9;
      const outerR = r * (1.1 + highAvg * 0.6);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
      ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
      ctx.strokeStyle = `hsla(270, 80%, 60%, ${highAvg * 0.3})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

/* ─── Main Component ─── */
const StudioVisualizer = ({ getAnalyser }: StudioVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const [mode, setMode] = useState<VisMode>('spectrum');
  const modeRef = useRef<VisMode>(mode);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Canvas resize with DPR
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const draw = (t: number) => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      ctx2d.save();
      ctx2d.scale(dpr, dpr);
      const w = rect.width;
      const h = rect.height;

      // Dark studio background
      ctx2d.fillStyle = '#0F0F13';
      ctx2d.fillRect(0, 0, w, h);

      const analyser = getAnalyser();
      let data: Uint8Array;
      let bassVal = 0;

      if (analyser) {
        data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        bassVal = calcBassValue(data, analyser.frequencyBinCount, analyser.context.sampleRate);
      } else {
        data = new Uint8Array(256);
      }

      const currentMode = modeRef.current;
      switch (currentMode) {
        case 'spectrum': drawSpectrum(ctx2d, w, h, data, bassVal); break;
        case 'rta': drawRTA(ctx2d, w, h, data, bassVal); break;
        case 'aura': drawAura(ctx2d, w, h, data, bassVal, t); break;
      }

      ctx2d.restore();
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [getAnalyser]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border/30" style={{ background: '#0F0F13' }}>
      {/* Mode tabs */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
        <Tabs value={mode} onValueChange={(v) => setMode(v as VisMode)}>
          <TabsList className="bg-background/60 backdrop-blur-md border border-border/40">
            <TabsTrigger value="spectrum" className="text-xs gap-1.5 data-[state=active]:text-accent">
              <Activity className="w-3 h-3" /> Spectrum
            </TabsTrigger>
            <TabsTrigger value="rta" className="text-xs gap-1.5 data-[state=active]:text-glow-warm">
              <BarChart3 className="w-3 h-3" /> RTA
            </TabsTrigger>
            <TabsTrigger value="aura" className="text-xs gap-1.5 data-[state=active]:text-primary">
              <Orbit className="w-3 h-3" /> Aura
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <canvas ref={canvasRef} className="w-full h-64 md:h-80 lg:h-96" style={{ display: 'block' }} />
    </div>
  );
};

export default StudioVisualizer;

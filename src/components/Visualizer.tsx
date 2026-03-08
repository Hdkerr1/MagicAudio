import { useRef, useEffect, useCallback } from 'react';

interface VisualizerProps {
  getAnalyser: () => AnalyserNode | null;
  isPlaying: boolean;
  accentColor?: string;
}

const Visualizer = ({ getAnalyser, isPlaying, accentColor = '270, 95%, 60%' }: VisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const prevBarsRef = useRef<Float32Array | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const barCount = 64;

    // Initialize previous bars for smoothing
    if (!prevBarsRef.current || prevBarsRef.current.length !== barCount) {
      prevBarsRef.current = new Float32Array(barCount);
    }

    const analyser = getAnalyser();
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    if (analyser && dataArray) {
      analyser.getByteFrequencyData(dataArray);
    }

    ctx.clearRect(0, 0, w, h);

    const barWidth = (w / barCount) * 0.7;
    const gap = (w / barCount) * 0.3;

    for (let i = 0; i < barCount; i++) {
      let value = 0;
      if (dataArray && analyser) {
        const freqIndex = Math.floor(Math.pow(i / barCount, 1.5) * analyser.frequencyBinCount * 0.5);
        value = dataArray[freqIndex] / 255;
      }

      // Smooth animation — ease toward target value (no sudden jumps)
      const prev = prevBarsRef.current[i];
      const smoothed = prev + (value - prev) * 0.25;
      prevBarsRef.current[i] = smoothed;

      const barHeight = Math.max(2, smoothed * h * 0.85);
      const x = i * (barWidth + gap) + gap / 2;
      const y = h - barHeight;

      // Gradient per bar
      const gradient = ctx.createLinearGradient(x, h, x, y);
      gradient.addColorStop(0, `hsla(${accentColor}, 0.1)`);
      gradient.addColorStop(0.5, `hsla(${accentColor}, 0.6)`);
      gradient.addColorStop(1, `hsla(${accentColor}, 0.9)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();

      // Glow
      ctx.shadowColor = `hsla(${accentColor}, 0.4)`;
      ctx.shadowBlur = 8;
      ctx.fillStyle = `hsla(${accentColor}, 0.15)`;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Always keep the loop running while playing — never let it die
    rafRef.current = requestAnimationFrame(draw);
  }, [getAnalyser, accentColor]);

  useEffect(() => {
    // Always run the animation loop when playing, restart on any change
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(draw);
    } else {
      // When stopped, draw one final frame with decaying bars
      const decay = () => {
        const canvas = canvasRef.current;
        if (!canvas || !prevBarsRef.current) return;
        let anyAboveZero = false;
        for (let i = 0; i < prevBarsRef.current.length; i++) {
          prevBarsRef.current[i] *= 0.92;
          if (prevBarsRef.current[i] > 0.005) anyAboveZero = true;
        }
        if (anyAboveZero) {
          // Re-invoke draw to render the decay
          const ctx2 = canvas.getContext('2d');
          if (ctx2) {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx2.scale(dpr, dpr);
            const w = rect.width;
            const h = rect.height;
            const barCount = prevBarsRef.current.length;
            const barWidth = (w / barCount) * 0.7;
            const gapW = (w / barCount) * 0.3;
            ctx2.clearRect(0, 0, w, h);
            for (let i = 0; i < barCount; i++) {
              const barHeight = Math.max(2, prevBarsRef.current[i] * h * 0.85);
              const x = i * (barWidth + gapW) + gapW / 2;
              const y = h - barHeight;
              const gradient = ctx2.createLinearGradient(x, h, x, y);
              gradient.addColorStop(0, `hsla(${accentColor}, 0.1)`);
              gradient.addColorStop(0.5, `hsla(${accentColor}, 0.6)`);
              gradient.addColorStop(1, `hsla(${accentColor}, 0.9)`);
              ctx2.fillStyle = gradient;
              ctx2.beginPath();
              ctx2.roundRect(x, y, barWidth, barHeight, 2);
              ctx2.fill();
            }
          }
          rafRef.current = requestAnimationFrame(decay);
        }
      };
      rafRef.current = requestAnimationFrame(decay);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, draw, accentColor]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  );
};

export default Visualizer;

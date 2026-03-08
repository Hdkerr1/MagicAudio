import { useRef, useEffect, useCallback } from 'react';

interface VisualizerProps {
  getAnalyser: () => AnalyserNode | null;
  isPlaying: boolean;
  accentColor?: string;
}

const Visualizer = ({ getAnalyser, isPlaying, accentColor = '270, 95%, 60%' }: VisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = getAnalyser();
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const bufLen = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufLen);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, w, h);

    // Draw frequency bars
    const barCount = 64;
    const barWidth = (w / barCount) * 0.7;
    const gap = (w / barCount) * 0.3;

    for (let i = 0; i < barCount; i++) {
      // Use logarithmic frequency mapping
      const freqIndex = Math.floor(Math.pow(i / barCount, 1.5) * bufLen * 0.5);
      const value = dataArray[freqIndex] / 255;
      const barHeight = value * h * 0.85;

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

    rafRef.current = requestAnimationFrame(draw);
  }, [getAnalyser, accentColor]);

  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(draw);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  );
};

export default Visualizer;

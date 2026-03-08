import { useRef, useEffect, useCallback } from 'react';

interface WaveformProps {
  getAudioBuffer: () => AudioBuffer | null;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  accentColor: string; // HSL string like "270, 95%, 60%"
}

/**
 * Downsample an AudioBuffer to a fixed number of peaks for drawing.
 */
function extractPeaks(buffer: AudioBuffer, numBars: number): number[] {
  const channel = buffer.getChannelData(0);
  const blockSize = Math.floor(channel.length / numBars);
  const peaks: number[] = [];

  for (let i = 0; i < numBars; i++) {
    let max = 0;
    const start = i * blockSize;
    const end = Math.min(start + blockSize, channel.length);
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channel[j]);
      if (abs > max) max = abs;
    }
    peaks.push(max);
  }

  // Normalize to 0-1
  const globalMax = Math.max(...peaks, 0.001);
  return peaks.map(p => p / globalMax);
}

const Waveform = ({ getAudioBuffer, currentTime, duration, onSeek, accentColor }: WaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksRef = useRef<number[]>([]);
  const bufferIdRef = useRef<number>(0);
  const isDraggingRef = useRef(false);

  // Extract peaks when buffer changes
  const buffer = getAudioBuffer();
  const bufferId = buffer ? buffer.length : 0;

  if (bufferId !== bufferIdRef.current && buffer) {
    bufferIdRef.current = bufferId;
    peaksRef.current = extractPeaks(buffer, 200);
  }

  const progress = duration > 0 ? currentTime / duration : 0;

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const peaks = peaksRef.current;
    const numBars = peaks.length;

    if (numBars === 0) {
      ctx.clearRect(0, 0, w, h);
      return;
    }

    ctx.clearRect(0, 0, w, h);

    const barWidth = w / numBars;
    const gap = Math.max(1, barWidth * 0.25);
    const effectiveBarWidth = barWidth - gap;
    const playedIndex = Math.floor(progress * numBars);

    const centerY = h / 2;

    for (let i = 0; i < numBars; i++) {
      const peak = peaks[i];
      const barH = Math.max(2, peak * (h * 0.85));
      const x = i * barWidth + gap / 2;
      const y = centerY - barH / 2;

      if (i <= playedIndex) {
        ctx.fillStyle = `hsla(${accentColor}, 0.9)`;
      } else {
        ctx.fillStyle = `hsla(${accentColor}, 0.2)`;
      }

      // Rounded bars
      const radius = Math.min(effectiveBarWidth / 2, 2);
      ctx.beginPath();
      ctx.roundRect(x, y, effectiveBarWidth, barH, radius);
      ctx.fill();
    }

    // Playhead line
    if (duration > 0) {
      const px = progress * w;
      ctx.beginPath();
      ctx.strokeStyle = `hsla(${accentColor}, 1)`;
      ctx.lineWidth = 1.5;
      ctx.moveTo(px, 2);
      ctx.lineTo(px, h - 2);
      ctx.stroke();

      // Playhead dot
      ctx.beginPath();
      ctx.fillStyle = `hsla(${accentColor}, 1)`;
      ctx.arc(px, centerY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [progress, accentColor, duration]);

  const seekFromEvent = useCallback((e: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'clientX' in e ? e.clientX : 0;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(pct * duration);
  }, [duration, onSeek]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    seekFromEvent(e);

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      seekFromEvent(ev);
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [seekFromEvent]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-16 cursor-pointer rounded-lg"
      onMouseDown={handleMouseDown}
    />
  );
};

export default Waveform;

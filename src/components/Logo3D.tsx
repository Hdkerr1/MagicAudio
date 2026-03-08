import { useEffect, useRef, useState } from 'react';

/**
 * 3D animated logo for TuneSence with electric thunder/lightning effect.
 * Combines CSS 3D transforms, mouse tracking, and random lightning flashes.
 */
const Logo3D = ({ className = '' }: { className?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      mouseRef.current = {
        x: (e.clientX - centerX) / (rect.width / 2),
        y: (e.clientY - centerY) / (rect.height / 2),
      };
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Lightning bolt generator
    function drawLightning(
      ctx: CanvasRenderingContext2D,
      x1: number, y1: number,
      x2: number, y2: number,
      maxOffset: number,
      branchChance: number,
      depth: number
    ) {
      if (depth <= 0 || maxOffset < 2) {
        ctx.lineTo(x2, y2);
        return;
      }
      const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * maxOffset;
      const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * maxOffset;

      drawLightning(ctx, x1, y1, midX, midY, maxOffset * 0.5, branchChance * 0.7, depth - 1);

      // Branch
      if (Math.random() < branchChance && depth > 2) {
        const branchEndX = midX + (Math.random() - 0.5) * maxOffset * 1.5;
        const branchEndY = midY + (Math.random() + 0.3) * maxOffset * 0.8;
        ctx.moveTo(midX, midY);
        drawLightning(ctx, midX, midY, branchEndX, branchEndY, maxOffset * 0.4, 0.1, depth - 2);
        ctx.moveTo(midX, midY);
      }

      drawLightning(ctx, midX, midY, x2, y2, maxOffset * 0.5, branchChance * 0.7, depth - 1);
    }

    let time = 0;
    let nextFlash = 2 + Math.random() * 3;
    let flashTimer = 0;
    let activeFlashes: Array<{ age: number; maxAge: number; bolts: Array<{ x1: number; y1: number; x2: number; y2: number }> }> = [];

    const animate = () => {
      time += 0.015;
      flashTimer += 0.015;

      const el = container.querySelector('.logo-text') as HTMLElement;
      if (el) {
        const idleX = Math.sin(time * 0.8) * 3;
        const idleY = Math.cos(time * 0.6) * 2;
        const mouseX = mouseRef.current.x * 8;
        const mouseY = mouseRef.current.y * -5;

        const rotateY = idleX + mouseX;
        const rotateX = idleY + mouseY;
        const translateZ = Math.sin(time * 1.2) * 4;

        el.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(${translateZ}px)`;

        const shadowX = -rotateY * 0.8;
        const shadowY = rotateX * 0.8;

        // Check if any flash is active for extra glow
        const hasActiveFlash = activeFlashes.length > 0;
        const flashGlow = hasActiveFlash ? ', 0 0 60px hsl(200 100% 70% / 0.6), 0 0 120px hsl(220 100% 80% / 0.3)' : '';

        el.style.textShadow = `
          ${shadowX * 0.5}px ${shadowY * 0.5}px 0px hsl(270 95% 50% / 0.4),
          ${shadowX}px ${shadowY}px 0px hsl(270 95% 40% / 0.25),
          ${shadowX * 1.5}px ${shadowY * 1.5}px 10px hsl(270 95% 60% / 0.15),
          0 0 40px hsl(270 95% 60% / 0.1),
          0 0 80px hsl(185 100% 50% / 0.05)${flashGlow}
        `;
      }

      // Trigger new flash
      if (flashTimer >= nextFlash) {
        flashTimer = 0;
        nextFlash = 1.5 + Math.random() * 4;
        setFlash(true);
        setTimeout(() => setFlash(false), 150);

        const rect = container.getBoundingClientRect();
        const cw = canvas.width / (window.devicePixelRatio || 1);
        const ch = canvas.height / (window.devicePixelRatio || 1);
        const boltCount = 1 + Math.floor(Math.random() * 2);
        const bolts = [];
        for (let i = 0; i < boltCount; i++) {
          bolts.push({
            x1: cw * (0.2 + Math.random() * 0.6),
            y1: 0,
            x2: cw * (0.15 + Math.random() * 0.7),
            y2: ch,
          });
        }
        activeFlashes.push({ age: 0, maxAge: 0.25 + Math.random() * 0.15, bolts });
      }

      // Draw lightning on canvas
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, rect.width, rect.height);

        activeFlashes = activeFlashes.filter(f => {
          f.age += 0.015;
          if (f.age > f.maxAge) return false;

          const opacity = 1 - (f.age / f.maxAge);
          const fadeIn = Math.min(1, f.age / 0.03);
          const alpha = opacity * fadeIn;

          for (const bolt of f.bolts) {
            // Main bolt
            ctx.beginPath();
            ctx.moveTo(bolt.x1, bolt.y1);
            drawLightning(ctx, bolt.x1, bolt.y1, bolt.x2, bolt.y2, 60, 0.35, 7);
            ctx.strokeStyle = `hsla(210, 100%, 85%, ${alpha * 0.9})`;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = `hsla(220, 100%, 70%, ${alpha})`;
            ctx.shadowBlur = 20;
            ctx.stroke();

            // Inner bright core
            ctx.beginPath();
            ctx.moveTo(bolt.x1, bolt.y1);
            drawLightning(ctx, bolt.x1, bolt.y1, bolt.x2, bolt.y2, 30, 0.2, 5);
            ctx.strokeStyle = `hsla(200, 100%, 95%, ${alpha * 0.7})`;
            ctx.lineWidth = 1;
            ctx.shadowColor = `hsla(200, 100%, 90%, ${alpha * 0.5})`;
            ctx.shadowBlur = 8;
            ctx.stroke();
          }

          ctx.shadowBlur = 0;
          return true;
        });
      }

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-flex items-center select-none ${className}`}>
      {/* Lightning canvas overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10"
        style={{ mixBlendMode: 'screen' }}
      />
      {/* Flash overlay */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none z-0 transition-opacity duration-100"
        style={{
          opacity: flash ? 0.15 : 0,
          background: 'radial-gradient(ellipse at center, hsl(210 100% 80%), transparent 70%)',
        }}
      />
      <h1
        className="logo-text relative z-5 text-5xl md:text-7xl font-bold tracking-tight will-change-transform"
        style={{
          background: 'linear-gradient(135deg, hsl(270 95% 65%) 0%, hsl(220 100% 70%) 30%, hsl(185 100% 55%) 60%, hsl(270 95% 60%) 100%)',
          backgroundSize: '200% 200%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: 'gradient-shift 4s ease-in-out infinite',
          transformStyle: 'preserve-3d',
        }}
      >
        TuneSence
      </h1>
    </div>
  );
};

export default Logo3D;
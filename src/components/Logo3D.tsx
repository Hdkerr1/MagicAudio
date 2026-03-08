import { useEffect, useRef } from 'react';

/**
 * 3D animated logo for TuneSence.
 * Uses CSS 3D transforms + perspective for a floating, rotating text effect
 * with dynamic gradient and glow.
 */
const Logo3D = ({ className = '' }: { className?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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

    let time = 0;
    const animate = () => {
      time += 0.015;
      const el = container.querySelector('.logo-text') as HTMLElement;
      if (el) {
        // Combine mouse tracking with gentle idle float
        const idleX = Math.sin(time * 0.8) * 3;
        const idleY = Math.cos(time * 0.6) * 2;
        const mouseX = mouseRef.current.x * 8;
        const mouseY = mouseRef.current.y * -5;

        const rotateY = idleX + mouseX;
        const rotateX = idleY + mouseY;
        const translateZ = Math.sin(time * 1.2) * 4;

        el.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(${translateZ}px)`;

        // Dynamic shadow depth based on rotation
        const shadowX = -rotateY * 0.8;
        const shadowY = rotateX * 0.8;
        el.style.textShadow = `
          ${shadowX * 0.5}px ${shadowY * 0.5}px 0px hsl(270 95% 50% / 0.4),
          ${shadowX}px ${shadowY}px 0px hsl(270 95% 40% / 0.25),
          ${shadowX * 1.5}px ${shadowY * 1.5}px 10px hsl(270 95% 60% / 0.15),
          0 0 40px hsl(270 95% 60% / 0.1),
          0 0 80px hsl(185 100% 50% / 0.05)
        `;
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
    <div ref={containerRef} className={`inline-flex items-center select-none ${className}`}>
      <h1
        className="logo-text text-5xl md:text-7xl font-bold tracking-tight will-change-transform"
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
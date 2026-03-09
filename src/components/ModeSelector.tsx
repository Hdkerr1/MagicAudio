import { Waves, Volume2, Radio, Music, Headphones, LogIn, LogOut } from 'lucide-react';
import type { ProcessingMode } from '@/lib/audioProcessor';
import Logo3D from './Logo3D';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import UsageBadge from './UsageBadge';
import { useNavigate } from 'react-router-dom';

export const demoTracks = [
  { id: 'babel', name: 'Babel Visualizer', artist: 'Gustavo Bravetti', file: '/demo/Gustavo_Bravetti_-_Babel_Visualizer.mp3' },
  { id: 'mama', name: 'Mama Ma (Instrumental)', artist: 'SXLLX', file: '/demo/SXLLX_-_MAMA_MA_INSTRUMENTAL.mp3' },
  { id: 'rideit', name: 'Ride It (Remix)', artist: 'Jay Sean', file: '/demo/Jay_Sean_-_Ride_It_Remix.mp3' },
] as const;

interface ModeSelectorProps {
  fileName: string;
  onModeSelect: (mode: ProcessingMode) => void;
  onBack: () => void;
  onDemoSelect?: (demoUrl: string, demoName: string) => void;
}

const modes = [
  {
    id: 'slowed-reverb' as ProcessingMode,
    title: 'Slowed + Reverb',
    subtitle: 'Dreamy Reverb Engine',
    description: 'Slow down the track with lush algorithmic reverb, creating a dreamy, atmospheric vibe.',
    icon: Waves,
    borderClass: 'hover:border-primary/50',
    iconColor: 'text-primary',
    bgAccent: 'bg-primary/10',
    glowHover: 'hover:shadow-[0_0_30px_hsl(270_95%_60%/0.15)]',
  },
  {
    id: 'remix' as ProcessingMode,
    title: 'Remix',
    subtitle: 'Premium Remix Engine',
    description: 'Hall echo, punchy bass, crisp presence, and professional mastering quality.',
    icon: Volume2,
    borderClass: 'hover:border-accent/50',
    iconColor: 'text-accent',
    bgAccent: 'bg-accent/10',
    glowHover: 'hover:shadow-[0_0_30px_hsl(185_100%_50%/0.15)]',
  },
  {
    id: 'lofi' as ProcessingMode,
    title: 'Vintage Lo-Fi',
    subtitle: 'Vintage Tape Engine',
    description: 'Slowed down with warm vinyl texture, gentle tape wobble, and nostalgic lo-fi character.',
    icon: Radio,
    borderClass: 'hover:border-glow-warm/50',
    iconColor: 'text-glow-warm',
    bgAccent: 'bg-glow-warm/10',
    glowHover: 'hover:shadow-[0_0_30px_hsl(30_100%_55%/0.15)]',
  },
] as const;

const ModeSelector = ({ fileName, onModeSelect, onBack, onDemoSelect }: ModeSelectorProps) => {
  const isLanding = !fileName;
  const [showDemos, setShowDemos] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-hero px-4 py-12">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-primary/5 blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full bg-accent/5 blur-[100px] animate-pulse-glow" style={{ animationDelay: '1s' }} />
      </div>

      {/* Header / branding */}
      <div className="relative z-10 text-center mb-12">
        {isLanding && (
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="p-3 rounded-2xl glass glow-primary animate-float">
              <Music className="w-8 h-8 text-primary" />
            </div>
            <Logo3D />
          </div>
        )}
        <h2 className={`${isLanding ? 'text-lg md:text-xl' : 'text-3xl'} font-semibold text-foreground mb-2`}>
          {isLanding ? 'Choose how you want to transform your music' : 'Choose Your Style'}
        </h2>
        {isLanding && (
          <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto">
            Select an effect, then upload your track
          </p>
        )}
        {!isLanding && (
          <p className="text-muted-foreground">
            Processing: <span className="text-foreground font-mono text-sm">{fileName}</span>
          </p>
        )}
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl">
        {modes.map((mode) => {
          const Icon = mode.icon;
          return (
            <button
              key={mode.id}
              onClick={() => onModeSelect(mode.id)}
              className={`
                group relative p-6 rounded-2xl border border-border/60 glass
                transition-all duration-300 text-left
                hover:scale-[1.03] active:scale-[0.98] ${mode.borderClass} ${mode.glowHover}
              `}
            >
              <div className={`p-3 rounded-xl ${mode.bgAccent} w-fit mb-4 transition-transform duration-300 group-hover:scale-110`}>
                <Icon className={`w-6 h-6 ${mode.iconColor}`} />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-1">
                {mode.title}
              </h3>
              <p className={`text-xs font-mono ${mode.iconColor} mb-3 opacity-70`}>
                {mode.subtitle}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {mode.description}
              </p>
              {/* Hover arrow indicator */}
              <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <svg className={`w-5 h-5 ${mode.iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>

      {/* Try Demo Section */}
      {isLanding && onDemoSelect && (
        <div className="relative z-10 mt-10 flex flex-col items-center">
          {!showDemos ? (
            <button
              onClick={() => setShowDemos(true)}
              className="flex items-center gap-2.5 px-6 py-3 rounded-full glass hover:glass-strong transition-all duration-300 hover:scale-105 active:scale-95 group"
            >
              <Headphones className="w-4.5 h-4.5 text-primary group-hover:text-accent transition-colors" />
              <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                Try a Demo Track
              </span>
            </button>
          ) : (
            <div className="w-full max-w-md space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <p className="text-xs text-muted-foreground text-center mb-3 font-mono">Pick a demo track to try</p>
              {demoTracks.map((track) => (
                <button
                  key={track.id}
                  onClick={() => onDemoSelect(track.file, `${track.artist} - ${track.name}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl glass hover:glass-strong hover:border-primary/30 transition-all duration-200 group text-left active:scale-[0.98]"
                >
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Music className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{track.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                  </div>
                  <svg className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
              <button
                onClick={() => setShowDemos(false)}
                className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground py-1 transition-colors"
              >
                Hide demos
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <p className="relative z-10 mt-8 text-xs text-muted-foreground/40 font-mono">
        Studio-grade processing · Real-time preview · No uploads to server
      </p>
    </div>
  );
};

export default ModeSelector;
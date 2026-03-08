import { Waves, Volume2, Radio, Music } from 'lucide-react';
import type { ProcessingMode } from '@/lib/audioProcessor';

interface ModeSelectorProps {
  fileName: string;
  onModeSelect: (mode: ProcessingMode) => void;
  onBack: () => void;
}

const modes = [
  {
    id: 'slowed-reverb' as ProcessingMode,
    title: 'Slowed + Reverb',
    subtitle: 'Dreamy Reverb Engine',
    description: 'Slow down the track with lush algorithmic reverb, creating a dreamy, atmospheric vibe.',
    icon: Waves,
    glowClass: 'glow-primary',
    borderClass: 'hover:border-primary/50',
    iconColor: 'text-primary',
    bgAccent: 'bg-primary/10',
  },
  {
    id: 'remix' as ProcessingMode,
    title: 'Remix',
    subtitle: 'Premium Remix Engine',
    description: 'Hall echo, punchy bass, crisp presence, and professional mastering quality.',
    icon: Volume2,
    glowClass: 'glow-accent',
    borderClass: 'hover:border-accent/50',
    iconColor: 'text-accent',
    bgAccent: 'bg-accent/10',
  },
  {
    id: 'lofi' as ProcessingMode,
    title: 'Slowed Lo-Fi',
    subtitle: 'Vintage Tape Engine',
    description: 'Slowed down with warm vinyl texture, gentle tape wobble, and nostalgic lo-fi character.',
    icon: Radio,
    glowClass: 'glow-warm',
    borderClass: 'hover:border-glow-warm/50',
    iconColor: 'text-glow-warm',
    bgAccent: 'bg-glow-warm/10',
  },
] as const;

const ModeSelector = ({ fileName, onModeSelect, onBack }: ModeSelectorProps) => {
  const isLanding = !fileName;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-hero px-4 py-12">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-primary/5 blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full bg-accent/5 blur-[100px] animate-pulse-glow" style={{ animationDelay: '1s' }} />
      </div>

      {/* Header / branding */}
      <div className="relative z-10 text-center mb-10">
        {isLanding && (
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl glass glow-primary">
              <Music className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gradient-primary tracking-tight">
              SoundForge
            </h1>
          </div>
        )}
        <h2 className={`${isLanding ? 'text-xl' : 'text-3xl'} font-bold text-foreground mb-2`}>
          {isLanding ? 'Choose how you want to convert your song' : 'Choose Your Style'}
        </h2>
        {isLanding && (
          <p className="text-muted-foreground text-base max-w-lg mx-auto">
            Select an effect first, then upload your track
          </p>
        )}
        {!isLanding && (
          <p className="text-muted-foreground">
            Processing: <span className="text-foreground font-mono text-sm">{fileName}</span>
          </p>
        )}
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {modes.map((mode) => {
          const Icon = mode.icon;
          return (
            <button
              key={mode.id}
              onClick={() => onModeSelect(mode.id)}
              className={`
                group relative p-6 rounded-2xl border border-border bg-gradient-card
                transition-all duration-300 text-left
                hover:scale-[1.03] ${mode.borderClass}
              `}
            >
              <div className={`p-3 rounded-xl ${mode.bgAccent} w-fit mb-4`}>
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
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ModeSelector;

import { Waves, Volume2, Radio } from 'lucide-react';
import type { PlaybackMode } from '@/lib/audio/engine';

interface ModeToggleProps {
  activeMode: PlaybackMode;
  onModeChange: (mode: PlaybackMode) => void;
}

const modes = [
  {
    id: 'slowed-reverb' as PlaybackMode,
    label: 'Slowed + Reverb',
    shortLabel: 'Reverb',
    icon: Waves,
    glowClass: 'glow-primary',
    activeClass: 'bg-primary/15 border-primary/50 text-primary',
    hoverClass: 'hover:border-primary/30 hover:text-primary/80',
    accentVar: 'primary',
  },
  {
    id: 'hard-bass' as PlaybackMode,
    label: 'Hard Bass',
    shortLabel: 'Bass',
    icon: Volume2,
    glowClass: 'glow-accent',
    activeClass: 'bg-accent/15 border-accent/50 text-accent',
    hoverClass: 'hover:border-accent/30 hover:text-accent/80',
    accentVar: 'accent',
  },
  {
    id: 'lofi' as PlaybackMode,
    label: 'Vintage Lo-Fi',
    shortLabel: 'Lo-Fi',
    icon: Radio,
    glowClass: 'glow-warm',
    activeClass: 'bg-glow-warm/15 border-glow-warm/50 text-glow-warm',
    hoverClass: 'hover:border-glow-warm/30 hover:text-glow-warm/80',
    accentVar: 'warm',
  },
] as const;

const ModeToggle = ({ activeMode, onModeChange }: ModeToggleProps) => {
  return (
    <div className="flex gap-3">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = activeMode === mode.id;
        return (
          <button
            key={mode.id}
            onClick={() => onModeChange(isActive ? null : mode.id)}
            className={`
              group relative flex items-center gap-2.5 px-5 py-3 rounded-xl
              border transition-all duration-300 font-medium text-sm
              ${isActive
                ? `${mode.activeClass} ${mode.glowClass}`
                : `border-border/50 text-muted-foreground glass ${mode.hoverClass}`
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{mode.label}</span>
            <span className="sm:hidden">{mode.shortLabel}</span>
            {isActive && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-current animate-pulse-glow" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ModeToggle;

export function getModeAccentColor(mode: PlaybackMode): string {
  switch (mode) {
    case 'slowed-reverb': return '270, 95%, 60%';
    case 'hard-bass': return '185, 100%, 50%';
    case 'lofi': return '30, 100%, 55%';
    default: return '270, 95%, 60%';
  }
}

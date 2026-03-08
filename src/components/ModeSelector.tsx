import { Waves, Volume2, Radio, ArrowLeft } from 'lucide-react';
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
    subtitle: 'Valhalla VintageVerb Emulation',
    description: 'Dreamy, slowed-down atmosphere with lush algorithmic reverb and tempo reduction.',
    icon: Waves,
    glowClass: 'glow-primary',
    borderClass: 'hover:border-primary/50',
    iconColor: 'text-primary',
    bgAccent: 'bg-primary/10',
  },
  {
    id: 'hard-bass' as ProcessingMode,
    title: 'Hard Bass',
    subtitle: 'R-Bass & Saturn Emulation',
    description: 'Aggressive sub-harmonic synthesis with multiband tape saturation for deep, punchy bass.',
    icon: Volume2,
    glowClass: 'glow-accent',
    borderClass: 'hover:border-accent/50',
    iconColor: 'text-accent',
    bgAccent: 'bg-accent/10',
  },
  {
    id: 'lofi' as ProcessingMode,
    title: 'Lo-Fi',
    subtitle: 'RC-20 Retro Color Emulation',
    description: 'Vinyl crackle, wow & flutter, and vintage bandpass filtering for authentic lo-fi warmth.',
    icon: Radio,
    glowClass: 'glow-warm',
    borderClass: 'hover:border-glow-warm/50',
    iconColor: 'text-glow-warm',
    bgAccent: 'bg-glow-warm/10',
  },
] as const;

const ModeSelector = ({ fileName, onModeSelect, onBack }: ModeSelectorProps) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-hero px-4 py-12">
      <button
        onClick={onBack}
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-foreground mb-2">Choose Your Style</h2>
        <p className="text-muted-foreground">
          Processing: <span className="text-foreground font-mono text-sm">{fileName}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {modes.map((mode) => {
          const Icon = mode.icon;
          return (
            <button
              key={mode.id}
              onClick={() => onModeSelect(mode.id)}
              className={`
                group relative p-6 rounded-2xl border border-border bg-gradient-card
                transition-all duration-300 text-left
                hover:scale-[1.03] hover:${mode.glowClass} ${mode.borderClass}
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

import { Waves, Volume2, Radio, Music, Headphones, LogIn, LogOut, Orbit, Speaker, Lock } from 'lucide-react';
import type { ProcessingMode } from '@/lib/audioProcessor';
import Logo3D from './Logo3D';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import UsageBadge from './UsageBadge';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useUsageLimit } from '@/hooks/useUsageLimit';

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

interface ModeCardDef {
  id: ProcessingMode;
  title: string;
  subtitle: string;
  description: string;
  icon: typeof Waves;
  borderClass: string;
  iconColor: string;
  bgAccent: string;
  glowHover: string;
  headphonesRecommended?: boolean;
  premium?: boolean;
}

const modes: ModeCardDef[] = [
  {
    id: 'slowed-reverb',
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
    id: 'remix',
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
    id: 'lofi',
    title: 'Vintage Lo-Fi',
    subtitle: 'Vintage Tape Engine',
    description: 'Slowed down with warm vinyl texture, gentle tape wobble, and nostalgic lo-fi character.',
    icon: Radio,
    borderClass: 'hover:border-glow-warm/50',
    iconColor: 'text-glow-warm',
    bgAccent: 'bg-glow-warm/10',
    glowHover: 'hover:shadow-[0_0_30px_hsl(30_100%_55%/0.15)]',
  },
  {
    id: '8d-spatial',
    title: '🌀 8D Spatial Audio',
    subtitle: 'Immersive 360° Engine',
    description: 'Immerse yourself in a virtual soundscape. Put on your headphones and feel the music swirling around your head in a massive 360-degree environment.',
    icon: Orbit,
    borderClass: 'hover:border-primary/50',
    iconColor: 'text-primary',
    bgAccent: 'bg-primary/10',
    glowHover: 'hover:shadow-[0_0_30px_hsl(270_95%_60%/0.2)]',
    headphonesRecommended: true,
    premium: true,
  },
  {
    id: '3d-surround',
    title: '🔊 3D Surround Sound',
    subtitle: 'Concert Hall Engine',
    description: 'Expand the stereo width of any normal MP3, making it feel like you are listening to the song live in a massive concert hall.',
    icon: Speaker,
    borderClass: 'hover:border-accent/50',
    iconColor: 'text-accent',
    bgAccent: 'bg-accent/10',
    glowHover: 'hover:shadow-[0_0_30px_hsl(185_100%_50%/0.2)]',
    headphonesRecommended: true,
    premium: true,
  },
];

function ModeCard({ mode, onSelect }: { mode: ModeCardDef; onSelect: (id: ProcessingMode) => void }) {
  const Icon = mode.icon;
  return (
    <button
      onClick={() => onSelect(mode.id)}
      className={`
        group relative p-6 rounded-2xl border border-border/60 glass
        transition-all duration-300 text-left
        hover:scale-[1.03] active:scale-[0.98] ${mode.borderClass} ${mode.glowHover}
      `}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-3 rounded-xl ${mode.bgAccent} w-fit transition-transform duration-300 group-hover:scale-110`}>
          <Icon className={`w-6 h-6 ${mode.iconColor}`} />
        </div>
        {mode.headphonesRecommended && (
          <Badge variant="outline" className="flex items-center gap-1 text-[10px] border-muted-foreground/30 text-muted-foreground">
            <Headphones className="w-3 h-3" />
            Headphones Recommended
          </Badge>
        )}
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
      {mode.premium && (
        <Badge className="absolute top-6 right-14 bg-primary/20 text-primary border-primary/30 text-[10px]">
          Premium
        </Badge>
      )}
      <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <svg className={`w-5 h-5 ${mode.iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

const ModeSelector = ({ fileName, onModeSelect, onBack, onDemoSelect }: ModeSelectorProps) => {
  const isLanding = !fileName;
  const [showDemos, setShowDemos] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-hero px-4 py-12">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4 md:px-6 py-3">
        <div />
        <div className="flex items-center gap-2">
          <UsageBadge />
          {user ? (
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 bg-secondary/30 hover:bg-secondary/50 transition-colors text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/auth')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-xs font-semibold"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
          )}
        </div>
      </div>

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

      {/* Standard modes */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl">
        {modes.filter(m => !m.premium).map((mode) => (
          <ModeCard key={mode.id} mode={mode} onSelect={onModeSelect} />
        ))}
      </div>

      {/* Premium spatial modes */}
      <div className="relative z-10 w-full max-w-4xl mt-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-border/40" />
          <span className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest">Premium Spatial</span>
          <div className="h-px flex-1 bg-border/40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {modes.filter(m => m.premium).map((mode) => (
            <ModeCard key={mode.id} mode={mode} onSelect={onModeSelect} />
          ))}
        </div>
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
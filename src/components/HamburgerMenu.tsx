import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Music, Waves, Volume2, Radio, Orbit, Speaker, Library, Crown, Shield, FileText, Scale, AlertTriangle, RotateCcw, Mail, Layers, Move3d, Zap, Disc3 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUsageLimit } from '@/hooks/useUsageLimit';
import type { ProcessingMode } from '@/lib/audioProcessor';

interface HamburgerMenuProps {
  onModeSelect?: (mode: ProcessingMode) => void;
}

const engines: { id: ProcessingMode; label: string; icon: typeof Waves; color: string }[] = [
  { id: 'slowed-reverb', label: 'Slowed + Reverb', icon: Waves, color: 'text-primary' },
  { id: 'remix', label: 'Remix', icon: Volume2, color: 'text-accent' },
  { id: 'lofi', label: 'Vintage Lo-Fi', icon: Radio, color: 'text-glow-warm' },
  { id: '8d-spatial', label: '8D Spatial Audio', icon: Orbit, color: 'text-primary' },
  { id: '3d-surround', label: '3D Surround Sound', icon: Speaker, color: 'text-accent' },
];

const HamburgerMenu = ({ onModeSelect }: HamburgerMenuProps) => {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { isPremium } = useUsageLimit();
  const navigate = useNavigate();

  const handleModeClick = (mode: ProcessingMode) => {
    setOpen(false);
    if (onModeSelect) onModeSelect(mode);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
          
          {/* Drawer */}
          <div className="relative w-72 max-w-[85vw] h-full bg-card border-r border-border/50 overflow-y-auto animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/30">
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5 text-primary" />
                <span className="text-lg font-bold text-gradient-primary">TuneSence</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-secondary/50 transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Navigation */}
            <div className="p-3 space-y-1">
              <button
                onClick={() => { setOpen(false); navigate('/'); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/50 transition-colors text-left"
              >
                <Music className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Home</span>
              </button>

              <button
                onClick={() => { setOpen(false); navigate('/library'); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/50 transition-colors text-left"
              >
                <Library className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-foreground">Song Library</span>
              </button>

              <button
                onClick={() => { setOpen(false); navigate('/pricing'); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/50 transition-colors text-left"
              >
                <Crown className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {isPremium ? 'My Plan' : 'Upgrade to Premium'}
                </span>
              </button>

              {user && (
                <button
                  onClick={() => { setOpen(false); navigate('/admin'); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/50 transition-colors text-left"
                >
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Admin Panel</span>
                </button>
              )}
            </div>

            {/* Forge AI Tools */}
            <div className="px-3 pt-2">
              <p className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">AI Forge Tools</p>
              <div className="space-y-0.5">
                <button
                  onClick={() => { setOpen(false); navigate('/forge/mashup'); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/50 transition-colors text-left group"
                >
                  <Layers className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">AI Mashup Engine</span>
                </button>
                <button
                  onClick={() => { setOpen(false); navigate('/forge/spatial'); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/50 transition-colors text-left group"
                >
                  <Move3d className="w-4 h-4 text-accent" />
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Immersive Audio Studio</span>
                </button>
                <button
                  onClick={() => { setOpen(false); navigate('/forge/aurabypass'); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/50 transition-colors text-left group"
                >
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">AuraBypass DSP</span>
                </button>
                <button
                  onClick={() => { setOpen(false); navigate('/forge/lofi-mixer'); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/50 transition-colors text-left group"
                >
                  <Disc3 className="w-4 h-4 text-accent" />
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Lo-Fi Ambient Mixer</span>
                </button>
              </div>
            </div>

            {/* Engines section */}
            <div className="px-3 pt-2">
              <p className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">Audio Engines</p>
              <div className="space-y-0.5">
                {engines.map((eng) => (
                  <button
                    key={eng.id}
                    onClick={() => handleModeClick(eng.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/50 transition-colors text-left group"
                  >
                    <eng.icon className={`w-4 h-4 ${eng.color}`} />
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{eng.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Policies section */}
            <div className="px-3 pt-4 pb-6">
              <p className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">Legal</p>
              <div className="space-y-0.5">
                {[
                  { to: '/privacy-policy', label: 'Privacy Policy', icon: FileText },
                  { to: '/terms', label: 'Terms & Conditions', icon: Scale },
                  { to: '/dmca', label: 'DMCA Policy', icon: AlertTriangle },
                  { to: '/refund-policy', label: 'Refund Policy', icon: RotateCcw },
                  { to: '/contact', label: 'Contact Us', icon: Mail },
                ].map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary/50 transition-colors text-left"
                  >
                    <link.icon className="w-3.5 h-3.5 text-muted-foreground/60" />
                    <span className="text-xs text-muted-foreground hover:text-foreground transition-colors">{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HamburgerMenu;

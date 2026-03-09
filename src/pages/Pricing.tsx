import { Music, Check, Zap, Crown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const Pricing = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const handleUpgrade = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    // Will be replaced with Stripe checkout
    toast.info('Stripe checkout coming soon!');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-hero px-4 py-12">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-primary/5 blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full bg-accent/5 blur-[100px] animate-pulse-glow" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 text-center mb-10">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Music className="w-6 h-6 text-primary" />
          <span className="text-xl font-bold text-gradient-primary">TuneSence</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Simple Pricing</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Start free with 5 daily conversions. Upgrade for unlimited access.
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        {/* Free Plan */}
        <div className="glass rounded-2xl p-6 border border-border/60">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-semibold text-foreground">Free</h3>
          </div>
          <div className="mb-6">
            <span className="text-3xl font-bold text-foreground">$0</span>
            <span className="text-muted-foreground text-sm">/forever</span>
          </div>
          <ul className="space-y-3 mb-6">
            {['5 conversions per day', 'All 3 audio modes', 'Real-time preview', 'MP3 export'].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-accent shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => navigate(user ? '/' : '/auth')}
            className="w-full py-2.5 rounded-xl border border-border/60 text-foreground font-medium hover:bg-secondary/40 transition-colors"
          >
            {user ? 'Go to App' : 'Get Started Free'}
          </button>
        </div>

        {/* Premium Plan */}
        <div className="glass rounded-2xl p-6 border border-primary/40 glow-primary relative overflow-hidden">
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/40">
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Popular</span>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Premium</h3>
          </div>
          <div className="mb-6">
            <span className="text-3xl font-bold text-foreground">$4.99</span>
            <span className="text-muted-foreground text-sm">/month</span>
          </div>
          <ul className="space-y-3 mb-6">
            {['Unlimited conversions', 'All 3 audio modes', 'Real-time preview', 'MP3 export', 'Priority processing', 'Early access to new modes'].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-primary shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={handleUpgrade}
            className={`w-full py-2.5 rounded-xl font-semibold transition-colors ${
              profile?.is_premium
                ? 'bg-secondary/40 text-muted-foreground cursor-default'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
            disabled={profile?.is_premium}
          >
            {profile?.is_premium ? 'Current Plan' : 'Upgrade to Premium'}
          </button>
        </div>
      </div>

      <button
        onClick={() => navigate('/')}
        className="relative z-10 mt-8 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to app
      </button>
    </div>
  );
};

export default Pricing;

import { Music, Check, Zap, Crown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const Pricing = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: 'TuneSence',
        description: 'Premium Plan — Unlimited Conversions',
        order_id: data.order_id,
        prefill: { email: data.user_email },
        theme: { color: '#7c3aed' },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const { error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
              headers: { Authorization: `Bearer ${session.access_token}` },
              body: response,
            });

            if (verifyError) throw verifyError;

            await refreshProfile();
            toast.success('🎉 Premium activated! Enjoy unlimited conversions.');
          } catch {
            toast.error('Payment verification failed. Contact support.');
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => {
        toast.error('Payment failed. Please try again.');
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      console.error(err);
      toast.error('Could not initiate payment. Try again.');
    } finally {
      setLoading(false);
    }
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
            <span className="text-3xl font-bold text-foreground">₹0</span>
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
            <span className="text-3xl font-bold text-foreground">₹399</span>
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
            disabled={profile?.is_premium || loading}
            className={`w-full py-2.5 rounded-xl font-semibold transition-colors ${
              profile?.is_premium
                ? 'bg-secondary/40 text-muted-foreground cursor-default'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {profile?.is_premium ? 'Current Plan' : loading ? 'Processing...' : 'Upgrade to Premium'}
          </button>
        </div>
      </div>

      <button
        onClick={() => navigate('/')}
        className="relative z-10 mt-8 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to app
      </button>

      {/* Footer with required policy links */}
      <div className="relative z-10 mt-12 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <Link to="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
        <span>·</span>
        <Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link>
        <span>·</span>
        <Link to="/refund-policy" className="hover:text-foreground transition-colors">Refund Policy</Link>
        <span>·</span>
        <Link to="/contact" className="hover:text-foreground transition-colors">Contact Us</Link>
      </div>
    </div>
  );
};

export default Pricing;

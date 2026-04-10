import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Music, Mail, Lock, ArrowLeft, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

type AuthView = 'login' | 'signup' | 'forgot' | 'forgot-sent';

const Auth = () => {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);

  const handleTilt = (e: React.MouseEvent) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
  };
  const resetTilt = () => {
    if (cardRef.current) cardRef.current.style.transform = 'perspective(800px) rotateY(0) rotateX(0)';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (view === 'login') {
        const { error } = await signIn(email, password);
        if (error) { toast.error(error.message); return; }
        toast.success('Welcome back!');
        navigate('/');
      } else if (view === 'signup') {
        const { error } = await signUp(email, password);
        if (error) { toast.error(error.message); return; }
        toast.success('Check your email to confirm your account!');
      } else if (view === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) { toast.error(error.message); return; }
        setView('forgot-sent');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-cyberpunk px-4 relative overflow-hidden">
      {/* Animated BG blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-accent/5 blur-[150px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[120px] animate-pulse-glow" style={{ animationDelay: '1s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 rounded-2xl glass-3d glow-cyan animate-float mb-4">
            <Music className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-gradient-cyberpunk">TuneSence</h1>
          <p className="text-muted-foreground text-sm mt-2">
            {view === 'login' && 'Sign in to your studio'}
            {view === 'signup' && 'Create your free account'}
            {view === 'forgot' && 'Reset your password'}
            {view === 'forgot-sent' && 'Check your inbox'}
          </p>
        </div>

        {/* 3D Tilt Card */}
        <div
          ref={cardRef}
          onMouseMove={handleTilt}
          onMouseLeave={resetTilt}
          className="glass-3d rounded-2xl p-6 transition-transform duration-150 ease-out"
        >
          {view === 'forgot-sent' ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-4 py-4"
            >
              <div className="p-3 rounded-full bg-accent/15 glow-cyan">
                <CheckCircle className="w-8 h-8 text-accent" />
              </div>
              <p className="text-foreground text-center font-medium">Password reset email sent!</p>
              <p className="text-muted-foreground text-sm text-center">Check <span className="text-accent">{email}</span> for instructions.</p>
              <button
                onClick={() => { setView('login'); setPassword(''); }}
                className="flex items-center gap-1.5 text-sm text-accent hover:underline mt-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {view === 'forgot' && (
                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to sign in
                </button>
              )}

              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary/60 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {view !== 'forgot' && (
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary/60 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              {view === 'login' && (
                <button
                  type="button"
                  onClick={() => setView('forgot')}
                  className="text-xs text-accent hover:underline"
                >
                  Forgot password?
                </button>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-accent text-accent-foreground font-semibold hover:bg-accent/85 transition-all disabled:opacity-50 glow-cyan animate-neon-pulse"
                style={{ animationPlayState: loading ? 'paused' : 'running' }}
              >
                {loading
                  ? 'Please wait...'
                  : view === 'login'
                  ? 'Sign In'
                  : view === 'signup'
                  ? 'Create Account'
                  : 'Send Reset Link'}
              </button>

              {view === 'signup' && (
                <p className="text-xs text-muted-foreground text-center">
                  🎵 5 free conversions per day · No credit card required
                </p>
              )}
            </form>
          )}
        </div>

        {view !== 'forgot-sent' && view !== 'forgot' && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            {view === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setView(view === 'login' ? 'signup' : 'login')}
              className="text-accent hover:underline font-medium"
            >
              {view === 'login' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>
        )}
      </motion.div>
    </div>
  );
};

export default Auth;

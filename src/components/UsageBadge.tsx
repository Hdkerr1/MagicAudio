import { useUsageLimit } from '@/hooks/useUsageLimit';
import { useAuth } from '@/hooks/useAuth';
import { Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const UsageBadge = () => {
  const { remaining, isPremium, FREE_DAILY_LIMIT } = useUsageLimit();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  if (isPremium) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10">
        <Crown className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-primary">Premium</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => navigate('/pricing')}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 bg-secondary/30 hover:bg-secondary/50 transition-colors"
    >
      <span className="text-xs font-mono text-muted-foreground">
        {remaining}/{FREE_DAILY_LIMIT} left
      </span>
      <span className="text-[10px] text-primary font-semibold">Upgrade</span>
    </button>
  );
};

export default UsageBadge;

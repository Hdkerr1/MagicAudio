import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Users, Music, Crown, ArrowLeft, Search } from 'lucide-react';
import { toast } from 'sonner';
import HamburgerMenu from '@/components/HamburgerMenu';

interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  is_premium: boolean;
  subscription_status: string | null;
  created_at: string;
}

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ total: 0, premium: 0, conversions: 0 });

  const checkAdmin = useCallback(async () => {
    if (!user) { setChecking(false); return; }
    const { data } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    setIsAdmin(!!data);
    setChecking(false);
  }, [user]);

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) {
      setUsers(data as UserProfile[]);
      setStats({
        total: data.length,
        premium: data.filter((u: any) => u.is_premium).length,
        conversions: 0,
      });
    }
    // Get total conversions
    const { count } = await supabase.from('conversions').select('*', { count: 'exact', head: true });
    setStats(prev => ({ ...prev, conversions: count ?? 0 }));
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    else if (user) checkAdmin();
  }, [user, authLoading, navigate, checkAdmin]);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin, fetchUsers]);

  const togglePremium = async (profile: UserProfile) => {
    const newValue = !profile.is_premium;
    const { error } = await supabase
      .from('profiles')
      .update({
        is_premium: newValue,
        subscription_status: newValue ? 'active' : 'free',
      })
      .eq('id', profile.id);

    if (error) {
      toast.error('Failed to update user');
      return;
    }

    setUsers(prev => prev.map(u => u.id === profile.id ? { ...u, is_premium: newValue, subscription_status: newValue ? 'active' : 'free' } : u));
    toast.success(`${profile.email} ${newValue ? 'upgraded to' : 'removed from'} Premium`);
  };

  if (authLoading || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-hero">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-hero px-4">
        <Shield className="w-16 h-16 text-destructive/50 mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-6">You do not have admin privileges.</p>
        <button onClick={() => navigate('/')} className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
          Go Home
        </button>
      </div>
    );
  }

  const filtered = users.filter(u =>
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.display_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-hero px-4 py-6">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-primary/5 blur-[120px] animate-pulse-glow" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between max-w-5xl mx-auto mb-6">
        <div className="flex items-center gap-3">
          <HamburgerMenu />
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Back</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
        </div>
        <div className="w-20" />
      </div>

      {/* Stats */}
      <div className="relative z-10 grid grid-cols-3 gap-3 max-w-5xl mx-auto mb-6">
        {[
          { label: 'Total Users', value: stats.total, icon: Users, color: 'text-accent' },
          { label: 'Premium', value: stats.premium, icon: Crown, color: 'text-primary' },
          { label: 'Conversions', value: stats.conversions, icon: Music, color: 'text-glow-warm' },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-4 text-center">
            <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-1`} />
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative z-10 max-w-5xl mx-auto mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl glass border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Users table */}
      <div className="relative z-10 max-w-5xl mx-auto glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase hidden md:table-cell">Joined</th>
                <th className="text-center px-4 py-3 text-xs font-mono text-muted-foreground uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-mono text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{u.email || 'N/A'}</p>
                    {u.display_name && <p className="text-xs text-muted-foreground">{u.display_name}</p>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      u.is_premium ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary/50 text-muted-foreground border border-border/30'
                    }`}>
                      {u.is_premium && <Crown className="w-3 h-3" />}
                      {u.is_premium ? 'Premium' : 'Free'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => togglePremium(u)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        u.is_premium
                          ? 'bg-destructive/20 text-destructive hover:bg-destructive/30'
                          : 'bg-primary/20 text-primary hover:bg-primary/30'
                      }`}
                    >
                      {u.is_premium ? 'Remove Premium' : 'Grant Premium'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Admin;

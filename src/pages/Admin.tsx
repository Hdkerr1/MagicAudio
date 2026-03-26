import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Users, Music, Crown, ArrowLeft, Search, BarChart3, Clock, Trash2, RefreshCw } from 'lucide-react';
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

interface ConversionRecord {
  id: string;
  file_name: string;
  mode: string;
  created_at: string;
  user_id: string;
}

interface SongRecord {
  id: string;
  file_name: string;
  original_name: string;
  mode: string;
  file_size: number | null;
  storage_path: string | null;
  created_at: string;
  user_id: string;
}

type TabId = 'users' | 'conversions' | 'library';

const modeLabels: Record<string, string> = {
  'slowed-reverb': 'Slowed + Reverb',
  'remix': 'Remix',
  'lofi': 'Vintage Lo-Fi',
  '8d-spatial': '8D Spatial',
  '3d-surround': '3D Surround',
};

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [conversions, setConversions] = useState<ConversionRecord[]>([]);
  const [songs, setSongs] = useState<SongRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('users');
  const [stats, setStats] = useState({ total: 0, premium: 0, conversions: 0, songs: 0 });

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
      setStats(prev => ({
        ...prev,
        total: data.length,
        premium: data.filter((u: any) => u.is_premium).length,
      }));
    }
  }, []);

  const fetchConversions = useCallback(async () => {
    const { data, count } = await supabase
      .from('conversions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setConversions(data as ConversionRecord[]);
    setStats(prev => ({ ...prev, conversions: count ?? 0 }));
  }, []);

  const fetchSongs = useCallback(async () => {
    const { data, count } = await supabase
      .from('song_library')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setSongs(data as SongRecord[]);
    setStats(prev => ({ ...prev, songs: count ?? 0 }));
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    else if (user) checkAdmin();
  }, [user, authLoading, navigate, checkAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchConversions();
      fetchSongs();
    }
  }, [isAdmin, fetchUsers, fetchConversions, fetchSongs]);

  const togglePremium = async (profile: UserProfile) => {
    const newValue = !profile.is_premium;
    const { error } = await supabase
      .from('profiles')
      .update({ is_premium: newValue, subscription_status: newValue ? 'active' : 'free' })
      .eq('id', profile.id);
    if (error) { toast.error('Failed to update user'); return; }
    setUsers(prev => prev.map(u => u.id === profile.id ? { ...u, is_premium: newValue, subscription_status: newValue ? 'active' : 'free' } : u));
    setStats(prev => ({ ...prev, premium: prev.premium + (newValue ? 1 : -1) }));
    toast.success(`${profile.email} ${newValue ? 'upgraded to' : 'removed from'} Premium`);
  };

  const deleteSong = async (song: SongRecord) => {
    if (song.storage_path) {
      await supabase.storage.from('converted-songs').remove([song.storage_path]);
    }
    await supabase.from('song_library').delete().eq('id', song.id);
    setSongs(prev => prev.filter(s => s.id !== song.id));
    setStats(prev => ({ ...prev, songs: prev.songs - 1 }));
    toast.success('Song deleted');
  };

  const refreshAll = () => {
    fetchUsers();
    fetchConversions();
    fetchSongs();
    toast.success('Data refreshed');
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

  const getUserEmail = (userId: string) => users.find(u => u.id === userId)?.email || userId.slice(0, 8);

  const filteredUsers = users.filter(u =>
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.display_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredConversions = conversions.filter(c =>
    c.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (modeLabels[c.mode] || c.mode).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSongs = songs.filter(s =>
    s.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.original_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Mode usage stats
  const modeUsage = conversions.reduce((acc, c) => {
    acc[c.mode] = (acc[c.mode] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const tabs: { id: TabId; label: string; icon: typeof Users }[] = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'conversions', label: 'Conversions', icon: BarChart3 },
    { id: 'library', label: 'Library', icon: Music },
  ];

  return (
    <div className="min-h-screen bg-gradient-hero px-4 py-6">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-primary/5 blur-[120px] animate-pulse-glow" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between max-w-6xl mx-auto mb-6">
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
        <button onClick={refreshAll} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="w-4 h-4" />
          <span className="text-sm hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Stats */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-6xl mx-auto mb-6">
        {[
          { label: 'Total Users', value: stats.total, icon: Users, color: 'text-accent' },
          { label: 'Premium', value: stats.premium, icon: Crown, color: 'text-primary' },
          { label: 'Conversions', value: stats.conversions, icon: BarChart3, color: 'text-glow-warm' },
          { label: 'Library Songs', value: stats.songs, icon: Music, color: 'text-accent' },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-4 text-center">
            <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-1`} />
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Mode Usage Breakdown */}
      {Object.keys(modeUsage).length > 0 && (
        <div className="relative z-10 max-w-6xl mx-auto mb-6">
          <p className="text-xs font-mono text-muted-foreground/60 mb-2 uppercase tracking-wider">Engine Usage</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(modeUsage).sort((a, b) => b[1] - a[1]).map(([mode, count]) => (
              <div key={mode} className="flex items-center gap-1.5 px-3 py-1.5 glass rounded-full">
                <span className="text-xs font-medium text-foreground">{modeLabels[mode] || mode}</span>
                <span className="text-xs font-mono text-primary font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="relative z-10 max-w-6xl mx-auto mb-4">
        <div className="flex gap-1 p-1 glass rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative z-10 max-w-6xl mx-auto mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl glass border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'users' && (
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
                {filteredUsers.map((u) => (
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
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">No users found</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'conversions' && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase">File</th>
                  <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase">Engine</th>
                  <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase hidden md:table-cell">User</th>
                  <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase">
                    <Clock className="w-3 h-3 inline mr-1" />Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredConversions.map((c) => (
                  <tr key={c.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{c.file_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 text-primary border border-primary/25">
                        {modeLabels[c.mode] || c.mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground font-mono">{getUserEmail(c.user_id)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                    </td>
                  </tr>
                ))}
                {filteredConversions.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">No conversions found</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'library' && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase">Song</th>
                  <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase">Engine</th>
                  <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase hidden md:table-cell">Size</th>
                  <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase hidden md:table-cell">User</th>
                  <th className="text-center px-4 py-3 text-xs font-mono text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSongs.map((s) => (
                  <tr key={s.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-foreground truncate max-w-[180px]">{s.file_name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">{s.original_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/15 text-accent border border-accent/25">
                        {modeLabels[s.mode] || s.mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground font-mono">
                        {s.file_size ? `${(s.file_size / (1024 * 1024)).toFixed(1)} MB` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground font-mono">{getUserEmail(s.user_id)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => deleteSong(s)}
                        className="p-1.5 rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors"
                        title="Delete song"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredSongs.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No songs in library</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;

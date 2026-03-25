import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Music, Download, Trash2, ArrowLeft, Library as LibraryIcon, Waves, Volume2, Radio, Orbit, Speaker } from 'lucide-react';
import { toast } from 'sonner';
import HamburgerMenu from '@/components/HamburgerMenu';

interface SongEntry {
  id: string;
  file_name: string;
  original_name: string;
  mode: string;
  file_size: number;
  storage_path: string | null;
  created_at: string;
}

const modeIcons: Record<string, typeof Waves> = {
  'slowed-reverb': Waves,
  'remix': Volume2,
  'lofi': Radio,
  '8d-spatial': Orbit,
  '3d-surround': Speaker,
};

const modeLabels: Record<string, string> = {
  'slowed-reverb': 'Slowed + Reverb',
  'remix': 'Remix',
  'lofi': 'Vintage Lo-Fi',
  '8d-spatial': '8D Spatial',
  '3d-surround': '3D Surround',
};

const modeColors: Record<string, string> = {
  'slowed-reverb': 'text-primary',
  'remix': 'text-accent',
  'lofi': 'text-glow-warm',
  '8d-spatial': 'text-primary',
  '3d-surround': 'text-accent',
};

const Library = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [songs, setSongs] = useState<SongEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSongs = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('song_library')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) setSongs(data as SongEntry[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    else if (user) fetchSongs();
  }, [user, authLoading, navigate, fetchSongs]);

  const handleDownload = async (song: SongEntry) => {
    if (!song.storage_path) {
      toast.error('File not available for download');
      return;
    }
    const { data, error } = await supabase.storage
      .from('converted-songs')
      .download(song.storage_path);

    if (error || !data) {
      toast.error('Download failed');
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = song.file_name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (song: SongEntry) => {
    if (song.storage_path) {
      await supabase.storage.from('converted-songs').remove([song.storage_path]);
    }
    await supabase.from('song_library').delete().eq('id', song.id);
    setSongs(prev => prev.filter(s => s.id !== song.id));
    toast.success('Song removed');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-hero">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero px-4 py-6">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-primary/5 blur-[120px] animate-pulse-glow" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between max-w-4xl mx-auto mb-8">
        <div className="flex items-center gap-3">
          <HamburgerMenu />
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Back</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <LibraryIcon className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Song Library</h1>
        </div>
        <div className="w-20" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto">
        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 glass rounded-2xl">
            <Music className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No songs yet</h3>
            <p className="text-sm text-muted-foreground mb-6">Convert your first track to see it here</p>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Start Converting
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {songs.map((song) => {
              const Icon = modeIcons[song.mode] || Music;
              const color = modeColors[song.mode] || 'text-primary';
              return (
                <div key={song.id} className="flex items-center gap-3 md:gap-4 px-4 py-3 glass rounded-xl hover:glass-strong transition-all group">
                  <div className={`p-2 rounded-lg bg-secondary/60 ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{song.original_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={`font-semibold ${color}`}>{modeLabels[song.mode] || song.mode}</span>
                      <span>·</span>
                      <span>{formatSize(song.file_size)}</span>
                      <span>·</span>
                      <span>{new Date(song.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDownload(song)}
                      className="p-2 rounded-lg hover:bg-secondary/50 transition-colors text-primary"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(song)}
                      className="p-2 rounded-lg hover:bg-destructive/20 transition-colors text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Library;

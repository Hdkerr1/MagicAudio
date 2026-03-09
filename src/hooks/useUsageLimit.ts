import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const FREE_DAILY_LIMIT = 5;

export function useUsageLimit() {
  const { user, profile } = useAuth();
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchTodayCount = useCallback(async () => {
    if (!user) { setTodayCount(0); setLoading(false); return; }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count } = await supabase
      .from('conversions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', today.toISOString());
    
    setTodayCount(count ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchTodayCount(); }, [fetchTodayCount]);

  const isPremium = profile?.is_premium ?? false;
  const canConvert = isPremium || todayCount < FREE_DAILY_LIMIT;
  const remaining = isPremium ? Infinity : Math.max(0, FREE_DAILY_LIMIT - todayCount);

  const recordConversion = useCallback(async (fileName: string, mode: string) => {
    if (!user) return;
    await supabase.from('conversions').insert({
      user_id: user.id,
      file_name: fileName,
      mode,
    });
    setTodayCount(prev => prev + 1);
  }, [user]);

  return { canConvert, remaining, isPremium, todayCount, loading, recordConversion, FREE_DAILY_LIMIT };
}

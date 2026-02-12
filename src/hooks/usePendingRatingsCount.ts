import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const usePendingRatingsCount = (profileId: string | undefined) => {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!profileId) return;
    try {
      const { data, error } = await supabase.rpc('get_pending_ratings_with_affiliation', {
        p_profile_id: profileId
      });
      if (!error && data) {
        setCount(data.length);
      }
    } catch {
      // silent
    }
  }, [profileId]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return { pendingRatingsCount: count, refetchPendingRatings: fetchCount };
};

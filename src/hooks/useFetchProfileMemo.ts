// src/hooks/useFetchProfileMemo.ts
// Hook that provides a memoized fetchProfile function using an in-flight promise cache.
// This avoids duplicate concurrent requests for the same userId (prevents spammy network calls).

import { useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Setters = {
  setProfile: (p: any) => void;
  setProfiles: (p: any[]) => void;
  setLoading: (v: boolean) => void;
};

export function useFetchProfileMemo({ setProfile, setProfiles, setLoading }: Setters) {
  const profilePromiseCache = useRef<Record<string, Promise<any>>>({});

  const fetchProfile = useCallback(async (userId: string) => {
    if (!userId) return null;

    if (profilePromiseCache.current[userId]) {
      console.debug('[useFetchProfileMemo] Reusing in-flight fetchProfile promise for', userId);
      try {
        return await profilePromiseCache.current[userId];
      } catch {
        // if failed, continue and recreate below
      }
    }

    const promise = (async () => {
      try {
        console.debug('[useFetchProfileMemo] fetchProfile start', userId);
        setLoading(true);
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          console.error('[useFetchProfileMemo] fetchProfile error', error);
          setProfile(null);
          setProfiles([]);
          throw error;
        }

        if (!profileData) {
          setProfile(null);
          setProfiles([]);
          return null;
        }

        const { data: relatedProfiles } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId);

        setProfile(profileData);
        setProfiles(relatedProfiles || [profileData]);

        const savedProfileId = localStorage.getItem('current_profile_id');
        if (savedProfileId) {
          const found = (relatedProfiles || []).find((p: any) => p.id === savedProfileId);
          if (found) setProfile(found);
        }

        return profileData;
      } catch (e) {
        console.error('[useFetchProfileMemo] fetchProfile exception', e);
        setProfile(null);
        setProfiles([]);
        return null;
      } finally {
        setLoading(false);
        // clear cache after 30s TTL
        setTimeout(() => { delete profilePromiseCache.current[userId]; }, 30000);
      }
    })();

    profilePromiseCache.current[userId] = promise;
    return promise;
  }, [setProfile, setProfiles, setLoading]);

  return { fetchProfile };
}
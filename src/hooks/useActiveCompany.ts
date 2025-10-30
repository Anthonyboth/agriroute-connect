/**
 * useActiveCompany Hook
 * 
 * Securely manages active company selection using database-backed user_settings
 * Replaces insecure localStorage usage for company preferences
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface UserSettings {
  id?: string;
  user_id: string;
  active_company_id: string | null;
  active_profile_id: string | null;
  preferences: Record<string, any>;
}

export function useActiveCompany() {
  const { user, profile } = useAuth();
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          // PGRST116 = no rows returned, which is OK
          throw error;
        }

        if (data) {
          setActiveCompanyIdState(data.active_company_id);
        }

        setLoading(false);
      } catch (err: any) {
        console.error('[useActiveCompany] Error fetching settings:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user?.id]);

  // Update active company ID
  const setActiveCompanyId = useCallback(async (companyId: string | null) => {
    if (!user?.id) {
      console.warn('[useActiveCompany] Cannot set company ID without user');
      return;
    }

    try {
      // Optimistically update state
      setActiveCompanyIdState(companyId);

      // Upsert to database
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          active_company_id: companyId,
          active_profile_id: profile?.id || null,
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      // Clear legacy localStorage
      try {
        localStorage.removeItem('company_id');
        localStorage.removeItem('profile_id');
        localStorage.removeItem('mode');
      } catch (e) {
        // Ignore localStorage errors
      }
    } catch (err: any) {
      console.error('[useActiveCompany] Error updating settings:', err);
      setError(err.message);
      // Revert optimistic update
      setActiveCompanyIdState(activeCompanyId);
    }
  }, [user?.id, profile?.id, activeCompanyId]);

  // Update preferences
  const updatePreferences = useCallback(async (preferences: Record<string, any>) => {
    if (!user?.id) {
      console.warn('[useActiveCompany] Cannot update preferences without user');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          preferences,
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;
    } catch (err: any) {
      console.error('[useActiveCompany] Error updating preferences:', err);
      setError(err.message);
    }
  }, [user?.id]);

  // Get a specific preference
  const getPreference = useCallback(async (key: string): Promise<any> => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('preferences')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data?.preferences?.[key] ?? null;
    } catch (err: any) {
      console.error('[useActiveCompany] Error getting preference:', err);
      return null;
    }
  }, [user?.id]);

  return {
    activeCompanyId,
    setActiveCompanyId,
    updatePreferences,
    getPreference,
    loading,
    error,
  };
}

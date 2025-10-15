import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface NotificationPreferences {
  new_freights_enabled: boolean;
  new_services_enabled: boolean;
  proposals_received_enabled: boolean;
  chat_messages_enabled: boolean;
  payments_completed_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
}

export const useNotificationPreferences = () => {
  const { profile } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPreferences = async () => {
    if (!profile) return;
    
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Criar preferências padrão se não existirem
        const { data: newPrefs, error: insertError } = await supabase
          .from('notification_preferences')
          .insert({ user_id: profile.id })
          .select()
          .single();
        
        if (!insertError && newPrefs) {
          setPreferences(newPrefs);
        }
      } else if (!error && data) {
        setPreferences(data);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!profile || !preferences) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update({ [key]: value })
        .eq('user_id', profile.id);

      if (error) throw error;

      setPreferences({ ...preferences, [key]: value });
      toast.success('Preferência atualizada');
    } catch (error) {
      console.error('Error updating preference:', error);
      toast.error('Erro ao atualizar preferência');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchPreferences();

      const channel = supabase
        .channel('notification_preferences_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notification_preferences',
            filter: `user_id=eq.${profile.id}`
          },
          () => fetchPreferences()
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }
  }, [profile]);

  return {
    preferences,
    loading,
    saving,
    updatePreference,
    refetch: fetchPreferences
  };
};

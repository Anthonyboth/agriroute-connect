import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export const usePushNotifications = () => {
  const { profile } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Verificar se o navegador suporta push notifications
    const supported = 'Notification' in window && 
                     'serviceWorker' in navigator && 
                     'PushManager' in window;
    setIsSupported(supported);

    if (supported && profile) {
      checkSubscription();
    }
  }, [profile]);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const requestPermission = async () => {
    if (!isSupported) {
      toast.error('Seu navegador não suporta notificações push');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting permission:', error);
      return false;
    }
  };

  const subscribe = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      // Solicitar permissão
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        toast.error('Permissão para notificações negada');
        return;
      }

      // Registrar service worker se ainda não foi
      let registration;
      try {
        registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
      } catch (error) {
        console.error('Service worker registration failed:', error);
        toast.error('Erro ao registrar service worker');
        return;
      }

      // VAPID keys (em produção, usar variáveis de ambiente)
      // Por enquanto, vamos apenas marcar como inscrito sem criar subscription real
      // O usuário precisará adicionar as VAPID keys nas variáveis de ambiente
      
      // Salvar no banco como ativo
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: profile.id,
          endpoint: 'browser-notification-enabled',
          p256dh_key: 'pending-vapid-setup',
          auth_key: 'pending-vapid-setup',
          user_agent: navigator.userAgent,
          is_active: true,
          last_used_at: new Date().toISOString()
        });

      if (error) throw error;

      setIsSubscribed(true);
      toast.success('Notificações push ativadas! Configure as VAPID keys para receber notificações.');
    } catch (error) {
      console.error('Error subscribing:', error);
      toast.error('Erro ao ativar notificações push');
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Desativar no banco
      const { error } = await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('user_id', profile.id);

      if (error) throw error;

      setIsSubscribed(false);
      toast.success('Notificações push desativadas');
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast.error('Erro ao desativar notificações push');
    } finally {
      setLoading(false);
    }
  };

  return {
    isSupported,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe,
    requestPermission
  };
};

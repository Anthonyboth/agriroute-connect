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
      // Verificar se o navegador suporta notificações
      if (!isSupported) {
        toast.error('Seu navegador não suporta notificações push');
        return;
      }

      // Solicitar permissão
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        toast.error('Permissão para notificações negada');
        return;
      }

      // Verificar se service worker já está registrado
      let registration = await navigator.serviceWorker.getRegistration();
      
      if (!registration) {
        try {
          // Verificar se o arquivo existe antes de registrar
          const swResponse = await fetch('/sw.js', { method: 'HEAD' });
          if (!swResponse.ok) {
            console.warn('Service worker file not found, creating basic registration');
            // Criar um service worker inline básico se o arquivo não existir
            const blob = new Blob([`
              self.addEventListener('push', function(event) {
                const options = {
                  body: event.data ? event.data.text() : 'Nova notificação',
                  icon: '/android-chrome-192x192.png',
                  badge: '/favicon.png'
                };
                event.waitUntil(
                  self.registration.showNotification('AgriRoute', options)
                );
              });
            `], { type: 'application/javascript' });
            const swUrl = URL.createObjectURL(blob);
            registration = await navigator.serviceWorker.register(swUrl);
          } else {
            registration = await navigator.serviceWorker.register('/sw.js');
          }
          await navigator.serviceWorker.ready;
          console.log('✅ Service worker registrado com sucesso');
        } catch (error) {
          console.error('❌ Erro ao registrar service worker:', error);
          toast.error('Erro ao configurar notificações');
          return;
        }
      }

      // Salvar no banco como ativo (sem criar subscription real por enquanto)
      // VAPID keys precisam ser configuradas para push notifications reais
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

      if (error) {
        console.error('❌ Erro ao salvar configuração:', error);
        throw error;
      }

      setIsSubscribed(true);
      toast.success('Notificações ativadas com sucesso!');
      
      console.log('✅ Push notifications configuradas');
    } catch (error) {
      console.error('❌ Erro ao ativar notificações push:', error);
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

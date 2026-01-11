import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { isLovablePreviewHost } from '@/utils/isLovablePreviewHost';

export const usePushNotifications = () => {
  const { profile } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Verificar se o navegador suporta push notifications
    const supported =
      'Notification' in window &&
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

      // Registrar service worker APENAS fora do Preview (Preview pode ficar preso em versões antigas)
      let registration = await navigator.serviceWorker.getRegistration();

      if (!registration && import.meta.env.PROD && !isLovablePreviewHost()) {
        try {
          registration = await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;
          console.log('[PushNotifications] Service worker registrado');
        } catch (error) {
          console.error('[PushNotifications] Erro ao registrar SW:', error);
          toast.error('Erro ao configurar notificações');
          return;
        }
      }

      if (!registration) {
        toast.error('Notificações push indisponíveis no Preview. Abra a versão publicada/instalada.');
        return;
      }

      // VAPID public key - deve estar configurada no Supabase
      // Para gerar: https://vapidkeys.com/ ou web-push generate-vapid-keys
      const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

      if (!VAPID_PUBLIC_KEY) {
        console.warn('[PushNotifications] VAPID key não configurada, usando fallback');
        // Fallback: salvar apenas flag de ativo sem subscription real
        const { error } = await supabase
          .from('push_subscriptions')
          .upsert({
            user_id: profile.id,
            endpoint: 'browser-notification-enabled',
            p256dh_key: 'pending-vapid-setup',
            auth_key: 'pending-vapid-setup',
            user_agent: navigator.userAgent,
            is_active: true,
            last_used_at: new Date().toISOString(),
          });

        if (error) throw error;

        setIsSubscribed(true);
        toast.success('Notificações ativadas! (Configure VAPID keys para push real)');
        return;
      }

      // Criar subscription real com VAPID
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      console.log('[PushNotifications] Subscription criada:', subscription.endpoint);

      // Extrair keys da subscription
      const p256dhKey = arrayBufferToBase64(subscription.getKey('p256dh'));
      const authKey = arrayBufferToBase64(subscription.getKey('auth'));

      // Salvar no banco
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: profile.id,
          endpoint: subscription.endpoint,
          p256dh_key: p256dhKey,
          auth_key: authKey,
          user_agent: navigator.userAgent,
          is_active: true,
          last_used_at: new Date().toISOString(),
        });

      if (error) {
        console.error('[PushNotifications] Erro ao salvar:', error);
        throw error;
      }

      setIsSubscribed(true);
      toast.success('Notificações push ativadas com sucesso! 🔔');

      console.log('[PushNotifications] Configuração completa');
    } catch (error) {
      console.error('[PushNotifications] Erro:', error);
      toast.error('Erro ao ativar notificações push');
    } finally {
      setLoading(false);
    }
  };

  // Helper: Converter VAPID key de base64 para Uint8Array
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // Helper: Converter ArrayBuffer para base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer | null) => {
    if (!buffer) return '';
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
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
    requestPermission,
  };
};

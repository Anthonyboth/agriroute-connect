import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useDevicePermissions } from './useDevicePermissions';
import { registerDevice, updateLastActivity, syncDevicePermissions } from '@/services/deviceService';
import { getDeviceId } from '@/utils/deviceDetection';
import { supabase } from '@/integrations/supabase/client';

// ✅ Flags globais para prevenir múltiplas chamadas simultâneas
let isRegistering = false;

export const useDeviceRegistration = () => {
  const { user, profile } = useAuth();
  const { permissions } = useDevicePermissions();
  const hasRegistered = useRef(false);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivitySentRef = useRef(0);

  // ✅ Efeito de cleanup de montagem
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ✅ EFEITO A: Registro do device (once por sessão/TTL)
  useEffect(() => {
    if (!user || !profile) return;

    const registrationKey = `device_reg_v2:${user.id}`;
    const lastRegistration = localStorage.getItem(registrationKey);
    
    if (lastRegistration) {
      const timeSinceRegistration = Date.now() - parseInt(lastRegistration);
      if (timeSinceRegistration < 30 * 60 * 1000) {
        return; // Registrado nos últimos 30 min
      }
    }

    if (hasRegistered.current || isRegistering) return;

    const register = async () => {
      hasRegistered.current = true;
      isRegistering = true;
      
      try {
        await new Promise(resolve => setTimeout(resolve, 800));
        if (!mountedRef.current) return;
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token || !mountedRef.current) return;
        
        await registerDevice(profile.id);
        if (!mountedRef.current) return;
        
        localStorage.setItem(registrationKey, Date.now().toString());
        console.log('✅ Dispositivo registrado com sucesso');

        const deviceId = getDeviceId();
        await syncDevicePermissions(deviceId, {
          location: permissions.location === 'granted',
          push: permissions.notifications === 'granted',
          storage: permissions.storage === 'granted'
        });
      } catch (error: any) {
        if (error?.code === '42501') {
          console.log('⏭️ Device registration RLS - será tentado novamente no próximo acesso');
        } else {
          console.warn('⚠️ Aviso ao registrar dispositivo:', error?.message);
        }
        hasRegistered.current = false;
      } finally {
        isRegistering = false;
      }
    };

    register();
  }, [user?.id, profile?.id]);

  // ✅ EFEITO B: Heartbeat com cleanup real e throttling
  useEffect(() => {
    if (!user || !profile) return;

    const deviceId = getDeviceId();
    
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      // Throttle: mín 4.5 min entre updates reais
      if (now - lastActivitySentRef.current < 4.5 * 60 * 1000) return;
      lastActivitySentRef.current = now;
      
      try {
        updateLastActivity(deviceId);
      } catch (error) {
        console.warn('⚠️ Erro ao atualizar lastActivity:', error);
      }
    }, 5 * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user?.id, profile?.id]);
};

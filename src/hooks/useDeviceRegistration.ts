import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useDevicePermissions } from './useDevicePermissions';
import { registerDevice, updateLastActivity, syncDevicePermissions } from '@/services/deviceService';
import { getDeviceId } from '@/utils/deviceDetection';

// ✅ Flags globais para prevenir múltiplas chamadas simultâneas
let isRegistering = false;
let registrationPromise: Promise<void> | null = null;

export const useDeviceRegistration = () => {
  const { user, profile } = useAuth();
  const { permissions } = useDevicePermissions();
  const hasRegistered = useRef(false);

  useEffect(() => {
    if (!user || !profile) return;

    // ✅ SENTINELA DE SESSÃO: prevenir múltiplos registros por sessão/usuário
    const sessionKey = `device_reg_v1:${user.id}`;
    if (sessionStorage.getItem(sessionKey)) {
      hasRegistered.current = true;
      return;
    }

    // ✅ PREVENIR REGISTRO DUPLICADO na mesma sessão
    if (hasRegistered.current) {
      return;
    }

    // ✅ PREVENIR CHAMADAS SIMULTÂNEAS entre múltiplos hooks
    if (isRegistering) {
      return;
    }

    // ✅ REUSAR PROMISE EXISTENTE SE HOUVER
    if (registrationPromise) {
      registrationPromise.then(() => {
        hasRegistered.current = true;
      });
      return;
    }

    // Registrar dispositivo ao fazer login
    const register = async () => {
      isRegistering = true;
      const sessionKey = `device_reg_v1:${user.id}`;
      
      try {
        await registerDevice(user.id);
        console.log('✅ Dispositivo registrado com sucesso');

        // Sincronizar permissões realmente verificadas
        const deviceId = getDeviceId();
        await syncDevicePermissions(deviceId, {
          location: permissions.location === 'granted',
          push: permissions.notifications === 'granted',
          storage: permissions.storage === 'granted'
        });
        
        // ✅ MARCAR COMO REGISTRADO NA SESSÃO
        sessionStorage.setItem(sessionKey, Date.now().toString());
        hasRegistered.current = true;
      } catch (error: any) {
        console.error('❌ Erro ao registrar dispositivo:', error?.message);
      } finally {
        isRegistering = false;
        registrationPromise = null;
      }
    };

    registrationPromise = register();

    // Atualizar atividade a cada 5 minutos
    const deviceId = getDeviceId();
    const interval = setInterval(() => {
      updateLastActivity(deviceId);
    }, 5 * 60 * 1000); // 5 minutos

    return () => {
      clearInterval(interval);
    };
  }, [user?.id, profile?.id]);
};

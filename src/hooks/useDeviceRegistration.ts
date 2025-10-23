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

    // ✅ LOCALSTORAGE com timestamp: prevenir múltiplos registros por 30 minutos
    const registrationKey = `device_reg_v2:${user.id}`;
    const lastRegistration = localStorage.getItem(registrationKey);
    
    // Se já registrou nos últimos 30 minutos, não registrar novamente
    if (lastRegistration) {
      const timeSinceRegistration = Date.now() - parseInt(lastRegistration);
      if (timeSinceRegistration < 30 * 60 * 1000) { // 30 minutos
        console.log('⏭️ Device já registrado nesta sessão, pulando...');
        return;
      }
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
      hasRegistered.current = true;
      isRegistering = true;
      
      try {
        await registerDevice(user.id);
        
        // Marcar como registrado com timestamp
        localStorage.setItem(registrationKey, Date.now().toString());
        console.log('✅ Dispositivo registrado com sucesso');

        // Sincronizar permissões realmente verificadas
        const deviceId = getDeviceId();
        await syncDevicePermissions(deviceId, {
          location: permissions.location === 'granted',
          push: permissions.notifications === 'granted',
          storage: permissions.storage === 'granted'
        });
      } catch (error: any) {
        console.error('❌ Erro ao registrar dispositivo:', {
          message: error?.message,
          code: error?.code,
        });
        hasRegistered.current = false;
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

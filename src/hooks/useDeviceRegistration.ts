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

    // ✅ PREVENIR REGISTRO DUPLICADO na mesma sessão
    if (hasRegistered.current) {
      console.log('⏭️ Dispositivo já registrado nesta sessão, pulando...');
      return;
    }

    // ✅ PREVENIR CHAMADAS SIMULTÂNEAS entre múltiplos hooks
    if (isRegistering) {
      console.log('⏳ Registro de dispositivo já em andamento, aguardando...');
      return;
    }

    // ✅ REUSAR PROMISE EXISTENTE SE HOUVER
    if (registrationPromise) {
      console.log('♻️ Reusando promise de registro existente');
      registrationPromise.then(() => {
        hasRegistered.current = true;
      });
      return;
    }

    // Registrar dispositivo ao fazer login
    const register = async () => {
      isRegistering = true;
      
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
        
        hasRegistered.current = true;
      } catch (error: any) {
        console.error('❌ Erro ao registrar dispositivo no hook:', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          profileId: profile.id,
        });
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

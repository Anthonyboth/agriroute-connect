import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { useDevicePermissions } from './useDevicePermissions';
import { registerDevice, updateLastActivity, syncDevicePermissions } from '@/services/deviceService';
import { getDeviceId } from '@/utils/deviceDetection';

export const useDeviceRegistration = () => {
  const { profile } = useAuth();
  const { permissions } = useDevicePermissions();

  useEffect(() => {
    if (!profile) return;

    // Registrar dispositivo ao fazer login
    const register = async () => {
      try {
        await registerDevice(profile.id);
        console.log('Dispositivo registrado');

        // Sincronizar permissões realmente verificadas
        const deviceId = getDeviceId();
        await syncDevicePermissions(deviceId, {
          location: permissions.location === 'granted',
          push: permissions.notifications === 'granted',
          storage: permissions.storage === 'granted'
          // Não sincronizar câmera/microfone até serem usados
        });
      } catch (error) {
        console.error('Erro ao registrar dispositivo:', error);
      }
    };

    register();

    // Atualizar atividade a cada 5 minutos
    const deviceId = getDeviceId();
    const interval = setInterval(() => {
      updateLastActivity(deviceId);
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [profile, permissions]);
};

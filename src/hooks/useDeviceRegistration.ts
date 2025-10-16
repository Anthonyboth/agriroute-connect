import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { registerDevice, updateLastActivity } from '@/services/deviceService';
import { getDeviceId } from '@/utils/deviceDetection';

export const useDeviceRegistration = () => {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile) return;

    // Registrar dispositivo ao fazer login
    const register = async () => {
      try {
        await registerDevice(profile.id);
        console.log('✅ Dispositivo registrado');
      } catch (error) {
        console.error('❌ Erro ao registrar dispositivo:', error);
      }
    };

    register();

    // Atualizar atividade a cada 5 minutos
    const deviceId = getDeviceId();
    const interval = setInterval(() => {
      updateLastActivity(deviceId);
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [profile]);
};

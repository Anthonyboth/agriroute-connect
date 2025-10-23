import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { useDevicePermissions } from './useDevicePermissions';
import { registerDevice, updateLastActivity, syncDevicePermissions } from '@/services/deviceService';
import { getDeviceId } from '@/utils/deviceDetection';

export const useDeviceRegistration = () => {
  const { user, profile } = useAuth();
  const { permissions } = useDevicePermissions();

  useEffect(() => {
    if (!user || !profile) return;

    let isRegistering = false;

    // Registrar dispositivo ao fazer login
    const register = async () => {
      if (isRegistering) return;
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
      } catch (error: any) {
        // ✅ LOG DETALHADO (deviceService.ts já envia para Telegram, não duplicar)
        console.error('❌ Erro ao registrar dispositivo no hook:', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          profileId: profile.id,
          fullError: error
        });
        // Não mostrar toast - usuário não precisa saber desse erro técnico
      } finally {
        isRegistering = false;
      }
    };

    register();

    // Atualizar atividade a cada 5 minutos
    const deviceId = getDeviceId();
    const interval = setInterval(() => {
      updateLastActivity(deviceId);
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [user?.id, profile?.id]); // Depend on user.id for registration
};

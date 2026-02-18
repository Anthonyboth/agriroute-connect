import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { getDeviceId } from '@/utils/deviceDetection';
import { syncDevicePermissions } from '@/services/deviceService';

export type PermissionType = 'location' | 'camera' | 'microphone' | 'notifications' | 'storage';

export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface DevicePermissions {
  location: PermissionStatus;
  camera: PermissionStatus;
  microphone: PermissionStatus;
  notifications: PermissionStatus;
  storage: PermissionStatus;
}

export const useDevicePermissions = () => {
  const [permissions, setPermissions] = useState<DevicePermissions>({
    location: 'prompt',
    camera: 'prompt',
    microphone: 'prompt',
    notifications: 'prompt',
    storage: 'prompt',
  });
  
  const [loading, setLoading] = useState(true);

  // Verificar status de localização
  const checkLocationPermission = async (): Promise<PermissionStatus> => {
    if (!('geolocation' in navigator)) return 'unsupported';
    
    try {
      if ('permissions' in navigator) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        return result.state as PermissionStatus;
      }
      return 'prompt';
    } catch {
      return 'prompt';
    }
  };

  // Verificar status de mídia SEM ativar os dispositivos
  const checkMediaPermission = async (type: 'camera' | 'microphone'): Promise<PermissionStatus> => {
    try {
      // Usar apenas Permissions API para não ativar câmera/microfone
      if ('permissions' in navigator) {
        try {
          const result = await navigator.permissions.query({ name: type as any });
          return result.state as PermissionStatus;
        } catch {
          return 'prompt';
        }
      }

      // Verificar suporte básico
      if (typeof window !== 'undefined' && window.navigator && window.navigator.mediaDevices) {
        return 'prompt';
      }

      return 'unsupported';
    } catch {
      return 'prompt';
    }
  };

  // Verificar permissão sob demanda (quando usuário solicitar)
  const checkPermissionOnDemand = useCallback(async (type: PermissionType): Promise<PermissionStatus> => {
    switch (type) {
      case 'location':
        return checkLocationPermission();
      case 'camera':
      case 'microphone':
        return checkMediaPermission(type);
      case 'notifications':
        return checkNotificationPermission();
      case 'storage':
        return checkStoragePermission();
      default:
        return 'unsupported';
    }
  }, []);

  // Verificar status de notificações
  const checkNotificationPermission = (): PermissionStatus => {
    if (!('Notification' in window)) return 'unsupported';
    
    const permission = Notification.permission;
    if (permission === 'default') return 'prompt';
    return permission as PermissionStatus;
  };

  // Verificar status de storage
  const checkStoragePermission = (): PermissionStatus => {
    if (!('localStorage' in window)) return 'unsupported';
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      return 'granted';
    } catch {
      return 'denied';
    }
  };

  // Verificar permissões sem ativar dispositivos
  const checkAllPermissions = useCallback(async () => {
    setLoading(true);
    
    try {
      const [location, notifications, storage] = await Promise.all([
        checkLocationPermission(),
        Promise.resolve(checkNotificationPermission()),
        Promise.resolve(checkStoragePermission()),
      ]);

      // Câmera e microfone: apenas verificar status via Permissions API, não ativar
      let camera: PermissionStatus = 'unsupported';
      let microphone: PermissionStatus = 'unsupported';

      if ('permissions' in navigator) {
        try {
          const cameraResult = await navigator.permissions.query({ name: 'camera' as any });
          camera = cameraResult.state as PermissionStatus;
        } catch {
          camera = 'prompt';
        }

        try {
          const micResult = await navigator.permissions.query({ name: 'microphone' as any });
          microphone = micResult.state as PermissionStatus;
        } catch {
          microphone = 'prompt';
        }
      }

      const newPermissions = {
        location,
        camera,
        microphone,
        notifications,
        storage,
      };

      setPermissions(newPermissions);
      
      // Sincronizar apenas permissões verificadas
      const deviceId = getDeviceId();
      await syncDevicePermissions(deviceId, {
        location: location === 'granted',
        push: notifications === 'granted',
        storage: storage === 'granted'
        // Não sincronizar câmera/microfone até serem usados
      });
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Solicitar permissão específica
  const requestPermission = async (type: PermissionType): Promise<boolean> => {
    try {
      let granted = false;

      switch (type) {
        case 'location':
          try {
            const { getCurrentPositionSafe } = await import('@/utils/location');
            const position = await getCurrentPositionSafe();
            granted = !!position;
          } catch {
            granted = false;
          }
          break;

        case 'camera':
        case 'microphone':
          try {
            const constraints = type === 'camera'
              ? { video: true, audio: false }
              : { video: false, audio: true };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            stream.getTracks().forEach(track => track.stop());
            granted = true;
          } catch {
            granted = false;
          }
          break;

        case 'notifications':
          if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            granted = permission === 'granted';
          }
          break;

        case 'storage':
          granted = checkStoragePermission() === 'granted';
          break;
      }

      if (granted) {
        toast.success(`Permissão de ${getPermissionLabel(type)} concedida`);
        await checkAllPermissions();
      } else {
        toast.error(`Permissão de ${getPermissionLabel(type)} negada`);
      }

      return granted;
    } catch (error) {
      console.error(`Erro ao solicitar permissão de ${type}:`, error);
      toast.error(`Erro ao solicitar permissão de ${getPermissionLabel(type)}`);
      return false;
    }
  };

  // Status individual de permissão
  const getPermissionStatus = (type: PermissionType): PermissionStatus => {
    return permissions[type];
  };

  // Verificar se tem todas as permissões obrigatórias
  const hasRequiredPermissions = (): boolean => {
    return permissions.location === 'granted' && permissions.storage === 'granted';
  };

  // Verificar permissões ao montar
  useEffect(() => {
    checkAllPermissions();
  }, [checkAllPermissions]);

  return {
    permissions,
    loading,
    checkAllPermissions,
    requestPermission,
    getPermissionStatus,
    hasRequiredPermissions,
    checkPermissionOnDemand
  };
};

// Helper para labels amigáveis
const getPermissionLabel = (type: PermissionType): string => {
  const labels: Record<PermissionType, string> = {
    location: 'localização',
    camera: 'câmera',
    microphone: 'microfone',
    notifications: 'notificações',
    storage: 'armazenamento',
  };
  return labels[type];
};

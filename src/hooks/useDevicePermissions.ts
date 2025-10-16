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

  // Verificar status de câmera/microfone
  const checkMediaPermission = async (type: 'camera' | 'microphone'): Promise<PermissionStatus> => {
    if (!('mediaDevices' in navigator)) return 'unsupported';
    
    try {
      const constraints = type === 'camera' 
        ? { video: true, audio: false }
        : { video: false, audio: true };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach(track => track.stop());
      return 'granted';
    } catch (error: any) {
      if (error.name === 'NotAllowedError') return 'denied';
      if (error.name === 'NotFoundError') return 'unsupported';
      return 'prompt';
    }
  };

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

  // Verificar todas as permissões
  const checkAllPermissions = useCallback(async () => {
    setLoading(true);
    
    try {
      const [location, camera, microphone, notifications, storage] = await Promise.all([
        checkLocationPermission(),
        checkMediaPermission('camera'),
        checkMediaPermission('microphone'),
        Promise.resolve(checkNotificationPermission()),
        Promise.resolve(checkStoragePermission()),
      ]);

      const newPermissions = {
        location,
        camera,
        microphone,
        notifications,
        storage,
      };

      setPermissions(newPermissions);
      
      // Sincronizar com o banco
      const deviceId = getDeviceId();
      await syncDevicePermissions(deviceId, {
        location: location === 'granted',
        camera: camera === 'granted',
        push: notifications === 'granted',
        microphone: microphone === 'granted',
        storage: storage === 'granted',
      });
    } catch (error) {
      console.error('❌ Erro ao verificar permissões:', error);
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
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject);
            });
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
      console.error(`❌ Erro ao solicitar permissão de ${type}:`, error);
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

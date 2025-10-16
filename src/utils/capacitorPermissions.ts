import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';

export type CapacitorPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

// Verificar e solicitar permissão de localização (nativo)
export const checkGeolocationPermission = async (): Promise<CapacitorPermissionStatus> => {
  if (!Capacitor.isNativePlatform()) {
    return 'unsupported';
  }

  try {
    const status = await Geolocation.checkPermissions();
    
    if (status.location === 'granted') {
      return 'granted';
    } else if (status.location === 'denied') {
      return 'denied';
    }
    
    return 'prompt';
  } catch (error) {
    console.error('❌ Erro ao verificar permissão de localização:', error);
    return 'unsupported';
  }
};

export const requestGeolocationPermission = async (): Promise<CapacitorPermissionStatus> => {
  if (!Capacitor.isNativePlatform()) {
    return 'unsupported';
  }

  try {
    const status = await Geolocation.requestPermissions();
    
    if (status.location === 'granted') {
      return 'granted';
    } else if (status.location === 'denied') {
      return 'denied';
    }
    
    return 'prompt';
  } catch (error) {
    console.error('❌ Erro ao solicitar permissão de localização:', error);
    return 'denied';
  }
};

// Verificar e solicitar permissão de câmera (nativo)
export const checkCameraPermission = async (): Promise<CapacitorPermissionStatus> => {
  if (!Capacitor.isNativePlatform()) {
    return 'unsupported';
  }

  try {
    const status = await Camera.checkPermissions();
    
    if (status.camera === 'granted' && status.photos === 'granted') {
      return 'granted';
    } else if (status.camera === 'denied' || status.photos === 'denied') {
      return 'denied';
    }
    
    return 'prompt';
  } catch (error) {
    console.error('❌ Erro ao verificar permissão de câmera:', error);
    return 'unsupported';
  }
};

export const requestCameraPermission = async (): Promise<CapacitorPermissionStatus> => {
  if (!Capacitor.isNativePlatform()) {
    return 'unsupported';
  }

  try {
    const status = await Camera.requestPermissions();
    
    if (status.camera === 'granted' && status.photos === 'granted') {
      return 'granted';
    } else if (status.camera === 'denied' || status.photos === 'denied') {
      return 'denied';
    }
    
    return 'prompt';
  } catch (error) {
    console.error('❌ Erro ao solicitar permissão de câmera:', error);
    return 'denied';
  }
};

// Verificar se está rodando no app nativo
export const isNativeApp = (): boolean => {
  return Capacitor.isNativePlatform();
};

// Obter plataforma nativa
export const getNativePlatform = (): 'ios' | 'android' | 'web' => {
  if (!Capacitor.isNativePlatform()) {
    return 'web';
  }
  
  return Capacitor.getPlatform() as 'ios' | 'android';
};

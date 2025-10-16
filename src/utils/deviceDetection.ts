import { Capacitor } from '@capacitor/core';

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  os: string;
  browser: string;
  userAgent: string;
  isNative: boolean;
  platform: 'ios' | 'android' | 'web';
  capabilities: {
    geolocation: boolean;
    camera: boolean;
    microphone: boolean;
    notifications: boolean;
    storage: boolean;
  };
}

// Gerar device ID único e persistente
export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('device_id');
  
  if (!deviceId) {
    // Criar ID único baseado em características do navegador
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let fingerprint = navigator.userAgent;
    
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('fingerprint', 2, 2);
      fingerprint += canvas.toDataURL();
    }
    
    // Hash simples para gerar UUID
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    deviceId = `device-${Math.abs(hash).toString(36)}-${Date.now().toString(36)}`;
    localStorage.setItem('device_id', deviceId);
  }
  
  return deviceId;
};

// Detectar tipo de dispositivo
export const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua);
  const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(ua);
  
  if (isTablet) return 'tablet';
  if (isMobile) return 'mobile';
  return 'desktop';
};

// Detectar sistema operacional
export const getOS = (): string => {
  const ua = navigator.userAgent;
  
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() === 'ios' ? 'iOS' : 'Android';
  }
  
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  if (/Android/i.test(ua)) return 'Android';
  if (/iOS|iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  
  return 'Unknown';
};

// Detectar navegador
export const getBrowser = (): string => {
  const ua = navigator.userAgent;
  
  if (Capacitor.isNativePlatform()) {
    return 'Native App';
  }
  
  if (/Chrome/i.test(ua) && !/Edge|Edg/i.test(ua)) return 'Chrome';
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
  if (/Firefox/i.test(ua)) return 'Firefox';
  if (/Edge|Edg/i.test(ua)) return 'Edge';
  if (/Opera|OPR/i.test(ua)) return 'Opera';
  
  return 'Unknown';
};

// Detectar nome amigável do dispositivo
export const getDeviceName = (): string => {
  const os = getOS();
  const browser = getBrowser();
  const type = getDeviceType();
  
  if (Capacitor.isNativePlatform()) {
    return `${os} ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  }
  
  return `${browser} on ${os}`;
};

// Detectar capacidades do dispositivo
export const getDeviceCapabilities = async (): Promise<DeviceInfo['capabilities']> => {
  return {
    geolocation: 'geolocation' in navigator,
    camera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
    microphone: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
    notifications: 'Notification' in window && 'serviceWorker' in navigator,
    storage: 'localStorage' in window,
  };
};

// Obter informações completas do dispositivo
export const getDeviceInfo = async (): Promise<DeviceInfo> => {
  const capabilities = await getDeviceCapabilities();
  
  return {
    deviceId: getDeviceId(),
    deviceName: getDeviceName(),
    deviceType: getDeviceType(),
    os: getOS(),
    browser: getBrowser(),
    userAgent: navigator.userAgent,
    isNative: Capacitor.isNativePlatform(),
    platform: Capacitor.isNativePlatform() 
      ? (Capacitor.getPlatform() as 'ios' | 'android')
      : 'web',
    capabilities,
  };
};

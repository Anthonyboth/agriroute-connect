import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.f2dbc20153194f90a3cc8dd215bbebba',
  appName: 'AgriRoute',
  webDir: 'dist',
  // server: {
  //   url: 'https://f2dbc201-5319-4f90-a3cc-8dd215bbebba.lovableproject.com?forceHideBadge=true',
  //   cleartext: true
  // },
  plugins: {
    SplashScreen: {
      // Manter splash visível por mais tempo para garantir WebView pronta
      launchShowDuration: 3000,
      launchAutoHide: false,
      // Cor verde AgriRoute - DEVE ser idêntica ao LaunchScreen.storyboard
      backgroundColor: '#16a34a',
      showSpinner: false,
      // iOS: usar launch screen nativo como splash (elimina gap)
      launchFadeOutDuration: 500,
      // Android settings
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    Geolocation: {
      permissions: {
        location: 'always'
      }
    },
    Camera: {
      permissions: {
        camera: true,
        photos: true
      }
    }
  },
  android: {
    allowMixedContent: true
  },
  ios: {
    contentInset: 'automatic',
    // Usar o mesmo background do splash para eliminar flash preto
    backgroundColor: '#16a34a'
  }
};

export default config;

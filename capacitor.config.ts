import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.f2dbc20153194f90a3cc8dd215bbebba',
  appName: 'agriroute-connect',
  webDir: 'dist',
  server: {
    url: 'https://f2dbc201-5319-4f90-a3cc-8dd215bbebba.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;
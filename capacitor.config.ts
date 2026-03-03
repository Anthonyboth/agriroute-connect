import { CapacitorConfig } from '@capacitor/cli';

/**
 * ✅ RELEASE HARDENING: Capacitor Configuration
 * 
 * This config supports two modes:
 * 1. DEVELOPMENT: Connect to Lovable preview for hot-reload
 * 2. PRODUCTION: Use bundled dist/ assets (default)
 * 
 * To enable hot-reload in development:
 * 1. Uncomment the server block below
 * 2. Run `npx cap sync`
 * 3. Run `npx cap run android` or `npx cap run ios`
 */

const config: CapacitorConfig = {
  appId: 'app.lovable.f2dbc20153194f90a3cc8dd215bbebba',
  appName: 'AgriRoute',
  webDir: 'dist',
  
  // ✅ DEVELOPMENT MODE: Uncomment below for hot-reload from Lovable preview
  // server: {
  //   url: 'https://f2dbc201-5319-4f90-a3cc-8dd215bbebba.lovableproject.com?forceHideBadge=true',
  //   cleartext: true
  // },
  
  // ✅ PRODUCTION MODE: Uses bundled assets from webDir (dist/)
  // No server config = load from local bundle
  
  // ✅ SplashScreen DISABLED - using native LaunchScreen.storyboard only
  // The Capacitor SplashScreen plugin was overriding the storyboard with green background
  plugins: {
    // SplashScreen: {
    //   launchShowDuration: 3000,
    //   launchAutoHide: false,
    //   backgroundColor: '#FFFFFF',
    //   showSpinner: false,
    //   launchFadeOutDuration: 500,
    //   androidScaleType: 'CENTER_CROP',
    //   splashFullScreen: true,
    //   splashImmersive: true
    // },
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
    allowMixedContent: true,
    // ✅ RELEASE HARDENING: Proper WebView settings
    webContentsDebuggingEnabled: false, // ✅ RELEASE HARDENING: disabled for production
  },
  ios: {
    contentInset: 'automatic',
    // Use same background as splash to eliminate black flash
    backgroundColor: '#FFFFFF',
    // ✅ RELEASE HARDENING: Proper scheme for deep links
    scheme: 'agriroute'
  }
};

export default config;

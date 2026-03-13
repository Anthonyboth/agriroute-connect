import { CapacitorConfig } from '@capacitor/cli';

/**
 * ✅ RELEASE HARDENING v2: Capacitor Configuration
 * 
 * MODES:
 * 1. PRODUCTION (default): Uses bundled dist/ assets — safe for Play Store / App Store
 * 2. DEVELOPMENT: Set env CAPACITOR_LIVE_RELOAD=true to connect to Lovable preview
 * 
 * ⚠️ NEVER commit server.url pointing to a remote URL without the env guard.
 *    This caused FRT-062: Android app flashing/crashing on Play Store.
 * 
 * To enable hot-reload in development:
 *   CAPACITOR_LIVE_RELOAD=true npx cap sync
 *   npx cap run android
 */

const isLiveReload = process.env.CAPACITOR_LIVE_RELOAD === 'true';

// FRT-072: Safety — block live reload in CI environments
const isCI = process.env.CI === 'true' || process.env.CODEMAGIC === 'true';
const enableLiveReload = isLiveReload && !isCI;

// Sanitize URL: keep only origin (no query params or paths that crash Android WebView)
const LIVE_RELOAD_URL = 'https://f2dbc201-5319-4f90-a3cc-8dd215bbebba.lovableproject.com';

const config: CapacitorConfig = {
  appId: 'app.lovable.f2dbc20153194f90a3cc8dd215bbebba',
  appName: 'AgriRoute',
  webDir: 'dist',

  // ✅ server block ONLY in dev mode — production uses local dist/ bundle
  // ⚠️ FRT-062: NEVER remove the env guard — causes splash-flash-close on Play Store
  ...(enableLiveReload ? {
    server: {
      url: LIVE_RELOAD_URL,
      cleartext: true
    }
  } : {}),

  plugins: {
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
    // ✅ FRT-071: allowMixedContent false in production for security
    allowMixedContent: enableLiveReload,
    // Debug only in dev mode — never in production/CI
    webContentsDebuggingEnabled: enableLiveReload,
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#FFFFFF',
    scheme: 'agriroute'
  }
};

export default config;

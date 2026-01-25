/**
 * ✅ RELEASE HARDENING: Centralized Environment Configuration
 * 
 * This file centralizes ALL environment variables for:
 * - Web Preview (Lovable sandbox)
 * - Web Production (agriroute-connect.com.br)
 * - Android/iOS (Capacitor)
 * 
 * NEVER use import.meta.env directly in components - use this module instead.
 */

// ✅ RELEASE HARDENING: Use Vite-injected build constants (fallback for dev)
declare const __APP_BUILD_ID__: string | undefined;
declare const __APP_BUILD_TIMESTAMP__: string | undefined;
declare const __APP_MODE__: string | undefined;

const BUILD_TIMESTAMP = typeof __APP_BUILD_TIMESTAMP__ !== 'undefined' 
  ? __APP_BUILD_TIMESTAMP__ 
  : new Date().toISOString();
  
const BUILD_ID = typeof __APP_BUILD_ID__ !== 'undefined' 
  ? __APP_BUILD_ID__ 
  : `dev-${Date.now()}`;

// ✅ Expose build ID globally for runtime checks
if (typeof window !== 'undefined') {
  (window as any).__APP_BUILD_ID = BUILD_ID;
  (window as any).__APP_BUILD_TIMESTAMP = BUILD_TIMESTAMP;
}

/**
 * Environment detection
 */
export const ENV = {
  // Current mode (development, production, test)
  MODE: import.meta.env.MODE || 'development',
  
  // Is this a production build?
  IS_PRODUCTION: import.meta.env.PROD === true,
  
  // Is this a development build?
  IS_DEVELOPMENT: import.meta.env.DEV === true,
  
  // Unique build identifier
  BUILD_ID,
  BUILD_TIMESTAMP,
} as const;

/**
 * Platform detection
 */
export const PLATFORM = {
  // Running inside Capacitor WebView (Android/iOS)?
  IS_CAPACITOR: typeof (window as any)?.Capacitor !== 'undefined',
  
  // Running on Android?
  IS_ANDROID: typeof (window as any)?.Capacitor?.getPlatform === 'function' 
    && (window as any).Capacitor.getPlatform() === 'android',
  
  // Running on iOS?
  IS_IOS: typeof (window as any)?.Capacitor?.getPlatform === 'function' 
    && (window as any).Capacitor.getPlatform() === 'ios',
  
  // Running in browser (not Capacitor)?
  IS_WEB: typeof (window as any)?.Capacitor === 'undefined',
  
  // Running in Lovable Preview sandbox?
  IS_LOVABLE_PREVIEW: typeof window !== 'undefined' && 
    window.location.hostname.includes('lovable'),
  
  // Get current platform name
  get NAME(): 'android' | 'ios' | 'web' {
    if (this.IS_ANDROID) return 'android';
    if (this.IS_IOS) return 'ios';
    return 'web';
  },
} as const;

/**
 * Supabase Configuration - HARDCODED for reliability
 * These values are public (anon key is designed to be public)
 */
export const SUPABASE = {
  URL: 'https://shnvtxejjecbnztdbbbl.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg',
  PROJECT_REF: 'shnvtxejjecbnztdbbbl',
} as const;

/**
 * Site URLs - Platform aware
 */
export const URLS = {
  // Production domain
  PRODUCTION: 'https://agriroute-connect.com.br',
  
  // Lovable preview
  PREVIEW: 'https://agriroute.lovable.app',
  
  // Current base URL (auto-detect)
  get BASE(): string {
    if (typeof window === 'undefined') return this.PRODUCTION;
    
    const hostname = window.location.hostname;
    
    // Lovable preview environments
    if (hostname.includes('lovable')) {
      return window.location.origin;
    }
    
    // Capacitor uses production URLs
    if (PLATFORM.IS_CAPACITOR) {
      return this.PRODUCTION;
    }
    
    // Production domain
    if (hostname === 'agriroute-connect.com.br' || hostname === 'www.agriroute-connect.com.br') {
      return this.PRODUCTION;
    }
    
    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return window.location.origin;
    }
    
    // Default to current origin
    return window.location.origin;
  },
  
  // Auth callback URL
  get AUTH_CALLBACK(): string {
    return `${this.BASE}/auth/callback`;
  },
  
  // Auth redirect URL after login
  get AUTH_REDIRECT(): string {
    return `${this.BASE}/auth`;
  },
} as const;

/**
 * API Configuration
 */
export const API = {
  // Supabase Edge Functions base URL
  get EDGE_FUNCTIONS(): string {
    return `${SUPABASE.URL}/functions/v1`;
  },
  
  // Storage base URL
  get STORAGE(): string {
    return `${SUPABASE.URL}/storage/v1`;
  },
} as const;

/**
 * Validate environment on load
 * Logs critical errors but NEVER blocks UI
 */
export function validateEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required Supabase config
  if (!SUPABASE.URL) {
    errors.push('SUPABASE_URL is missing');
  }
  if (!SUPABASE.ANON_KEY) {
    errors.push('SUPABASE_ANON_KEY is missing');
  }
  
  // Check build ID is set
  if (!BUILD_ID) {
    errors.push('BUILD_ID was not generated');
  }
  
  // Log errors but don't throw
  if (errors.length > 0) {
    console.error('[ENV] CRITICAL - Environment validation failed:', errors);
  } else {
    console.debug('[ENV] Environment validated:', {
      mode: ENV.MODE,
      platform: PLATFORM.NAME,
      buildId: BUILD_ID,
      baseUrl: URLS.BASE,
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get complete environment info for debugging
 */
export function getEnvironmentInfo() {
  return {
    env: {
      mode: ENV.MODE,
      isProduction: ENV.IS_PRODUCTION,
      isDevelopment: ENV.IS_DEVELOPMENT,
      buildId: ENV.BUILD_ID,
      buildTimestamp: ENV.BUILD_TIMESTAMP,
    },
    platform: {
      name: PLATFORM.NAME,
      isCapacitor: PLATFORM.IS_CAPACITOR,
      isAndroid: PLATFORM.IS_ANDROID,
      isIOS: PLATFORM.IS_IOS,
      isWeb: PLATFORM.IS_WEB,
      isLovablePreview: PLATFORM.IS_LOVABLE_PREVIEW,
    },
    urls: {
      base: URLS.BASE,
      authCallback: URLS.AUTH_CALLBACK,
      production: URLS.PRODUCTION,
      preview: URLS.PREVIEW,
    },
    supabase: {
      url: SUPABASE.URL,
      projectRef: SUPABASE.PROJECT_REF,
      // Don't expose full key in logs
      hasAnonKey: !!SUPABASE.ANON_KEY,
    },
    browser: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      language: typeof navigator !== 'undefined' ? navigator.language : 'N/A',
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    },
  };
}

// Auto-validate on import
if (typeof window !== 'undefined') {
  validateEnvironment();
}

export default {
  ENV,
  PLATFORM,
  SUPABASE,
  URLS,
  API,
  validateEnvironment,
  getEnvironmentInfo,
};

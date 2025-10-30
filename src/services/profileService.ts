/**
 * Profile Service - Reliable profile fetching with single-flight, cache, and cooldown
 * 
 * Features:
 * - Single-flight: Only one profile request in-flight at a time
 * - 10-minute cache to survive transient backend slowness
 * - 60-second cooldown after timeout/failure
 * - RPC kill-switch: env-controlled flag to disable RPC calls
 * - Automatic RPC backoff on PGRST202 (function not found) for 24 hours
 * - Robust table fallback with both profiles.id and profiles.user_id
 */

import { supabase } from '@/integrations/supabase/client';
import { singleFlight, withTimeout } from '@/utils/async';

const CACHE_KEY_PREFIX = 'profile_cache_v2_';
const COOLDOWN_KEY = 'profile_fetch_cooldown_until';
const RPC_BACKOFF_KEY = 'profileRpcDisabledUntil';
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const COOLDOWN_DURATION_MS = 60 * 1000; // 60 seconds
const FETCH_TIMEOUT_MS = 8000; // 8 seconds
const RPC_BACKOFF_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if RPC calls should be attempted
 * Returns false if:
 * - VITE_USE_PROFILE_RPC is explicitly set to "false"
 * - RPC is in backoff period (after PGRST202 error)
 */
function shouldUseRpc(): boolean {
  // Check env flag first
  const envFlag = import.meta.env.VITE_USE_PROFILE_RPC;
  if (envFlag === 'false' || envFlag === false) {
    if (import.meta.env.DEV) {
      console.log('[ProfileService] RPC disabled via env flag');
    }
    return false;
  }

  // Check backoff period
  try {
    const backoffUntil = parseInt(localStorage.getItem(RPC_BACKOFF_KEY) || '0', 10);
    if (backoffUntil > Date.now()) {
      const remainingHours = Math.ceil((backoffUntil - Date.now()) / (60 * 60 * 1000));
      if (import.meta.env.DEV) {
        console.log(`[ProfileService] RPC in backoff for ${remainingHours}h`);
      }
      return false;
    }
  } catch {
    // Ignore localStorage errors
  }

  return true;
}

/**
 * Set RPC backoff period (24 hours)
 */
function setRpcBackoff(): void {
  try {
    const backoffUntil = Date.now() + RPC_BACKOFF_DURATION_MS;
    localStorage.setItem(RPC_BACKOFF_KEY, String(backoffUntil));
    console.warn('[ProfileService] ⚠️ RPC backoff activated (24h) - using table fallback');
  } catch (error) {
    console.error('[ProfileService] Error setting RPC backoff:', error);
  }
}

interface CachedProfile {
  data: any;
  timestamp: number;
}

/**
 * Get cached profile if valid
 */
function getCachedProfile(userId: string): any | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${userId}`);
    if (!cached) return null;

    const parsed: CachedProfile = JSON.parse(cached);
    const age = Date.now() - parsed.timestamp;

    if (age < CACHE_DURATION_MS) {
      if (import.meta.env.DEV) {
        const ageMin = Math.floor(age / 60000);
        console.log(`[ProfileService] ✅ Cache hit (${ageMin}min old)`);
      }
      return parsed.data;
    }

    // Expired
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${userId}`);
    return null;
  } catch (error) {
    console.error('[ProfileService] Error reading cache:', error);
    return null;
  }
}

/**
 * Set cached profile
 */
function setCachedProfile(userId: string, profile: any): void {
  try {
    const cached: CachedProfile = {
      data: profile,
      timestamp: Date.now()
    };
    localStorage.setItem(`${CACHE_KEY_PREFIX}${userId}`, JSON.stringify(cached));
    if (import.meta.env.DEV) {
      console.log('[ProfileService] ✅ Profile cached');
    }
  } catch (error) {
    console.error('[ProfileService] Error saving cache:', error);
  }
}

/**
 * Check if we're in cooldown
 */
function isInCooldown(): boolean {
  try {
    const cooldownUntil = parseInt(localStorage.getItem(COOLDOWN_KEY) || '0', 10);
    if (cooldownUntil > Date.now()) {
      const remainingSec = Math.ceil((cooldownUntil - Date.now()) / 1000);
      if (import.meta.env.DEV) {
        console.log(`[ProfileService] ⏸️ Cooldown active for ${remainingSec}s`);
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Set cooldown
 */
function setCooldown(): void {
  try {
    const cooldownUntil = Date.now() + COOLDOWN_DURATION_MS;
    localStorage.setItem(COOLDOWN_KEY, String(cooldownUntil));
    if (import.meta.env.DEV) {
      console.log('[ProfileService] ⏱️ Cooldown activated (60s)');
    }
  } catch (error) {
    console.error('[ProfileService] Error setting cooldown:', error);
  }
}

/**
 * Fetch profile using RPC (if enabled) or table fallback
 */
async function fetchProfileOnce(userId: string): Promise<any[]> {
  const useRpc = shouldUseRpc();
  
  if (import.meta.env.DEV) {
    console.log(`[ProfileService] Fetching profile (RPC: ${useRpc ? 'enabled' : 'disabled'})`);
  }

  let profiles: any[] = [];
  let rpcError: any = null;

  // Try RPC first if enabled
  if (useRpc) {
    try {
      const fetchPromise = supabase.rpc('get_profile_me');
      const { data, error } = await withTimeout(
        fetchPromise,
        FETCH_TIMEOUT_MS,
        'fetchProfileRPC'
      );

      if (error) {
        rpcError = error;
        const errorCode = error?.code;
        const errorMessage = String(error?.message || '');

        // Check for PGRST202 (RPC function not found)
        if (errorCode === 'PGRST202' || errorMessage.includes('function') && errorMessage.includes('does not exist')) {
          console.warn('[ProfileService] ⚠️ RPC not found (PGRST202) - activating 24h backoff');
          setRpcBackoff();
          // Continue to table fallback
        } else {
          throw error;
        }
      } else if (data && data.length > 0) {
        profiles = data;
        if (import.meta.env.DEV) {
          console.log(`[ProfileService] ✅ RPC fetched ${profiles.length} profile(s)`);
        }
      }
    } catch (error) {
      rpcError = error;
      console.warn('[ProfileService] RPC failed, falling back to table:', error);
    }
  }

  // Table fallback if RPC disabled, failed, or returned no data
  if (profiles.length === 0) {
    if (import.meta.env.DEV) {
      console.log('[ProfileService] Using table fallback');
    }

    try {
      // Try with user_id first (standard column)
      let { data: profileData, error: profileError } = await withTimeout(
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId),
        FETCH_TIMEOUT_MS,
        'fetchProfileTable'
      );

      // If no results with user_id, try with id column
      if ((!profileData || profileData.length === 0) && !profileError) {
        const fallbackResult = await withTimeout(
          supabase
            .from('profiles')
            .select('*')
            .eq('id', userId),
          FETCH_TIMEOUT_MS,
          'fetchProfileTableById'
        );
        profileData = fallbackResult.data;
        profileError = fallbackResult.error;
      }

      if (profileError) {
        throw profileError;
      }

      profiles = profileData || [];
      
      if (import.meta.env.DEV) {
        console.log(`[ProfileService] ✅ Table fetched ${profiles.length} profile(s)`);
      }
    } catch (error) {
      // If table also fails and we had an RPC error, throw the RPC error for consistency
      if (rpcError) {
        throw rpcError;
      }
      throw error;
    }
  }

  // Fetch roles for each profile
  if (profiles.length > 0) {
    const profilesWithRoles = await Promise.all(
      profiles.map(async (p: any) => {
        try {
          const rolesPromise = supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', p.user_id);

          const { data: rolesData, error: rolesError } = await withTimeout(
            rolesPromise,
            5000,
            'fetchUserRoles'
          );

          if (rolesError) throw rolesError;

          return {
            ...p,
            roles: rolesData?.map((r: any) => r.role) || []
          };
        } catch (error) {
          // Fallback: continue with empty roles
          console.warn(`[ProfileService] Failed to fetch roles for ${p.user_id}:`, error);
          return {
            ...p,
            roles: []
          };
        }
      })
    );

    return profilesWithRoles;
  }

  return profiles;
}

export interface GetProfileOptions {
  /**
   * If true, prefer cached profile over fetching new one
   * Default: true
   */
  preferCache?: boolean;

  /**
   * If true, bypass cooldown and fetch immediately
   * Default: false
   */
  force?: boolean;
}

/**
 * Get profile reliably with single-flight, cache, and cooldown
 */
export async function getProfileReliable(
  userId: string,
  options: GetProfileOptions = {}
): Promise<any[]> {
  const { preferCache = true, force = false } = options;

  // 1. Check cache first
  if (preferCache && !force) {
    const cached = getCachedProfile(userId);
    if (cached) {
      return Array.isArray(cached) ? cached : [cached];
    }
  }

  // 2. Check cooldown (unless forced)
  if (!force && isInCooldown()) {
    // If in cooldown and no cache, return empty (caller should handle)
    return [];
  }

  // 3. Fetch with single-flight
  try {
    const profiles = await singleFlight(
      `profile:${userId}`,
      () => fetchProfileOnce(userId)
    );

    // 4. Update cache on success
    if (profiles && profiles.length > 0) {
      setCachedProfile(userId, profiles);
    }

    return profiles;
  } catch (error: any) {
    const errorMessage = String(error?.message ?? '');
    const errorCode = error?.code;
    const isTimeout = error?.isTimeout === true || 
                      errorMessage.includes('Timeout') || 
                      errorMessage.includes('exceeded');

    // Improve error logging
    if (isTimeout) {
      console.warn('[ProfileService] ⏱️ Timeout - cooldown activated');
      setCooldown();
    } else if (errorCode === 'PGRST202') {
      console.warn('[ProfileService] ⚠️ RPC not found - already in backoff');
    } else {
      console.error('[ProfileService] Fetch error:', {
        code: errorCode,
        message: errorMessage,
        isTimeout,
      });
    }

    // Re-throw to let caller handle
    throw error;
  }
}

/**
 * Clear all profile caches and cooldowns (useful for logout)
 */
export function clearProfileCache(): void {
  try {
    // Clear all profile caches
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    
    // Clear cooldown
    localStorage.removeItem(COOLDOWN_KEY);
    
    // Clear RPC backoff
    localStorage.removeItem(RPC_BACKOFF_KEY);
    
    if (import.meta.env.DEV) {
      console.log('[ProfileService] Cache cleared');
    }
  } catch (error) {
    console.error('[ProfileService] Error clearing cache:', error);
  }
}

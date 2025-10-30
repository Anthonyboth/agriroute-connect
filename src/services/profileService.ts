/**
 * Profile Service - Reliable profile fetching with single-flight, cache, and cooldown
 * 
 * Features:
 * - Single-flight: Only one profile request in-flight at a time
 * - 10-minute cache to survive transient backend slowness
 * - 60-second cooldown after timeout/failure
 * - Fast RPC using SECURITY DEFINER to bypass RLS overhead
 */

import { supabase } from '@/integrations/supabase/client';
import { singleFlight, withTimeout } from '@/utils/async';

const CACHE_KEY_PREFIX = 'profile_cache_v2_';
const COOLDOWN_KEY = 'profile_fetch_cooldown_until';
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const COOLDOWN_DURATION_MS = 60 * 1000; // 60 seconds
const FETCH_TIMEOUT_MS = 8000; // 8 seconds

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
 * Fetch profile using the fast RPC (bypasses RLS)
 */
async function fetchProfileOnce(userId: string): Promise<any[]> {
  if (import.meta.env.DEV) {
    console.log('[ProfileService] Fetching profile via RPC...');
  }

  // Use the new RPC function which is much faster (SECURITY DEFINER)
  const fetchPromise = supabase.rpc('get_profile_me');
  
  const { data, error } = await withTimeout(
    fetchPromise,
    FETCH_TIMEOUT_MS,
    'fetchProfile'
  );

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    if (import.meta.env.DEV) {
      console.log('[ProfileService] No profile found');
    }
    return [];
  }

  // Fetch roles for each profile
  const profilesWithRoles = await Promise.all(
    data.map(async (p: any) => {
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

  if (import.meta.env.DEV) {
    console.log(`[ProfileService] ✅ Fetched ${profilesWithRoles.length} profile(s)`);
  }

  return profilesWithRoles;
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
    const isTimeout = error?.isTimeout === true || 
                      errorMessage.includes('Timeout') || 
                      errorMessage.includes('exceeded');

    // 5. Set cooldown on timeout/failure
    if (isTimeout) {
      setCooldown();
      console.warn('[ProfileService] ⏱️ Timeout - cooldown activated');
    } else {
      console.error('[ProfileService] Fetch error:', error);
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
    
    if (import.meta.env.DEV) {
      console.log('[ProfileService] Cache cleared');
    }
  } catch (error) {
    console.error('[ProfileService] Error clearing cache:', error);
  }
}

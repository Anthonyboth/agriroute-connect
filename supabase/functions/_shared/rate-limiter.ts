/**
 * Rate Limiter Module for Supabase Edge Functions
 * 
 * Provides centralized rate limiting with:
 * - User-based and IP-based limiting
 * - Progressive blocking (5min -> 15min -> 1hr)
 * - Audit logging for violations
 * - Configurable limits per endpoint
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  current: number;
  limit: number;
  reset_at: string;
  blocked: boolean;
  message?: string;
}

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  burstLimit: number;
  blockDurationMinutes: number;
}

// Default rate limit configurations per endpoint type
const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  'accept-freight': { maxRequestsPerMinute: 30, maxRequestsPerHour: 300, burstLimit: 5, blockDurationMinutes: 5 },
  'send-proposal': { maxRequestsPerMinute: 20, maxRequestsPerHour: 200, burstLimit: 3, blockDurationMinutes: 5 },
  'create-checkout': { maxRequestsPerMinute: 10, maxRequestsPerHour: 50, burstLimit: 2, blockDurationMinutes: 10 },
  'driver-proposals': { maxRequestsPerMinute: 60, maxRequestsPerHour: 600, burstLimit: 10, blockDurationMinutes: 5 },
  'notify-new-freight': { maxRequestsPerMinute: 30, maxRequestsPerHour: 300, burstLimit: 5, blockDurationMinutes: 5 },
  'fiscalizacao-consulta': { maxRequestsPerMinute: 100, maxRequestsPerHour: 1000, burstLimit: 20, blockDurationMinutes: 5 },
  'default': { maxRequestsPerMinute: 60, maxRequestsPerHour: 600, burstLimit: 10, blockDurationMinutes: 5 },
};

/**
 * Extract client IP from request headers
 */
export function getClientIP(req: Request): string {
  // Try various headers that might contain the real client IP
  const headers = [
    'x-real-ip',
    'x-forwarded-for',
    'cf-connecting-ip',
    'x-client-ip',
    'true-client-ip',
  ];

  for (const header of headers) {
    const value = req.headers.get(header);
    if (value) {
      // x-forwarded-for may contain multiple IPs, get the first one
      const ip = value.split(',')[0].trim();
      if (ip && isValidIP(ip)) {
        return ip;
      }
    }
  }

  return '0.0.0.0'; // Fallback if no IP found
}

/**
 * Basic IP validation
 */
function isValidIP(ip: string): boolean {
  // IPv4 regex
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 simplified regex
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Get rate limit configuration for an endpoint
 */
export function getEndpointConfig(endpoint: string): RateLimitConfig {
  return DEFAULT_CONFIGS[endpoint] || DEFAULT_CONFIGS['default'];
}

/**
 * Check rate limit using database RPC
 * This is the recommended approach for production use
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string | null,
  ipAddress: string,
  endpoint: string,
  config?: Partial<RateLimitConfig>
): Promise<RateLimitResult> {
  const endpointConfig = { ...getEndpointConfig(endpoint), ...config };
  
  try {
    const { data, error } = await supabase.rpc('edge_function_rate_check', {
      p_user_id: userId,
      p_ip_address: ipAddress,
      p_endpoint: endpoint,
      p_max_requests: endpointConfig.maxRequestsPerMinute,
      p_window_minutes: 1
    });

    if (error) {
      console.error(`[RATE-LIMITER] RPC error for ${endpoint}:`, error.message);
      // On error, allow request but log warning
      return {
        allowed: true,
        remaining: endpointConfig.maxRequestsPerMinute,
        current: 0,
        limit: endpointConfig.maxRequestsPerMinute,
        reset_at: new Date(Date.now() + 60000).toISOString(),
        blocked: false,
        message: 'Rate limit check failed, allowing request'
      };
    }

    return data as RateLimitResult;
  } catch (err) {
    console.error(`[RATE-LIMITER] Exception for ${endpoint}:`, err);
    // On exception, allow request but log
    return {
      allowed: true,
      remaining: endpointConfig.maxRequestsPerMinute,
      current: 0,
      limit: endpointConfig.maxRequestsPerMinute,
      reset_at: new Date(Date.now() + 60000).toISOString(),
      blocked: false,
      message: 'Rate limit check exception, allowing request'
    };
  }
}

/**
 * Create rate limit exceeded response with proper headers
 */
export function createRateLimitResponse(result: RateLimitResult, corsHeaders: Record<string, string>): Response {
  const retryAfter = result.reset_at 
    ? Math.ceil((new Date(result.reset_at).getTime() - Date.now()) / 1000)
    : 60;

  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: result.message || 'Too many requests. Please try again later.',
      retry_after_seconds: retryAfter,
      blocked: result.blocked,
      reset_at: result.reset_at
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': result.reset_at || ''
      }
    }
  );
}

/**
 * Add rate limit headers to successful response
 */
export function addRateLimitHeaders(
  response: Response, 
  result: RateLimitResult
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', String(result.limit));
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', result.reset_at || '');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * In-memory rate limiter for fallback (when DB is unavailable)
 * Note: This doesn't persist across edge function instances
 */
const memoryStore = new Map<string, { count: number; resetAt: number }>();

export function checkInMemoryRateLimit(
  identifier: string,
  maxRequests: number = 60,
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  const key = identifier;
  const record = memoryStore.get(key);

  // Clean up old entries periodically
  if (memoryStore.size > 10000) {
    for (const [k, v] of memoryStore.entries()) {
      if (v.resetAt < now) {
        memoryStore.delete(k);
      }
    }
  }

  if (!record || record.resetAt < now) {
    // New window
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      current: 1,
      limit: maxRequests,
      reset_at: new Date(now + windowMs).toISOString(),
      blocked: false
    };
  }

  // Existing window
  record.count++;
  memoryStore.set(key, record);

  const allowed = record.count <= maxRequests;
  return {
    allowed,
    remaining: Math.max(0, maxRequests - record.count),
    current: record.count,
    limit: maxRequests,
    reset_at: new Date(record.resetAt).toISOString(),
    blocked: !allowed
  };
}

/**
 * Rate limiter middleware wrapper for edge functions
 * Usage:
 * 
 * const rateLimitResult = await withRateLimit(req, supabase, 'my-endpoint');
 * if (!rateLimitResult.allowed) {
 *   return createRateLimitResponse(rateLimitResult, corsHeaders);
 * }
 */
export async function withRateLimit(
  req: Request,
  supabase: SupabaseClient,
  endpoint: string,
  userId?: string | null,
  config?: Partial<RateLimitConfig>
): Promise<RateLimitResult> {
  const ipAddress = getClientIP(req);
  
  // Try database rate limit first
  const result = await checkRateLimit(supabase, userId || null, ipAddress, endpoint, config);
  
  // Log if rate limited
  if (!result.allowed) {
    console.warn(`[RATE-LIMITER] Rate limited: endpoint=${endpoint}, user=${userId || 'anonymous'}, ip=${ipAddress}, current=${result.current}/${result.limit}`);
  }

  return result;
}

/**
 * Log security event for rate limit violations
 */
export async function logRateLimitViolation(
  supabase: SupabaseClient,
  endpoint: string,
  userId: string | null,
  ipAddress: string,
  requestCount: number,
  limit: number
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      table_name: 'api_rate_limits',
      operation: 'RATE_LIMIT_VIOLATION',
      user_id: userId,
      ip_address: ipAddress,
      new_data: {
        endpoint,
        request_count: requestCount,
        limit,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[RATE-LIMITER] Failed to log violation:', err);
  }
}

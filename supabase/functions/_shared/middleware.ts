import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

// CORS headers
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Extract user from JWT token
 */
export async function extractUser(req: Request, supabaseUrl: string, anonKey: string) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * Get client identifier (IP or user ID) for rate limiting
 */
export function getClientIdentifier(req: Request, userId?: string): string {
  if (userId) return `user:${userId}`;
  
  // Try to get IP from various headers
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0].trim();
    return `ip:${ip}`;
  }
  
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return `ip:${realIp}`;
  }
  
  // Fallback to a generic identifier
  return 'ip:unknown';
}

/**
 * Check rate limit using Supabase RPC
 */
export async function checkRateLimit(
  supabase: any,
  identifier: string,
  endpoint: string,
  maxRequests: number = 100,
  windowMinutes: number = 15
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_endpoint: endpoint,
      p_max_requests: maxRequests,
      p_window_minutes: windowMinutes,
    });

    if (error) {
      console.error('[RateLimit] Error checking rate limit:', error);
      // On error, allow the request (fail open for availability)
      return true;
    }

    return data === true;
  } catch (error) {
    console.error('[RateLimit] Exception checking rate limit:', error);
    // On exception, allow the request
    return true;
  }
}

/**
 * JSON response helper
 */
export function json(data: any, status: number = 200, headers: Record<string, string> = {}) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
        ...headers,
      },
    }
  );
}

/**
 * Error response helper
 */
export function errorResponse(message: string, status: number = 400, details?: any) {
  return json(
    {
      error: message,
      ...(details ? { details } : {}),
    },
    status
  );
}

/**
 * Auth middleware options
 */
export interface AuthMiddlewareOptions {
  requireAuth?: boolean;
  rateLimitMaxRequests?: number;
  rateLimitWindowMinutes?: number;
  maxBodySize?: number; // in bytes
}

/**
 * High-level auth middleware wrapper
 * 
 * Usage:
 * ```
 * export default withAuth(async (req, user, supabase) => {
 *   // Your handler code
 *   return json({ success: true });
 * }, { requireAuth: true });
 * ```
 */
export function withAuth(
  handler: (req: Request, user: any | null, supabase: any) => Promise<Response>,
  options: AuthMiddlewareOptions = {}
) {
  const {
    requireAuth = false,
    rateLimitMaxRequests = 100,
    rateLimitWindowMinutes = 15,
    maxBodySize = 1024 * 1024, // 1MB default
  } = options;

  return async (req: Request): Promise<Response> => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      // Create Supabase client with service role for rate limit checks
      const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

      // Extract user
      const user = await extractUser(req, supabaseUrl, supabaseAnonKey);

      // Check authentication requirement
      if (requireAuth && !user) {
        return errorResponse('Authentication required', 401);
      }

      // Check rate limit
      const clientId = getClientIdentifier(req, user?.id);
      const endpoint = new URL(req.url).pathname;
      
      const rateLimitOk = await checkRateLimit(
        supabaseService,
        clientId,
        endpoint,
        rateLimitMaxRequests,
        rateLimitWindowMinutes
      );

      if (!rateLimitOk) {
        return errorResponse('Rate limit exceeded. Please try again later.', 429);
      }

      // Check body size if applicable
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const contentLength = req.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > maxBodySize) {
          return errorResponse('Request body too large', 413);
        }
      }

      // Create user-scoped Supabase client
      const authHeader = req.headers.get('Authorization');
      const supabase = createClient(
        supabaseUrl,
        supabaseAnonKey,
        authHeader ? {
          global: { headers: { Authorization: authHeader } },
        } : undefined
      );

      // Call the handler
      return await handler(req, user, supabase);

    } catch (error: any) {
      console.error('[Middleware] Unhandled error:', error);
      return errorResponse(
        'Internal server error',
        500,
        import.meta.env?.DEV ? { message: error.message, stack: error.stack } : undefined
      );
    }
  };
}

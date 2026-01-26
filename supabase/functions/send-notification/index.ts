import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { validateInput, uuidSchema, textSchema } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NotificationSchema = z.object({
  user_id: uuidSchema,
  title: textSchema(200).min(1, 'Title cannot be empty'),
  message: textSchema(1000).min(1, 'Message cannot be empty'),
  type: z.string().optional().default('info'),
  data: z.record(z.any()).optional()
});

// Rate limiting: track requests per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute

const checkRateLimit = (ip: string): boolean => {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  entry.count++;
  return true;
};

const log = (level: string, message: string, data?: any) => {
  // Sanitize data to avoid leaking sensitive info
  const sanitizedData = data ? JSON.stringify(data).substring(0, 500) : '';
  console.log(`[${level}] ${message}`, sanitizedData);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log('INFO', 'Starting notification send process');

    // ============================================
    // SECURITY FIX: Require authentication
    // ============================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      log('WARN', 'Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting by IP
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    if (!checkRateLimit(clientIP)) {
      log('WARN', 'Rate limit exceeded', { ip: clientIP });
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please wait before trying again.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with user's token to validate identity
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // First, validate the caller's identity using their JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
    
    if (claimsError || !claims?.claims?.sub) {
      log('WARN', 'Invalid or expired token');
      return new Response(
        JSON.stringify({ error: 'Invalid or expired authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const callerId = claims.claims.sub;
    log('INFO', 'Authenticated caller', { callerId: callerId.substring(0, 8) + '...' });
    
    // ============================================
    // SECURITY FIX: Authorization check
    // Only allow users to send notifications to themselves OR admins to send to anyone
    // ============================================
    const body = await req.json();
    const validated = validateInput(NotificationSchema, body);
    const { user_id, title, message, type, data } = validated;
    
    // Use service role to check admin status (requires service_role to bypass RLS on user_roles)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if caller is admin
    const { data: adminCheck } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .eq('role', 'admin')
      .maybeSingle();
    
    const isAdmin = !!adminCheck;
    
    // Check if caller is the target user or has admin role
    if (user_id !== callerId && !isAdmin) {
      log('WARN', 'Unauthorized notification attempt', { 
        callerId: callerId.substring(0, 8) + '...', 
        targetId: user_id.substring(0, 8) + '...' 
      });
      return new Response(
        JSON.stringify({ error: 'You can only send notifications to yourself' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // ============================================
    // SECURITY FIX: Validate target user exists
    // ============================================
    const { data: targetUser, error: targetError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', user_id)
      .maybeSingle();
    
    if (targetError || !targetUser) {
      log('WARN', 'Target user not found', { targetId: user_id.substring(0, 8) + '...' });
      return new Response(
        JSON.stringify({ error: 'Target user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log('INFO', 'Creating notification', { 
      targetId: user_id.substring(0, 8) + '...', 
      type,
      isAdmin 
    });

    // Insert notification into database using service role
    const { data: notification, error } = await adminClient
      .from('notifications')
      .insert({
        user_id,
        title,
        message,
        type,
        data,
        read: false
      })
      .select('id, created_at')
      .single();

    if (error) {
      log('ERROR', 'Database error when creating notification');
      return new Response(
        JSON.stringify({ error: 'Failed to create notification' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log('INFO', 'Notification created successfully', { notificationId: notification.id });

    return new Response(
      JSON.stringify({ 
        success: true, 
        notification: {
          id: notification.id,
          created_at: notification.created_at
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    log('ERROR', 'Unexpected error in notification send');
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

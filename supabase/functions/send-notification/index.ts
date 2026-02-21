import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { validateInput, uuidSchema, textSchema } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    // SECURITY: Require authentication
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

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Validate the caller's identity using their JWT
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
    // Parse and validate input
    // ============================================
    const body = await req.json();
    const validated = validateInput(NotificationSchema, body);
    const { user_id, title, message, type, data } = validated;
    
    // Service role client for admin checks and DB operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // ============================================
    // AUTHORIZATION: Check if caller can send to target
    // Allowed cases:
    // 1. Sending to yourself
    // 2. Caller is admin (profiles.role = 'ADMIN')
    // 3. Caller and target share a freight relationship
    // 4. Caller and target share a company relationship
    // 5. Caller and target share a service_request relationship
    // ============================================
    let isAuthorized = false;
    
    // Case 1: Sending to yourself - always allowed
    if (user_id === callerId) {
      isAuthorized = true;
      log('INFO', 'Self-notification authorized');
    }
    
    if (!isAuthorized) {
      // Resolve caller's profile_id (auth.uid -> profiles.id)
      const { data: callerProfile } = await adminClient
        .from('profiles')
        .select('id, role')
        .eq('user_id', callerId)
        .maybeSingle();
      
      const callerProfileId = callerProfile?.id;
      const callerRole = callerProfile?.role;
      
      // Case 2: Admin check using profiles.role (not deprecated user_roles table)
      if (callerRole === 'ADMIN') {
        isAuthorized = true;
        log('INFO', 'Admin notification authorized');
      }
      
      // Case 3: Freight relationship check
      if (!isAuthorized && data?.freight_id) {
        const freightId = data.freight_id;
        
        // Check if caller is producer of this freight
        const { data: freight } = await adminClient
          .from('freights')
          .select('id, producer_id')
          .eq('id', freightId)
          .maybeSingle();
        
        if (freight) {
          const isCallerProducer = freight.producer_id === callerProfileId;
          
          // Check if target is assigned driver on this freight
          const { data: targetAssignment } = await adminClient
            .from('freight_assignments')
            .select('id, driver_id')
            .eq('freight_id', freightId)
            .eq('driver_id', user_id)
            .maybeSingle();
          
          // Check if caller is assigned driver on this freight
          const { data: callerAssignment } = await adminClient
            .from('freight_assignments')
            .select('id, driver_id')
            .eq('freight_id', freightId)
            .eq('driver_id', callerProfileId)
            .maybeSingle();
          
          const isTargetProducer = freight.producer_id === user_id;
          
          // Allow if both are participants of the same freight
          if ((isCallerProducer && targetAssignment) || 
              (callerAssignment && isTargetProducer)) {
            isAuthorized = true;
            log('INFO', 'Freight relationship authorized', { freightId: freightId.substring(0, 8) + '...' });
          }
        }
      }
      
      // Case 4: Company relationship (company owner notifying affiliated driver or vice-versa)
      if (!isAuthorized && callerProfileId) {
        const { data: companyRelation } = await adminClient
          .from('company_drivers')
          .select('id, company_id, driver_profile_id')
          .or(`driver_profile_id.eq.${callerProfileId},driver_profile_id.eq.${user_id}`)
          .in('status', ['ACTIVE', 'active'])
          .limit(10);
        
        if (companyRelation && companyRelation.length > 0) {
          // Check if both caller and target are in the same company
          const callerCompanies = companyRelation
            .filter(r => r.driver_profile_id === callerProfileId)
            .map(r => r.company_id);
          const targetInSameCompany = companyRelation
            .some(r => r.driver_profile_id === user_id && callerCompanies.includes(r.company_id));
          
          // Also check if caller owns a company that target is in
          const { data: callerCompany } = await adminClient
            .from('transport_companies')
            .select('id')
            .eq('owner_profile_id', callerProfileId)
            .maybeSingle();
          
          if (callerCompany) {
            const targetInCallerCompany = companyRelation
              .some(r => r.driver_profile_id === user_id && r.company_id === callerCompany.id);
            if (targetInCallerCompany) {
              isAuthorized = true;
              log('INFO', 'Company owner-to-driver notification authorized');
            }
          }
          
          if (!isAuthorized && targetInSameCompany) {
            isAuthorized = true;
            log('INFO', 'Same-company notification authorized');
          }
        }
      }
      
      // Case 5: Service request relationship
      if (!isAuthorized && data?.service_request_id) {
        const { data: serviceReq } = await adminClient
          .from('service_requests')
          .select('id, client_id, provider_id')
          .eq('id', data.service_request_id)
          .maybeSingle();
        
        if (serviceReq) {
          const isCallerParticipant = serviceReq.client_id === callerProfileId || serviceReq.provider_id === callerProfileId;
          const isTargetParticipant = serviceReq.client_id === user_id || serviceReq.provider_id === user_id;
          
          if (isCallerParticipant && isTargetParticipant) {
            isAuthorized = true;
            log('INFO', 'Service request relationship authorized');
          }
        }
      }
    }
    
    if (!isAuthorized) {
      log('WARN', 'Unauthorized notification attempt', { 
        callerId: callerId.substring(0, 8) + '...', 
        targetId: user_id.substring(0, 8) + '...' 
      });
      return new Response(
        JSON.stringify({ error: 'You are not authorized to send notifications to this user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // ============================================
    // Validate target user exists
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
      type
    });

    // Insert notification using service role
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
      log('ERROR', 'Database error when creating notification', { error: error.message });
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
    log('ERROR', 'Unexpected error in notification send', { msg: error?.message });
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
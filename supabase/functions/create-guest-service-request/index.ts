import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5; // Max 5 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         req.headers.get('x-real-ip') || 
         'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  // Clean up old entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetTime - now) / 1000) };
  }
  
  entry.count++;
  return { allowed: true };
}

// Schema validation
const GuestServiceRequestSchema = z.object({
  prospect_user_id: z.string().optional().nullable(),
  client_id: z.string().optional().nullable(),
  service_type: z.string().min(1, 'Tipo de serviço é obrigatório'),
  contact_name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  contact_phone: z.string().min(10, 'Telefone inválido'),
  contact_email: z.string().email().optional().nullable().transform(val => val === '' ? null : val),
  contact_document: z.string().optional().nullable().transform(val => val === '' ? null : val),
  location_address: z.string().min(5, 'Endereço muito curto'),
  location_lat: z.number().optional().nullable(),
  location_lng: z.number().optional().nullable(),
  problem_description: z.string().optional().nullable(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  city_name: z.string().min(2, 'Cidade é obrigatória'),
  city_id: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  preferred_datetime: z.string().optional().nullable(),
  additional_info: z.any().optional().nullable()
});

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check
  const clientIP = getClientIP(req);
  const rateLimitResult = checkRateLimit(clientIP);
  
  if (!rateLimitResult.allowed) {
    console.warn(`[CREATE-GUEST-SERVICE-REQUEST] Rate limit exceeded for IP: ${clientIP}`);
    return new Response(
      JSON.stringify({ 
        error: 'Muitas solicitações. Tente novamente em breve.',
        retryAfter: rateLimitResult.retryAfter 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimitResult.retryAfter)
        }, 
        status: 429 
      }
    );
  }

  try {
    const body = await req.json();
    
    console.log('[CREATE-GUEST-SERVICE-REQUEST] Received request from IP:', clientIP);
    
    // Validar dados de entrada
    const validationResult = GuestServiceRequestSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('[CREATE-GUEST-SERVICE-REQUEST] Validation errors:', validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Dados inválidos', 
          details: validationResult.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const data = validationResult.data;
    
    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Inserir a solicitação de serviço
    const { data: serviceRequest, error: insertError } = await supabaseAdmin
      .from('service_requests')
      .insert([{
        client_id: data.client_id || null,
        prospect_user_id: data.prospect_user_id === 'guest_user' ? null : data.prospect_user_id,
        service_type: data.service_type,
        contact_name: data.contact_name,
        contact_phone: data.contact_phone,
        contact_email: data.contact_email,
        contact_document: data.contact_document,
        location_address: data.location_address,
        location_lat: data.location_lat,
        location_lng: data.location_lng,
        problem_description: data.problem_description || 'Solicitação de serviço',
        urgency: data.urgency,
        status: 'OPEN',
        city_name: data.city_name,
        city_id: data.city_id,
        state: data.state,
        preferred_datetime: data.preferred_datetime,
        additional_info: data.additional_info ? JSON.stringify(data.additional_info) : null
      }])
      .select()
      .single();

    if (insertError) {
      console.error('[CREATE-GUEST-SERVICE-REQUEST] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar solicitação', details: insertError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('[CREATE-GUEST-SERVICE-REQUEST] Service request created:', serviceRequest.id);

    // Executar matching espacial automaticamente
    let matchingResult = null;
    if (serviceRequest?.id) {
      try {
        const matchingResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/service-provider-spatial-matching`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
            },
            body: JSON.stringify({
              service_request_id: serviceRequest.id,
              request_lat: data.location_lat,
              request_lng: data.location_lng,
              service_type: data.service_type,
              city_name: data.city_name,
              state: data.state,
              notify_providers: true
            })
          }
        );

        if (matchingResponse.ok) {
          matchingResult = await matchingResponse.json();
          console.log('[CREATE-GUEST-SERVICE-REQUEST] Matching executed:', matchingResult);
        } else {
          const errorText = await matchingResponse.text();
          console.error('[CREATE-GUEST-SERVICE-REQUEST] Matching error:', errorText);
        }
      } catch (matchError) {
        console.error('[CREATE-GUEST-SERVICE-REQUEST] Matching exception:', matchError);
        // Não falhar a request principal por erro no matching
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        id: serviceRequest.id,
        service_request_id: serviceRequest.id,
        matching: matchingResult,
        message: 'Solicitação criada com sucesso!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[CREATE-GUEST-SERVICE-REQUEST] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

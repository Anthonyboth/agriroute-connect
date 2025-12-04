import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Schema de validação
const GuestServiceRequestSchema = z.object({
  prospect_user_id: z.string().optional().nullable(),
  service_type: z.enum(['GUINCHO', 'FRETE_MOTO', 'FRETE_URBANO', 'MUDANCA_RESIDENCIAL', 'MUDANCA_COMERCIAL', 'FRETE_VAN']),
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
  state: z.string().optional().nullable(),
  additional_info: z.any().optional().nullable()
});

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Validar dados de entrada
    const validationResult = GuestServiceRequestSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('Validation errors:', validationResult.error.errors);
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
    
    // Criar cliente Supabase com service_role para bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Inserir a solicitação de serviço
    const { data: serviceRequest, error: insertError } = await supabaseAdmin
      .from('service_requests')
      .insert([{
        client_id: null, // Guest user - sem client_id
        prospect_user_id: data.prospect_user_id === 'guest_user' ? null : data.prospect_user_id,
        service_type: data.service_type,
        contact_name: data.contact_name,
        contact_phone: data.contact_phone,
        contact_email: data.contact_email,
        contact_document: data.contact_document,
        location_address: data.location_address,
        location_lat: data.location_lat,
        location_lng: data.location_lng,
        problem_description: data.problem_description,
        urgency: data.urgency,
        status: 'OPEN',
        city_name: data.city_name,
        state: data.state,
        additional_info: data.additional_info ? JSON.stringify(data.additional_info) : null
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar solicitação', details: insertError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Service request created:', serviceRequest.id);

    // Executar matching espacial automaticamente
    let matchingResult = null;
    if (serviceRequest?.id && data.location_lat && data.location_lng) {
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
              notify_providers: true
            })
          }
        );

        if (matchingResponse.ok) {
          matchingResult = await matchingResponse.json();
          console.log('Matching executed:', matchingResult);
        } else {
          console.error('Matching error:', await matchingResponse.text());
        }
      } catch (matchError) {
        console.error('Matching exception:', matchError);
        // Não falhar a request principal por erro no matching
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        service_request_id: serviceRequest.id,
        matching: matchingResult,
        message: 'Solicitação criada com sucesso!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

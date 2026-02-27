import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Schema de validação de entrada - aceita datas em formatos flexíveis
const UpdateFreightSchema = z.object({
  freight_id: z.string().uuid('ID de frete inválido'),
  updates: z.object({
    pickup_date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Data de coleta inválida' }).optional(),
    delivery_date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Data de entrega inválida' }).optional(),
    status: z.enum(['OPEN', 'ACCEPTED', 'LOADING', 'IN_TRANSIT', 'DELIVERED']).optional(),
    notes: z.string().max(1000).optional(),
    price: z.number().min(0).max(10000000).optional(),
    price_per_km: z.number().min(0).max(10000000).nullable().optional(),
    pricing_type: z.enum(['FIXED', 'PER_KM', 'PER_TON']).optional(),
    cargo_type: z.string().max(100).optional(),
    weight: z.number().min(0).max(1000000000).optional(),
    origin_address: z.string().max(500).optional(),
    origin_lat: z.number().nullable().optional(),
    origin_lng: z.number().nullable().optional(),
    destination_address: z.string().max(500).optional(),
    destination_lat: z.number().nullable().optional(),
    destination_lng: z.number().nullable().optional(),
    urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    required_trucks: z.number().int().min(1).max(100).optional(),
    minimum_antt_price: z.number().min(0).nullable().optional(),
    description: z.string().max(2000).optional(),
  }).refine(obj => Object.keys(obj).length > 0, {
    message: 'Pelo menos um campo de atualização é obrigatório'
  })
});

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [SAFE-UPDATE-FREIGHT] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Validar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logStep('Erro: Authorization header ausente');
      return new Response(
        JSON.stringify({ error: 'Não autorizado', code: 'AUTH_REQUIRED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      logStep('Erro: Autenticação falhou', { error: userError?.message });
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado', code: 'INVALID_TOKEN' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar entrada com Zod
    let requestBody;
    try {
      const rawBody = await req.json();
      requestBody = UpdateFreightSchema.parse(rawBody);
    } catch (zodError) {
      if (zodError instanceof z.ZodError) {
        logStep('Erro de validação', { errors: zodError.errors });
        return new Response(
          JSON.stringify({ 
            error: 'Dados de entrada inválidos',
            code: 'VALIDATION_ERROR',
            details: zodError.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw zodError;
    }

    const { freight_id, updates } = requestBody;
    logStep('Requisição validada', { freight_id, userId: user.id });

    // Buscar perfil do usuário
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      logStep('Erro: Perfil não encontrado', { userId: user.id });
      return new Response(
        JSON.stringify({ error: 'Perfil não encontrado', code: 'PROFILE_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar frete com verificação de autorização
    const { data: freight, error: fetchError } = await supabaseAdmin
      .from('freights')
      .select('id, pickup_date, producer_id, driver_id, status')
      .eq('id', freight_id)
      .single();

    if (fetchError || !freight) {
      logStep('Erro: Frete não encontrado', { freight_id });
      return new Response(
        JSON.stringify({ error: 'Frete não encontrado', code: 'FREIGHT_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ CRÍTICO: Verificar autorização - usuário deve ser producer_id ou driver_id
    const isProducer = freight.producer_id === profile.id;
    const isDriver = freight.driver_id === profile.id;
    
    // Verificar se é admin via user_roles
    const { data: adminRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'moderator'])
      .maybeSingle();
    
    const isAdmin = !!adminRole;

    if (!isProducer && !isDriver && !isAdmin) {
      logStep('Erro: Acesso negado - usuário não autorizado', { 
        profileId: profile.id, 
        producerId: freight.producer_id, 
        driverId: freight.driver_id,
        isAdmin 
      });
      
      // Registrar tentativa de acesso não autorizado
      await supabaseAdmin.from('audit_logs').insert({
        user_id: user.id,
        operation: 'UNAUTHORIZED_UPDATE_ATTEMPT',
        table_name: 'freights',
        new_data: { freight_id, attempted_updates: updates }
      });

      return new Response(
        JSON.stringify({ 
          error: 'Você não tem permissão para atualizar este frete',
          code: 'FORBIDDEN' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar regras de negócio por role
    if (isDriver && !isAdmin) {
      // Motoristas não podem alterar preço
      if (updates.price !== undefined) {
        return new Response(
          JSON.stringify({ 
            error: 'Motoristas não podem alterar o preço do frete',
            code: 'DRIVER_CANNOT_UPDATE_PRICE' 
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Calculate safe pickup date
    const now = new Date();
    const safePickup = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    
    let finalPickupDate = updates.pickup_date || freight.pickup_date;
    if (finalPickupDate) {
      const pickupDate = new Date(finalPickupDate);
      if (pickupDate <= now) {
        finalPickupDate = safePickup.toISOString();
        logStep('Ajustando pickup_date passado', { original: updates.pickup_date, adjusted: finalPickupDate });
      }
    } else {
      finalPickupDate = safePickup.toISOString();
      logStep('Definindo pickup_date padrão', { value: finalPickupDate });
    }

    // Update freight with safe pickup_date
    const { data: updatedFreight, error: updateError } = await supabaseAdmin
      .from('freights')
      .update({
        ...updates,
        pickup_date: finalPickupDate,
        updated_at: new Date().toISOString()
      })
      .eq('id', freight_id)
      .select()
      .single();

    if (updateError) {
      logStep('Erro ao atualizar frete', { error: updateError });
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao atualizar frete',
          code: 'UPDATE_FAILED',
          details: updateError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Registrar auditoria de sucesso
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      operation: 'UPDATE',
      table_name: 'freights',
      old_data: { pickup_date: freight.pickup_date },
      new_data: { pickup_date: finalPickupDate, ...updates }
    });

    logStep('Frete atualizado com sucesso', { freight_id });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Frete atualizado com sucesso',
        freight: updatedFreight
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    logStep('Erro inesperado', { error: error.message, stack: error.stack });
    return new Response(
      JSON.stringify({ 
        error: 'Erro inesperado ao atualizar frete',
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

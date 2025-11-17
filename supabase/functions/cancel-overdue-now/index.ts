import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚨 [CANCEL-OVERDUE-NOW] Iniciando cancelamento de emergência...');

    // ✅ Verificar token de admin
    const adminToken = req.headers.get('X-Admin-Token');
    const expectedToken = Deno.env.get('ADMIN_TASK_TOKEN');
    
    if (!adminToken || adminToken !== expectedToken) {
      console.error('❌ Token de admin inválido ou ausente');
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ Criar client com SERVICE ROLE (bypass RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });

    console.log('📊 Buscando fretes vencidos...');

    // ✅ Buscar fretes vencidos (pickup_date + 48h < now)
    const { data: overdueFreights, error: fetchError } = await supabase
      .from('freights')
      .select('id, cargo_type, origin_city, destination_city, pickup_date, status, producer_id, driver_id')
      .in('status', ['OPEN', 'ACCEPTED', 'IN_NEGOTIATION', 'LOADING', 'LOADED', 'IN_TRANSIT'])
      .lt('pickup_date', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

    if (fetchError) {
      console.error('❌ Erro ao buscar fretes vencidos:', fetchError);
      throw fetchError;
    }

    console.log(`📦 Encontrados ${overdueFreights?.length || 0} fretes vencidos`);

    if (!overdueFreights || overdueFreights.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum frete vencido encontrado',
          cancelled_count: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ Cancelar em lote (SEM inserir em freight_status_history para evitar NOT NULL error)
    const freightIds = overdueFreights.map(f => f.id);
    const cancellationReason = 'Cancelamento automático: frete não coletado em 48h após a data agendada';
    
    console.log(`🔄 Cancelando ${freightIds.length} fretes...`);

    const { error: updateError } = await supabase
      .from('freights')
      .update({
        status: 'CANCELLED',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: cancellationReason,
      })
      .in('id', freightIds);

    if (updateError) {
      console.error('❌ Erro ao cancelar fretes:', updateError);
      throw updateError;
    }

    console.log(`✅ ${freightIds.length} fretes cancelados com sucesso`);

    // ✅ Log detalhado
    const cancelledDetails = overdueFreights.map(f => ({
      id: f.id,
      cargo_type: f.cargo_type,
      route: `${f.origin_city || 'N/A'} → ${f.destination_city || 'N/A'}`,
      pickup_date: f.pickup_date,
      status_anterior: f.status,
    }));

    console.log('📋 Fretes cancelados:', JSON.stringify(cancelledDetails, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        message: `${freightIds.length} fretes vencidos foram cancelados`,
        cancelled_count: freightIds.length,
        cancelled_freights: cancelledDetails,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro fatal:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao cancelar fretes vencidos',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

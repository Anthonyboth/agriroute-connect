import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de cargo types para categorias ANTT
const CARGO_TO_ANTT: Record<string, string> = {
  'graos_soja': 'Granel sólido',
  'graos_milho': 'Granel sólido',
  'graos_trigo': 'Granel sólido',
  'graos_arroz': 'Granel sólido',
  'adubo_fertilizante': 'Granel sólido',
  'calcario': 'Granel sólido',
  'farelo_soja': 'Granel sólido',
  'sementes_bags': 'Neogranel',
  'defensivos_agricolas': 'Perigosa (carga geral)',
  'combustivel': 'Granel líquido',
  'combustivel_diesel': 'Granel líquido',
  'racao_animal': 'Carga Geral',
  'fardos_algodao': 'Carga Geral',
  'gado_bovino': 'Carga Geral',
  'gado_leiteiro': 'Carga Geral',
  'suinos_porcos': 'Carga Geral',
  'maquinas_agricolas': 'Carga Geral',
  'equipamentos': 'Carga Geral',
  'acucar': 'Granel sólido',
  'cafe': 'Granel sólido',
  'algodao': 'Carga Geral',
  'madeira': 'Carga Geral',
  'celulose': 'Carga Geral',
  'frutas': 'Carga Geral',
  'hortifruti': 'Carga Geral',
  'carnes': 'Carga Geral',
  'laticinios': 'Carga Geral',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    
    // Criar cliente Supabase com service role para operações administrativas
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verificar autenticação e role do usuário
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se é admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'ADMIN') {
      return new Response(JSON.stringify({ error: 'Acesso negado - apenas administradores' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit check
    const { data: rateLimitOk } = await supabaseAdmin.rpc('check_rate_limit', {
      endpoint_name: 'recalculate_all_antt',
      max_requests: 1,
      time_window: '01:00:00'
    });

    if (!rateLimitOk) {
      return new Response(JSON.stringify({ error: 'Rate limit excedido - aguarde 1 hora' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🔄 Iniciando recálculo em massa de ANTT...');

    // Buscar fretes CARGA com ANTT nulo ou zero
    const { data: freights, error: fetchError } = await supabaseAdmin
      .from('freights')
      .select('id, cargo_type, distance_km, vehicle_axles_required, high_performance, vehicle_ownership, required_trucks')
      .eq('service_type', 'CARGA')
      .or('minimum_antt_price.is.null,minimum_antt_price.eq.0')
      .limit(500); // Limitar para segurança

    if (fetchError) {
      console.error('❌ Erro ao buscar fretes:', fetchError);
      throw fetchError;
    }

    console.log(`📦 Encontrados ${freights?.length || 0} fretes para processar`);

    const results = {
      total: freights?.length || 0,
      updated: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[]
    };

    for (const freight of freights || []) {
      try {
        // Validar dados necessários
        if (!freight.cargo_type || !freight.distance_km) {
          results.skipped++;
          results.details.push({
            freight_id: freight.id,
            status: 'skipped',
            reason: 'Dados incompletos (cargo_type ou distance_km faltando)'
          });
          continue;
        }

        // Determinar categoria ANTT
        const anttCategory = CARGO_TO_ANTT[freight.cargo_type] || 'Carga Geral';
        
        // Determinar table_type
        const tableType = freight.high_performance 
          ? (freight.vehicle_ownership === 'PROPRIO' ? 'C' : 'D')
          : (freight.vehicle_ownership === 'PROPRIO' ? 'A' : 'B');
        
        // Determinar número de eixos (default 5 se não especificado)
        const axles = freight.vehicle_axles_required || 5;

        console.log(`📊 Processando frete ${freight.id}:`, { anttCategory, tableType, axles });

        // Buscar taxa ANTT
        const { data: rate, error: rateError } = await supabaseAdmin
          .from('antt_rates')
          .select('rate_per_km, fixed_charge')
          .eq('table_type', tableType)
          .eq('cargo_category', anttCategory)
          .eq('axles', axles)
          .maybeSingle();

        let rateRow = rate;

        // Fallback para Carga Geral
        if (!rateRow) {
          const { data: fallbackRate } = await supabaseAdmin
            .from('antt_rates')
            .select('rate_per_km, fixed_charge')
            .eq('table_type', tableType)
            .eq('cargo_category', 'Carga Geral')
            .eq('axles', axles)
            .maybeSingle();
          
          rateRow = fallbackRate;
        }

        if (!rateRow) {
          results.failed++;
          results.details.push({
            freight_id: freight.id,
            status: 'failed',
            reason: `Taxa ANTT não encontrada para ${axles} eixos, tabela ${tableType}`
          });
          continue;
        }

        // Calcular preço mínimo ANTT
        const requiredTrucks = freight.required_trucks || 1;
        const basePrice = (parseFloat(rateRow.rate_per_km) * freight.distance_km) + parseFloat(rateRow.fixed_charge);
        const minimumAnttPrice = Math.round(basePrice * 100) / 100;
        const minimumAnttPriceTotal = Math.round(minimumAnttPrice * requiredTrucks * 100) / 100;

        console.log(`💰 Preço ANTT calculado: R$ ${minimumAnttPriceTotal} (${minimumAnttPrice} × ${requiredTrucks})`);

        // Atualizar frete
        const { error: updateError } = await supabaseAdmin
          .from('freights')
          .update({ 
            minimum_antt_price: minimumAnttPriceTotal,
            updated_at: new Date().toISOString()
          })
          .eq('id', freight.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar frete ${freight.id}:`, updateError);
          results.failed++;
          results.details.push({
            freight_id: freight.id,
            status: 'failed',
            reason: updateError.message
          });
        } else {
          results.updated++;
          results.details.push({
            freight_id: freight.id,
            status: 'success',
            minimum_antt_price: minimumAnttPriceTotal,
            calculation: {
              category: anttCategory,
              table: tableType,
              axles,
              distance_km: freight.distance_km,
              rate_per_km: rateRow.rate_per_km,
              fixed_charge: rateRow.fixed_charge
            }
          });
        }
      } catch (freightError) {
        console.error(`❌ Erro processando frete ${freight.id}:`, freightError);
        results.failed++;
        results.details.push({
          freight_id: freight.id,
          status: 'failed',
          reason: freightError instanceof Error ? freightError.message : 'Erro desconhecido'
        });
      }
    }

    // Log de auditoria
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_id: user.id,
        table_name: 'freights',
        operation: 'BULK_ANTT_RECALCULATION',
        new_data: results,
        timestamp: new Date().toISOString()
      });

    console.log('✅ Recálculo concluído:', results);

    return new Response(JSON.stringify({
      success: true,
      message: `Recálculo concluído: ${results.updated} atualizados, ${results.failed} falharam, ${results.skipped} ignorados`,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro no recálculo em massa:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

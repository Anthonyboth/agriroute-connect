import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-inspection-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Rate limit: max 5 queries per IP per hour
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_HOURS = 1;

/**
 * Endpoint de consulta para fiscalização PRF
 * Retorna dados não-sensíveis do frete baseado na placa do veículo
 * 
 * SEGURANÇA:
 * - Rate limiting por IP (5 consultas/hora)
 * - Token de inspeção opcional para acesso ilimitado
 * - Logging de todas as consultas para auditoria
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 204 });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Obter IP e User-Agent para log e rate limiting
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                    req.headers.get('x-real-ip') || 
                    'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  try {
    // Check for inspection token (authorities like PRF/ANTT can have tokens)
    const inspectionToken = req.headers.get('x-inspection-token');
    let isAuthorizedInspector = false;

    if (inspectionToken) {
      // Validate inspection token against trusted_entities table
      const { data: tokenData } = await supabaseClient
        .from('trusted_entities')
        .select('id, entity_name')
        .eq('token', inspectionToken)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();
      
      if (tokenData) {
        isAuthorizedInspector = true;
        console.log(`[Fiscalização] Authorized inspector: ${tokenData.entity_name}`);
      }
    }

    // Apply rate limiting for non-authorized requests
    if (!isAuthorizedInspector) {
      const windowStart = new Date();
      windowStart.setHours(windowStart.getHours() - RATE_LIMIT_WINDOW_HOURS);

      // Check rate limit
      const { data: rateLimitData } = await supabaseClient
        .from('api_rate_limits')
        .select('request_count, blocked_until')
        .eq('endpoint', 'fiscalizacao-consulta')
        .eq('ip_address', ipAddress)
        .gte('window_start', windowStart.toISOString())
        .single();

      if (rateLimitData) {
        // Check if blocked
        if (rateLimitData.blocked_until && new Date(rateLimitData.blocked_until) > new Date()) {
          console.log(`[Fiscalização] Rate limited IP: ${ipAddress}`);
          return new Response(
            JSON.stringify({
              error: 'Limite de consultas excedido. Tente novamente mais tarde.',
              code: 'RATE_LIMIT_EXCEEDED'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 429,
            }
          );
        }

        // Check if over limit
        if (rateLimitData.request_count >= RATE_LIMIT_MAX) {
          // Block for 1 hour
          await supabaseClient
            .from('api_rate_limits')
            .update({
              blocked_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              block_reason: 'Exceeded rate limit for fiscalizacao-consulta'
            })
            .eq('endpoint', 'fiscalizacao-consulta')
            .eq('ip_address', ipAddress);

          console.log(`[Fiscalização] Blocking IP for rate limit: ${ipAddress}`);
          return new Response(
            JSON.stringify({
              error: 'Limite de consultas excedido. Tente novamente em 1 hora.',
              code: 'RATE_LIMIT_EXCEEDED'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 429,
            }
          );
        }

        // Increment counter
        await supabaseClient
          .from('api_rate_limits')
          .update({ request_count: rateLimitData.request_count + 1 })
          .eq('endpoint', 'fiscalizacao-consulta')
          .eq('ip_address', ipAddress);
      } else {
        // Create new rate limit entry
        await supabaseClient
          .from('api_rate_limits')
          .insert({
            endpoint: 'fiscalizacao-consulta',
            ip_address: ipAddress,
            request_count: 1,
            window_start: new Date().toISOString()
          });
      }
    }

    const { placa } = await req.json();

    if (!placa) {
      throw new Error('Placa é obrigatória');
    }

    // Normalizar placa (remover traços e espaços, uppercase)
    const placaNormalizada = placa.replace(/[-\s]/g, '').toUpperCase();

    if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placaNormalizada)) {
      throw new Error('Formato de placa inválido');
    }

    console.log(`[Fiscalização] Consulta placa ${placaNormalizada} de ${ipAddress} (authorized: ${isAuthorizedInspector})`);

    // Chamar função SQL para obter dados de fiscalização
    const { data: fiscData, error: fiscError } = await supabaseClient
      .rpc('get_fiscalizacao_data', { p_placa: placaNormalizada });

    // Registrar log da consulta
    await supabaseClient.from('fiscalizacao_logs').insert({
      placa: placaNormalizada,
      ip_address: ipAddress,
      user_agent: userAgent,
      response_data: fiscData || { message: 'Nenhum dado encontrado' },
    });

    if (fiscError) {
      console.error('[Fiscalização] Erro na consulta:', fiscError);
      throw new Error('Erro ao consultar dados');
    }

    if (!fiscData || fiscData.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          encontrado: false,
          mensagem: 'Nenhum frete ativo encontrado para esta placa',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Retornar dados do frete ativo
    const freteAtivo = fiscData[0];

    return new Response(
      JSON.stringify({
        success: true,
        encontrado: true,
        dados: {
          // Dados do frete (não-sensíveis)
          origem: freteAtivo.origem,
          destino: freteAtivo.destino,
          status: freteAtivo.status,
          data_coleta: freteAtivo.data_coleta,
          
          // Dados do veículo
          placa: freteAtivo.placa,
          tipo_veiculo: freteAtivo.tipo_veiculo,
          
          // Dados da carga
          tipo_carga: freteAtivo.tipo_carga,
          peso_kg: freteAtivo.peso_kg,
          
          // Documentos fiscais
          cte_chave: freteAtivo.cte_chave,
          cte_numero: freteAtivo.cte_numero,
          mdfe_chave: freteAtivo.mdfe_chave,
          mdfe_numero: freteAtivo.mdfe_numero,
          
          // Status dos documentos
          cte_status: freteAtivo.cte_status,
          mdfe_status: freteAtivo.mdfe_status,
          
          // Transportadora
          transportadora_cnpj: freteAtivo.transportadora_cnpj,
          transportadora_razao: freteAtivo.transportadora_razao,
          transportadora_rntrc: freteAtivo.transportadora_rntrc,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[Fiscalização] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

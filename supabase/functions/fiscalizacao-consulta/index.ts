import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Endpoint de consulta para fiscalização PRF
 * Retorna dados não-sensíveis do frete baseado na placa do veículo
 * Apenas para uso interno de fiscalização
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obter IP e User-Agent para log
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const { placa } = await req.json();

    if (!placa) {
      throw new Error('Placa é obrigatória');
    }

    // Normalizar placa (remover traços e espaços, uppercase)
    const placaNormalizada = placa.replace(/[-\s]/g, '').toUpperCase();

    if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placaNormalizada)) {
      throw new Error('Formato de placa inválido');
    }

    console.log(`[Fiscalização] Consulta placa ${placaNormalizada} de ${ipAddress}`);

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

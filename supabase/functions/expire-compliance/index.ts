// Edge Function: expire-compliance
// Executa verificação diária de expiração de compliance sanitário
// Deve ser configurado como cron job no Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Executar função de expiração
    const { data, error } = await supabase.rpc('run_compliance_expiry_check');

    if (error) {
      console.error('Erro ao executar verificação de expiração:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Verificação de expiração executada:', data);

    // Registrar execução no log de auditoria
    await supabase.rpc('log_compliance_event', {
      p_freight_id: null,
      p_livestock_compliance_id: null,
      p_event_type: 'compliance_expiry_check',
      p_event_category: 'system',
      p_event_data: {
        records_expired: data?.records_expired || 0,
        executed_at: new Date().toISOString(),
        trigger: 'cron',
      },
      p_previous_state: null,
      p_new_state: null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        records_expired: data?.records_expired || 0,
        executed_at: new Date().toISOString(),
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Erro na edge function expire-compliance:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

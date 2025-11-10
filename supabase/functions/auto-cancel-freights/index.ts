import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase admin client
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

    console.log('[AUTO-CANCEL] Iniciando verificação automática de fretes vencidos...');
    const startTime = Date.now();

    // Call the database function
    const { data, error } = await supabaseAdmin.rpc('auto_cancel_overdue_freights');

    if (error) {
      console.error('[AUTO-CANCEL] Erro ao executar função:', error);
      throw error;
    }

    const executionTime = Date.now() - startTime;

    console.log('[AUTO-CANCEL] Resultado da verificação:', {
      ...data,
      execution_time_ms: executionTime
    });

    return new Response(
      JSON.stringify({
        success: true,
        data,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[AUTO-CANCEL] Erro crítico:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

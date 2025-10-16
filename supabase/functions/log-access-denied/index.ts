import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Sem autorização');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // Buscar profile_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const { route, requiredRoles, userRoles } = await req.json();

    // Obter IP e User-Agent
    const ipAddress = req.headers.get('cf-connecting-ip') || 
                      req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    console.log('[log-access-denied] Tentativa de acesso negado:', {
      user_id: user.id,
      profile_id: profile?.id,
      route,
      requiredRoles,
      userRoles,
      ipAddress
    });

    // Inserir log
    const { error: insertError } = await supabase
      .from('access_denied_logs')
      .insert({
        user_id: user.id,
        profile_id: profile?.id,
        attempted_route: route,
        required_roles: requiredRoles,
        user_roles: userRoles,
        ip_address: ipAddress,
        user_agent: userAgent
      });

    if (insertError) {
      console.error('[log-access-denied] Erro ao inserir log:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, logged: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[log-access-denied] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
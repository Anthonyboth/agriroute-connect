import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[NFE-UPDATE] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { 
      access_key, 
      manifestation_type,
      manifestation_mode = 'assisted',
      freight_id,
    } = body;

    console.log('[NFE-UPDATE] Request:', { 
      access_key: access_key?.slice(0, 10) + '...', 
      manifestation_type,
      manifestation_mode,
      user_id: user.id,
    });

    // Validate access key
    if (!access_key || !/^\d{44}$/.test(access_key)) {
      return new Response(
        JSON.stringify({ error: 'Chave de acesso inválida. Deve conter 44 dígitos.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate manifestation type
    const validTypes = ['ciencia', 'confirmacao', 'desconhecimento', 'nao_realizada'];
    if (!manifestation_type || !validTypes.includes(manifestation_type)) {
      return new Response(
        JSON.stringify({ error: 'Tipo de manifestação inválido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if NFe exists
    const { data: existingNfe, error: fetchError } = await supabase
      .from('nfe_documents')
      .select('id, status')
      .eq('access_key', access_key)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[NFE-UPDATE] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar NF-e.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!existingNfe) {
      return new Response(
        JSON.stringify({ error: 'NF-e não encontrada no sistema.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update NFe status
    const updateData = {
      status: 'manifested',
      manifestation_type,
      manifestation_mode,
      manifestation_date: new Date().toISOString(),
      user_declaration_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: updatedNfe, error: updateError } = await supabase
      .from('nfe_documents')
      .update(updateData)
      .eq('access_key', access_key)
      .select()
      .single();

    if (updateError) {
      console.error('[NFE-UPDATE] Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar status da NF-e.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the action for audit
    await supabase.from('fiscal_compliance_logs').insert({
      user_id: user.id,
      action_type: 'manifestation_status_updated',
      nfe_access_key: access_key,
      freight_id: freight_id || null,
      metadata: {
        manifestation_type,
        manifestation_mode,
        previous_status: existingNfe.status,
        new_status: 'manifested',
      },
    });

    console.log('[NFE-UPDATE] Success:', { 
      nfe_id: updatedNfe.id,
      new_status: 'manifested',
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: updatedNfe,
        message: 'Status da NF-e atualizado com sucesso.',
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[NFE-UPDATE] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Não autorizado');
    }

    // Buscar profile do usuário
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      throw new Error('Profile não encontrado');
    }

    const { access_key, freight_id } = await req.json();

    if (!access_key || access_key.length !== 44) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chave de acesso inválida (deve ter 44 caracteres)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se já existe no banco
    const { data: existing } = await supabaseClient
      .from('nfe_documents')
      .select('*')
      .eq('access_key', access_key)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, data: existing }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Consultar API da NFE.io
    const nfeIoKey = Deno.env.get('NFE_IO_API_KEY');
    const nfeResponse = await fetch(`https://api.nfe.io/v1/nfe/${access_key}`, {
      headers: {
        'Authorization': `Bearer ${nfeIoKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!nfeResponse.ok) {
      throw new Error('Erro ao consultar NF-e na NFE.io');
    }

    const nfeData = await nfeResponse.json();

    // Salvar no banco
    const { data: newNfe, error: insertError } = await supabaseClient
      .from('nfe_documents')
      .insert({
        access_key: access_key,
        issuer_cnpj: nfeData.issuer?.cnpj || '',
        issuer_name: nfeData.issuer?.name || '',
        number: nfeData.number || '',
        series: nfeData.series || '',
        issue_date: nfeData.issued_on || new Date().toISOString(),
        value: nfeData.total_amount || 0,
        status: 'pending',
        freight_id: freight_id || null,
        created_by: profile.id,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, data: newNfe }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro em nfe-scan:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

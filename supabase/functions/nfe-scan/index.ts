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

    console.log('[nfe-scan] Recebido:', { access_key, freight_id, user_id: user.id });

    // Validar chave de acesso
    if (!access_key) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chave de acesso não informada', sefaz_code: '400' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limpar a chave (remover espaços)
    const cleanedKey = access_key.replace(/\s+/g, '');

    // Validar formato
    if (!/^\d{44}$/.test(cleanedKey)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Chave de acesso inválida (deve ter 44 dígitos numéricos, atual: ${cleanedKey.length})`,
          sefaz_code: '400'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se já existe no banco
    const { data: existing } = await supabaseClient
      .from('nfe_documents')
      .select('*')
      .eq('access_key', cleanedKey)
      .single();

    if (existing) {
      console.log('[nfe-scan] NF-e já existe no banco:', cleanedKey);
      return new Response(
        JSON.stringify({ success: true, data: existing, existing: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Tentar consultar API da NFE.io (se configurada)
    const nfeIoKey = Deno.env.get('NFE_IO_API_KEY');
    let nfeData: any = null;

    if (nfeIoKey) {
      try {
        console.log('[nfe-scan] Consultando NFE.io...');
        const nfeResponse = await fetch(`https://api.nfe.io/v1/nfe/${cleanedKey}`, {
          headers: {
            'Authorization': `Bearer ${nfeIoKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (nfeResponse.ok) {
          nfeData = await nfeResponse.json();
          console.log('[nfe-scan] Dados NFE.io:', nfeData);
        } else {
          const errorData = await nfeResponse.json().catch(() => ({}));
          console.warn('[nfe-scan] Erro NFE.io:', errorData);
          
          // Se NFE.io retornar erro de NF-e não encontrada
          if (nfeResponse.status === 404) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'NF-e não encontrada na base SEFAZ',
                sefaz_code: '217'
              }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (apiError) {
        console.error('[nfe-scan] Erro ao consultar NFE.io:', apiError);
        // Continuar sem os dados da API
      }
    }

    // Extrair dados da chave de acesso (padrão SEFAZ)
    // Formato: UFAAMM CNPJ MOD SER NUM CODIGO DV
    // Posições: 0-1 UF, 2-5 AAMM, 6-19 CNPJ, 20-21 MOD, 22-24 SER, 25-33 NUM, 34-42 COD, 43 DV
    const uf = cleanedKey.substring(0, 2);
    const aamm = cleanedKey.substring(2, 6);
    const cnpj = cleanedKey.substring(6, 20);
    const modelo = cleanedKey.substring(20, 22);
    const serie = cleanedKey.substring(22, 25);
    const numero = cleanedKey.substring(25, 34);

    const year = '20' + aamm.substring(0, 2);
    const month = aamm.substring(2, 4);

    // Salvar no banco
    const { data: newNfe, error: insertError } = await supabaseClient
      .from('nfe_documents')
      .insert({
        access_key: cleanedKey,
        issuer_cnpj: nfeData?.issuer?.cnpj || cnpj,
        issuer_name: nfeData?.issuer?.name || `CNPJ ${cnpj}`,
        number: nfeData?.number || numero.replace(/^0+/, ''),
        series: nfeData?.series || serie.replace(/^0+/, ''),
        issue_date: nfeData?.issued_on || `${year}-${month}-01T00:00:00Z`,
        value: nfeData?.total_amount || 0,
        status: 'pending',
        freight_id: freight_id || null,
        created_by: profile.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[nfe-scan] Erro ao inserir:', insertError);
      throw insertError;
    }

    console.log('[nfe-scan] ✅ NF-e registrada:', newNfe);

    return new Response(
      JSON.stringify({ success: true, data: newNfe }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[nfe-scan] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message, sefaz_code: '999' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

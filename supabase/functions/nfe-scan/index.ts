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

    // Validar formato (44 dígitos)
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

    // Extrair dados da chave de acesso (padrão SEFAZ)
    // Formato: UF(2) AAMM(4) CNPJ(14) MOD(2) SER(3) NUM(9) COD(9) DV(1)
    // Posições: 0-1 UF, 2-5 AAMM, 6-19 CNPJ, 20-21 MOD, 22-24 SER, 25-33 NUM, 34-42 COD, 43 DV
    const uf = cleanedKey.substring(0, 2);
    const aamm = cleanedKey.substring(2, 6);
    const cnpj = cleanedKey.substring(6, 20);
    const modelo = cleanedKey.substring(20, 22);
    const serie = cleanedKey.substring(22, 25);
    const numero = cleanedKey.substring(25, 34);

    const year = '20' + aamm.substring(0, 2);
    const month = aamm.substring(2, 4);

    // Validar modelo (55 = NF-e, 65 = NFC-e)
    if (modelo !== '55' && modelo !== '65') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Modelo inválido: ${modelo}. Esperado: 55 (NF-e) ou 65 (NFC-e)`,
          sefaz_code: '400'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Formatar CNPJ para exibição
    const cnpjFormatado = cnpj.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5'
    );

    // Salvar no banco (sem dependência de API externa)
    const { data: newNfe, error: insertError } = await supabaseClient
      .from('nfe_documents')
      .insert({
        access_key: cleanedKey,
        issuer_cnpj: cnpj,
        issuer_name: `Emitente CNPJ ${cnpjFormatado}`,
        number: numero.replace(/^0+/, '') || '0',
        series: serie.replace(/^0+/, '') || '0',
        issue_date: `${year}-${month}-01T00:00:00Z`,
        value: 0, // Valor será informado manualmente ou via OCR
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

    // Registrar log de auditoria fiscal
    await supabaseClient.from('fiscal_compliance_logs').insert({
      user_id: user.id,
      action_type: 'nfe_scanned',
      nfe_access_key: cleanedKey,
      freight_id: freight_id || null,
      metadata: {
        uf,
        cnpj,
        numero: numero.replace(/^0+/, ''),
        serie: serie.replace(/^0+/, ''),
        modelo,
      },
    });

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

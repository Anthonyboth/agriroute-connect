import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { name, email, phone, document } = await req.json();

    // 1. Normalizar documento (remover caracteres especiais)
    const normalizedDoc = document.replace(/\D/g, '');
    
    // 2. Validar CPF/CNPJ
    const documentType = normalizedDoc.length === 11 ? 'CPF' : 
                        normalizedDoc.length === 14 ? 'CNPJ' : null;
    
    if (!documentType) {
      return new Response(
        JSON.stringify({ 
          error: 'Documento inválido. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 3. Verificar se já existe usuário registrado com esse documento
    const { data: existingProfile } = await supabaseClient
      .from('profiles')
      .select('id, full_name, email, user_id')
      .eq('document', normalizedDoc)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ 
          user_exists: true,
          message: `Encontramos uma conta cadastrada com este ${documentType}. Por favor, faça login para continuar.`,
          profile_name: existingProfile.full_name,
          profile_email: existingProfile.email
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 4. Verificar se já existe prospect com esse documento
    const { data: existingProspect } = await supabaseClient
      .from('prospect_users')
      .select('*')
      .eq('document', normalizedDoc)
      .maybeSingle();

    if (existingProspect) {
      // Atualizar prospect existente
      const { data: updatedProspect, error: updateError } = await supabaseClient
        .from('prospect_users')
        .update({
          full_name: name,
          email: email || existingProspect.email,
          phone: phone,
          last_request_date: new Date().toISOString(),
          total_requests: (existingProspect.total_requests || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingProspect.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ 
          user_exists: false,
          prospect_id: updatedProspect.id,
          is_returning: true,
          message: 'Bem-vindo de volta!'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 5. Criar novo prospect
    const { data: newProspect, error: insertError } = await supabaseClient
      .from('prospect_users')
      .insert({
        full_name: name,
        email: email,
        phone: phone,
        document: normalizedDoc,
        document_type: documentType,
        total_requests: 1
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ 
        user_exists: false,
        prospect_id: newProspect.id,
        is_returning: false,
        message: 'Cadastro criado com sucesso!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Erro ao validar guest user:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

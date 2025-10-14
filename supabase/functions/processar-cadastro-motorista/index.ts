import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { 
      token, 
      full_name, 
      email, 
      phone, 
      cpf_cnpj, 
      password 
    } = await req.json()

    console.log('[PROCESSAR-CADASTRO] Iniciando cadastro para:', email)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Validar token novamente
    const { data: convite, error: conviteError } = await supabaseAdmin
      .from('convites_motoristas')
      .select('id, transportadora_id, usado, expira_em')
      .eq('token', token)
      .single()

    if (conviteError || !convite) {
      console.log('[PROCESSAR-CADASTRO] Erro ao buscar convite:', conviteError)
      throw new Error('Convite não encontrado')
    }

    if (convite.usado) {
      throw new Error('Convite já foi utilizado')
    }

    if (new Date(convite.expira_em) < new Date()) {
      throw new Error('Convite expirado')
    }

    // 2. Buscar ID da transportadora
    const { data: transportCompany, error: companyError } = await supabaseAdmin
      .from('transport_companies')
      .select('id')
      .eq('profile_id', convite.transportadora_id)
      .single()

    if (companyError || !transportCompany) {
      console.log('[PROCESSAR-CADASTRO] Transportadora não encontrada:', companyError)
      throw new Error('Transportadora não encontrada')
    }

    // 3. Criar usuário no Auth
    console.log('[PROCESSAR-CADASTRO] Criando usuário no Auth')
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone,
        cpf_cnpj,
        role: 'MOTORISTA',
        invited_by_company: convite.transportadora_id
      }
    })

    if (authError) {
      console.log('[PROCESSAR-CADASTRO] Erro ao criar usuário:', authError)
      throw authError
    }

    console.log('[PROCESSAR-CADASTRO] Usuário criado:', authData.user.id)

    // 4. Criar perfil
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: authData.user.id,
        full_name,
        email,
        phone,
        cpf_cnpj,
        role: 'MOTORISTA',
        status: 'APPROVED'
      })
      .select()
      .single()

    if (profileError) {
      console.log('[PROCESSAR-CADASTRO] Erro ao criar perfil:', profileError)
      throw profileError
    }

    console.log('[PROCESSAR-CADASTRO] Perfil criado:', profile.id)

    // 5. Vincular à transportadora
    const { error: vinculoError } = await supabaseAdmin
      .from('company_drivers')
      .insert({
        company_id: transportCompany.id,
        driver_profile_id: profile.id,
        invited_by: convite.transportadora_id,
        status: 'ACTIVE',
        accepted_at: new Date().toISOString()
      })

    if (vinculoError) {
      console.log('[PROCESSAR-CADASTRO] Erro ao vincular motorista:', vinculoError)
      throw vinculoError
    }

    console.log('[PROCESSAR-CADASTRO] Motorista vinculado à transportadora')

    // 6. Marcar token como usado
    await supabaseAdmin
      .from('convites_motoristas')
      .update({
        usado: true,
        usado_por: profile.id,
        usado_em: new Date().toISOString()
      })
      .eq('id', convite.id)

    console.log('[PROCESSAR-CADASTRO] Token marcado como usado')

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user.id,
        profile_id: profile.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('[PROCESSAR-CADASTRO] Erro:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

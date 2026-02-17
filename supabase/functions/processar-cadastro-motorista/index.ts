import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { documentNumberSchema } from '../_shared/validation.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { token, userData } = await req.json()

    // Validate and normalize CPF
    const cleanCPF = documentNumberSchema.parse(userData.cpf);

    console.log('[PROCESSAR-CADASTRO] Iniciando cadastro para:', userData.email)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Validar token
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

    const companyProfileId = convite.transportadora_id

    // 2. Buscar ID da transportadora
    const { data: transportCompany, error: companyError } = await supabaseAdmin
      .from('transport_companies')
      .select('id')
      .eq('profile_id', companyProfileId)
      .single()

    if (companyError || !transportCompany) {
      console.log('[PROCESSAR-CADASTRO] Transportadora não encontrada:', companyError)
      throw new Error('Transportadora não encontrada')
    }

    // 3. Criar usuário no Auth
    console.log('[PROCESSAR-CADASTRO] Criando usuário no Auth')
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        full_name: userData.fullName,
        phone: userData.phone,
        role: 'MOTORISTA_AFILIADO',
        invited_by_company: companyProfileId
      }
    })

    if (authError) {
      console.log('[PROCESSAR-CADASTRO] Erro ao criar usuário:', authError)
      throw authError
    }

    const user = authData.user
    console.log('[PROCESSAR-CADASTRO] Usuário criado:', user.id)

    // 4. Criar profile do motorista
    const profileData: any = {
      user_id: user.id,
      full_name: userData.fullName,
      email: userData.email,
      phone: userData.phone,
      document: cleanCPF,
      cpf_cnpj: cleanCPF,
      role: 'MOTORISTA_AFILIADO',
      status: 'APPROVED'
    }

    // Adicionar endereço nos campos dedicados da tabela profiles
    if (userData.address) {
      profileData.address_street = userData.address.street || null
      profileData.address_number = userData.address.number || null
      profileData.address_complement = userData.address.complement || null
      profileData.address_city = userData.address.city || null
      profileData.address_state = userData.address.state || null
      profileData.address_zip = userData.address.zipCode || null
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert(profileData)
      .select()
      .single()

    if (profileError) throw profileError

    console.log('[PROCESSAR-CADASTRO] Perfil criado:', profile.id)

    // 5. Vincular à transportadora
    const { error: vinculoError } = await supabaseAdmin
      .from('company_drivers')
      .insert({
        company_id: transportCompany.id,
        driver_profile_id: profile.id,
        invited_by: companyProfileId,
        status: 'ACTIVE',
        accepted_at: new Date().toISOString()
      })

    if (vinculoError) {
      console.log('[PROCESSAR-CADASTRO] Erro ao vincular motorista:', vinculoError)
      throw vinculoError
    }

    console.log('[PROCESSAR-CADASTRO] Motorista vinculado à transportadora')

    // 6. Criar veículo se fornecido
    if (userData.vehicle && userData.vehicle.plate) {
      const { error: vehicleError } = await supabaseAdmin
        .from('vehicles')
        .insert({
          profile_id: profile.id,
          plate: userData.vehicle.plate,
          type: userData.vehicle.type || 'CAMINHAO',
          model: userData.vehicle.model,
          year: userData.vehicle.year ? parseInt(userData.vehicle.year) : null,
          is_company_vehicle: false
        })

      if (vehicleError) {
        console.error('Erro ao criar veículo:', vehicleError)
      }
    }

    // 7. Marcar convite como usado
    const { error: updateError } = await supabaseAdmin
      .from('convites_motoristas')
      .update({
        usado: true,
        usado_em: new Date().toISOString(),
        usado_por: profile.id
      })
      .eq('token', token)

    if (updateError) {
      console.error('Erro ao atualizar convite:', updateError)
    }

    // 8. Criar notificação para a transportadora
    const { error: notificationError } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: companyProfileId,
        title: 'Novo motorista cadastrado',
        message: `${userData.fullName} aceitou o convite e se cadastrou na sua transportadora.`,
        type: 'info',
        data: {
          driver_id: profile.id,
          driver_name: userData.fullName,
          event: 'driver_signup'
        }
      })

    if (notificationError) {
      console.error('Erro ao criar notificação:', notificationError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: user.id,
        profileId: profile.id,
        message: 'Motorista cadastrado com sucesso'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error: any) {
    console.error('Erro no processamento:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})

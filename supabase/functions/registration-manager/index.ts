import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
    console.log('[REGISTRATION-MANAGER] Function started')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
      console.error('[REGISTRATION-MANAGER] Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    console.log('[REGISTRATION-MANAGER] User authenticated:', user.id)

    // Buscar perfil do usuário
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('[REGISTRATION-MANAGER] Profile error:', profileError)
      return new Response(
        JSON.stringify({ error: 'Perfil não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    console.log('[REGISTRATION-MANAGER] Profile found:', { id: profile.id, role: profile.role })

    // Verificar se é transportadora
    const { data: company } = await supabaseClient
      .from('transport_companies')
      .select('*')
      .eq('profile_id', profile.id)
      .single()

    // Verificar se é motorista afiliado
    const { data: companyDriver } = await supabaseClient
      .from('company_drivers')
      .select('*')
      .eq('driver_profile_id', profile.id)
      .eq('status', 'ACTIVE')
      .single()

    // Determinar modo de cadastro
    let mode: string
    
    if (profile.role === 'TRANSPORTADORA' || company) {
      mode = 'TRANSPORTADORA'
    } else if (profile.role === 'MOTORISTA_AFILIADO' || (profile.role === 'MOTORISTA' && companyDriver)) {
      mode = 'MOTORISTA_AFILIADO'
    } else if (profile.role === 'MOTORISTA' && !companyDriver) {
      mode = 'MOTORISTA_AUTONOMO'
    } else if (profile.role === 'PRODUTOR') {
      mode = 'PRODUTOR'
    } else if (profile.role === 'PRESTADOR_SERVICOS') {
      mode = 'PRESTADOR'
    } else {
      mode = 'PRODUTOR' // fallback
    }

    console.log('[REGISTRATION-MANAGER] Registration mode:', mode)

    // Definir passos necessários
    let steps: string[]
    
    switch (mode) {
      case 'TRANSPORTADORA':
        steps = ['dados_basicos', 'documentos_basicos']
        break
      case 'MOTORISTA_AUTONOMO':
        steps = ['dados_basicos', 'documentos_basicos', 'documentos_e_veiculos']
        break
      case 'MOTORISTA_AFILIADO':
      case 'PRODUTOR':
      case 'PRESTADOR':
        steps = ['dados_basicos', 'documentos_basicos']
        break
      default:
        steps = ['dados_basicos', 'documentos_basicos']
    }

    // Definir requisitos por passo
    const requirementsByStep: Record<string, string[]> = {}

    // Passo 1: Dados básicos
    if (mode === 'MOTORISTA_AUTONOMO' || mode === 'MOTORISTA_AFILIADO') {
      requirementsByStep['dados_basicos'] = ['full_name', 'phone', 'cpf_cnpj', 'fixed_address', 'rntrc']
    } else {
      requirementsByStep['dados_basicos'] = ['full_name', 'phone', 'cpf_cnpj', 'fixed_address']
    }

    // Passo 2: Documentos básicos
    requirementsByStep['documentos_basicos'] = ['selfie', 'document_photo']

    // Passo 3: Documentos e veículos (apenas motorista autônomo)
    if (mode === 'MOTORISTA_AUTONOMO') {
      requirementsByStep['documentos_e_veiculos'] = ['cnh', 'address_proof', 'placa_cavalo', 'veiculo', 'localizacao']
    }

    console.log('[REGISTRATION-MANAGER] Requirements:', requirementsByStep)

    return new Response(
      JSON.stringify({
        mode,
        steps,
        requirementsByStep,
        profile: {
          id: profile.id,
          role: profile.role,
          status: profile.status
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('[REGISTRATION-MANAGER] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

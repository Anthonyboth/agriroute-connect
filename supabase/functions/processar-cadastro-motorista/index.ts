import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { documentNumberSchema, validateInput } from '../_shared/validation.ts'
import { checkInMemoryRateLimit } from '../_shared/rate-limiter.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// ✅ Schema de validação rigoroso
const UserDataSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(200).transform(v => v.trim()),
  phone: z.string().max(50).optional().nullable(),
  cpf: documentNumberSchema,
  address: z.object({
    street: z.string().max(300).optional().nullable(),
    number: z.string().max(20).optional().nullable(),
    complement: z.string().max(200).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    state: z.string().max(2).optional().nullable(),
    zipCode: z.string().max(10).optional().nullable(),
  }).optional().nullable(),
  vehicle: z.object({
    plate: z.string().max(10).optional().nullable(),
    type: z.string().max(50).optional().nullable(),
    model: z.string().max(100).optional().nullable(),
    year: z.string().max(4).optional().nullable(),
  }).optional().nullable(),
})

const RequestSchema = z.object({
  token: z.string().uuid('Token inválido'),
  userData: UserDataSchema,
})

function getClientIP(req: Request): string {
  for (const h of ['x-real-ip', 'x-forwarded-for', 'cf-connecting-ip']) {
    const val = req.headers.get(h);
    if (val) return val.split(',')[0].trim();
  }
  return '0.0.0.0';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ✅ Rate limiting por IP (3 cadastros por minuto)
    const clientIP = getClientIP(req);
    const rl = checkInMemoryRateLimit(`processar-cadastro:${clientIP}`, 3, 60000);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: 'Muitas tentativas. Aguarde e tente novamente.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } }
      );
    }

    // ✅ Validação rigorosa de input
    const rawBody = await req.json();
    const { token, userData } = validateInput(RequestSchema, rawBody);

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
      console.log('[PROCESSAR-CADASTRO] Convite não encontrado')
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
      console.log('[PROCESSAR-CADASTRO] Transportadora não encontrada')
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
      console.log('[PROCESSAR-CADASTRO] Erro ao criar usuário:', authError.message)
      throw new Error('Erro ao criar conta. Verifique se o e-mail já está em uso.')
    }

    const user = authData.user
    console.log('[PROCESSAR-CADASTRO] Usuário criado:', user.id)

    // 4. Criar profile do motorista
    const profileData: Record<string, unknown> = {
      user_id: user.id,
      full_name: userData.fullName,
      email: userData.email,
      phone: userData.phone,
      document: userData.cpf,
      cpf_cnpj: userData.cpf,
      role: 'MOTORISTA_AFILIADO',
      status: 'APPROVED'
    }

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
      console.log('[PROCESSAR-CADASTRO] Erro ao vincular motorista:', vinculoError.message)
      throw vinculoError
    }

    console.log('[PROCESSAR-CADASTRO] Motorista vinculado à transportadora')

    // 6. Criar veículo se fornecido
    if (userData.vehicle?.plate) {
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
        console.error('[PROCESSAR-CADASTRO] Erro ao criar veículo:', vehicleError.message)
      }
    }

    // 7. Marcar convite como usado
    await supabaseAdmin
      .from('convites_motoristas')
      .update({
        usado: true,
        usado_em: new Date().toISOString(),
        usado_por: profile.id
      })
      .eq('token', token)

    // 8. Criar notificação para a transportadora
    await supabaseAdmin
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
  } catch (error: unknown) {
    // validateInput throws Response objects
    if (error instanceof Response) {
      const headers = new Headers(error.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      if (!headers.get('Content-Type')) headers.set('Content-Type', 'application/json');
      return new Response(error.body, { status: error.status, statusText: error.statusText, headers });
    }

    console.error('[PROCESSAR-CADASTRO] Erro:', (error as Error).message)
    return new Response(
      JSON.stringify({ error: 'Erro ao processar cadastro' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})

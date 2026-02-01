import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { validateInput, uuidSchema, documentNumberSchema } from '../_shared/validation.ts'
import { withRateLimit, createRateLimitResponse } from '../_shared/rate-limiter.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BodySchema = z.object({
  company_id: uuidSchema,
  full_name: z.string().min(2).max(200),
  cpf_cnpj: documentNumberSchema,
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server misconfigured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Client scoped to the caller (authZ)
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Rate limit (defense-in-depth)
    const rl = await withRateLimit(req, supabaseClient, 'provision-affiliated-driver', user.id, {
      maxRequestsPerMinute: 10,
      maxRequestsPerHour: 60,
      burstLimit: 3,
      blockDurationMinutes: 5,
    })
    if (!rl.allowed) {
      return createRateLimitResponse(rl, corsHeaders)
    }

    const rawBody = await req.json()
    const body = validateInput(BodySchema, rawBody)

    // Admin client (DB writes regardless of RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // 1) Ensure company exists
    const { data: company, error: companyError } = await supabaseAdmin
      .from('transport_companies')
      .select('id, profile_id, status')
      .eq('id', body.company_id)
      .single()

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: 'Transportadora não encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // 2) Find existing affiliated driver profile for this user
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, status, role, active_mode')
      .eq('user_id', user.id)
      .eq('role', 'MOTORISTA_AFILIADO')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let profileId = existingProfile?.id as string | undefined
    let profileStatus = (existingProfile as any)?.status as string | undefined

    if (!profileId) {
      // Create profile deterministically (no triggers needed)
      const { data: created, error: createError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: user.id,
          full_name: body.full_name,
          cpf_cnpj: body.cpf_cnpj,
          document: body.cpf_cnpj,
          phone: body.phone ?? undefined,
          email: body.email ?? user.email ?? undefined,
          role: 'MOTORISTA_AFILIADO',
          active_mode: 'MOTORISTA_AFILIADO',
          status: 'PENDING',
          background_check_status: 'PENDING',
        })
        .select('id, status')
        .single()

      if (createError || !created) {
        console.error('[provision-affiliated-driver] create profile error:', createError)
        return new Response(
          JSON.stringify({ error: 'Falha ao criar perfil' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      profileId = created.id
      profileStatus = (created as any).status
    } else {
      // Ensure expected fields are set (idempotent repair)
      await supabaseAdmin
        .from('profiles')
        .update({
          // Only set what we can safely normalize for the current user
          active_mode: 'MOTORISTA_AFILIADO',
          role: 'MOTORISTA_AFILIADO',
          phone: body.phone ?? undefined,
          email: body.email ?? user.email ?? undefined,
        })
        .eq('id', profileId)
    }

    // 3) Ensure link in company_drivers
    const { data: existingLink } = await supabaseAdmin
      .from('company_drivers')
      .select('id, status')
      .eq('company_id', body.company_id)
      .eq('driver_profile_id', profileId)
      .maybeSingle()

    let companyDriverId: string | undefined
    let companyDriverStatus: string | undefined

    if (existingLink?.id) {
      companyDriverId = existingLink.id
      companyDriverStatus = (existingLink as any).status
    } else {
      const { data: createdLink, error: linkError } = await supabaseAdmin
        .from('company_drivers')
        .insert({
          company_id: body.company_id,
          driver_profile_id: profileId,
          invited_by: company.profile_id,
          status: 'PENDING',
          affiliation_type: 'AFFILIATED',
          can_accept_freights: false,
          can_manage_vehicles: false,
          notes: 'Cadastro iniciado - aguardando aprovação',
        })
        .select('id, status')
        .single()

      if (linkError || !createdLink) {
        console.error('[provision-affiliated-driver] create link error:', linkError)
        return new Response(
          JSON.stringify({ error: 'Falha ao criar vínculo com transportadora' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      companyDriverId = createdLink.id
      companyDriverStatus = (createdLink as any).status
    }

    return new Response(
      JSON.stringify({
        profileId,
        profileStatus,
        companyDriverId,
        companyDriverStatus,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    // validateInput may throw a Response
    if (error instanceof Response) {
      const headers = new Headers(error.headers)
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v))
      if (!headers.get('Content-Type')) headers.set('Content-Type', 'application/json')

      return new Response(error.body, {
        status: error.status,
        statusText: error.statusText,
        headers,
      })
    }

    console.error('[provision-affiliated-driver] error:', error)
    return new Response(
      JSON.stringify({ error: (error as any)?.message ?? 'Erro interno' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

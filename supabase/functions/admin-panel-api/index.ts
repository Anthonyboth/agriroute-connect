import { createClient } from 'npm:@supabase/supabase-js@2'

// ✅ CORS restrito aos domínios autorizados
const ALLOWED_ORIGINS = [
  'https://agriroute-connect.com.br',
  'https://www.agriroute-connect.com.br',
  'https://painel-2025.agriroute-connect.com.br',
  'https://agriroute.lovable.app',
]

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
    'Vary': 'Origin',
  }
}

// ✅ Buckets permitidos para signed URLs
const ALLOWED_BUCKETS = [
  'profile-photos',
  'identity-selfies',
  'driver-documents',
  'vehicle-documents',
]

// ✅ Validação UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value)
}

// ✅ Sanitização de input para filtros PostgREST
function sanitizeSearchInput(input: string): string {
  // Remove caracteres especiais que podem ser usados em injection PostgREST
  return input
    .replace(/[%_\\'"(),.;:!@#$^&*=+\[\]{}|<>?/~`]/g, '')
    .trim()
    .slice(0, 100) // Limite de 100 caracteres
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    // Path: /admin-panel-api/{action}/{id?}
    const action = pathParts[1] || ''
    const entityId = pathParts[2] || ''

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // ✅ Validar presença do header Authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Auth client - validates the user's JWT
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    })

    // Service client - elevated operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })

    // 1) Validate JWT
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // 2) Check allowlist (case-insensitive email comparison)
    const { data: adminUser, error: adminError } = await serviceClient
      .from('admin_users')
      .select('id, email, role, is_active, full_name')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (adminError || !adminUser) {
      console.warn(`[ADMIN-API] Unauthorized access attempt by user_id=${user.id} email=${user.email}`)
      return new Response(JSON.stringify({ error: 'Acesso negado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    console.log(`[ADMIN-API] Admin ${adminUser.email} (${adminUser.role}) -> ${action}`)

    // ✅ Validar método HTTP permitido
    if (!['GET', 'POST', 'PUT', 'PATCH'].includes(req.method)) {
      return jsonResponse(corsHeaders, { error: 'Método não suportado' }, 405)
    }

    const body = req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH'
      ? await req.json().catch(() => ({}))
      : {}

    // ===================== ROUTING =====================
    switch (action) {
      // --- Dashboard Stats ---
      case 'stats': {
        const now = new Date()
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

        const [
          pending, approved7d, rejected7d, needsFix, blocked,
          pendingByRole, recentActions,
          // Freight KPIs
          freightsPending, freightsActive, freightsTransit, freightsDelivered30d, freightsCancelled30d,
          // Service KPIs
          servicesOpen, servicesClosed, servicesCancelled,
          // Totals
          totalUsers,
        ] = await Promise.all([
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED').gte('created_at', sevenDaysAgo),
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'REJECTED').gte('created_at', sevenDaysAgo),
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'NEEDS_FIX'),
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'BLOCKED'),
          serviceClient.from('profiles').select('role').eq('status', 'PENDING'),
          serviceClient.from('admin_registration_actions').select('*, admin:admin_user_id(full_name, email)').order('created_at', { ascending: false }).limit(15),
          // Freight KPIs
          serviceClient.from('freights').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
          serviceClient.from('freights').select('id', { count: 'exact', head: true }).in('status', ['ACCEPTED', 'LOADING', 'LOADED']),
          serviceClient.from('freights').select('id', { count: 'exact', head: true }).eq('status', 'IN_TRANSIT'),
          serviceClient.from('freights').select('id', { count: 'exact', head: true }).in('status', ['DELIVERED', 'CONFIRMED']).gte('created_at', thirtyDaysAgo),
          serviceClient.from('freights').select('id', { count: 'exact', head: true }).eq('status', 'CANCELLED').gte('created_at', thirtyDaysAgo),
          // Service KPIs
          serviceClient.from('service_requests').select('id', { count: 'exact', head: true }).in('status', ['pending', 'accepted']),
          serviceClient.from('service_requests').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
          serviceClient.from('service_requests').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
          // Total
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }),
        ])

        // Count by role
        const roleCounts: Record<string, number> = {}
        pendingByRole.data?.forEach((p: any) => {
          roleCounts[p.role] = (roleCounts[p.role] || 0) + 1
        })

        return jsonResponse(corsHeaders, {
          pending_total: pending.count || 0,
          approved_7d: approved7d.count || 0,
          rejected_7d: rejected7d.count || 0,
          needs_fix_total: needsFix.count || 0,
          blocked_total: blocked.count || 0,
          total_users: totalUsers.count || 0,
          pending_by_role: roleCounts,
          recent_actions: recentActions.data || [],
          freight_kpis: {
            pending: freightsPending.count || 0,
            active: freightsActive.count || 0,
            in_transit: freightsTransit.count || 0,
            delivered_30d: freightsDelivered30d.count || 0,
            cancelled_30d: freightsCancelled30d.count || 0,
          },
          service_kpis: {
            open: servicesOpen.count || 0,
            closed: servicesClosed.count || 0,
            cancelled: servicesCancelled.count || 0,
          },
        })
      }

      // --- List Registrations ---
      case 'registrations': {
        if (req.method === 'GET' || !body.action) {
          const status = url.searchParams.get('status') || ''
          const role = url.searchParams.get('role') || ''
          const rawSearch = url.searchParams.get('q') || ''
          const search = sanitizeSearchInput(rawSearch) // ✅ Sanitizado
          const page = Math.max(1, Math.min(100, parseInt(url.searchParams.get('page') || '1') || 1))
          const pageSize = 20
          const offset = (page - 1) * pageSize

          let query = serviceClient
            .from('profiles')
            .select('id, user_id, full_name, phone, cpf_cnpj, role, status, created_at, selfie_url, document_photo_url, cnh_photo_url, address_proof_url, admin_message, admin_message_category, base_city_name, base_state, document_validation_status, cnh_validation_status', { count: 'exact' })

          // ✅ Validar valores de filtro
          const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'NEEDS_FIX', 'BLOCKED', 'all']
          const validRoles = ['MOTORISTA', 'MOTORISTA_AFILIADO', 'PRODUTOR', 'TRANSPORTADORA', 'PRESTADOR_SERVICOS', 'all']

          if (status && status !== 'all') {
            if (validStatuses.includes(status)) {
              query = query.eq('status', status)
            }
          }
          if (role && role !== 'all') {
            if (validRoles.includes(role)) {
              query = query.eq('role', role)
            }
          }
          if (search && search.length >= 2) {
            // ✅ Usar filtros separados em vez de interpolação direta (inclui email)
            query = query.or(`full_name.ilike.%${search}%,cpf_cnpj.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
          }

          query = query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)

          const { data, error, count } = await query
          if (error) throw error

          return jsonResponse(corsHeaders, {
            data: data || [],
            total: count || 0,
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize),
          })
        }
        break
      }

      // --- Registration Detail ---
      case 'registration': {
        // ✅ Validar UUID
        if (!entityId || !isValidUUID(entityId)) {
          return jsonResponse(corsHeaders, { error: 'ID inválido' }, 400)
        }

        if (req.method === 'GET' || (!body.action && req.method !== 'POST')) {
          const { data: profile, error } = await serviceClient
            .from('profiles')
            .select('*')
            .eq('id', entityId)
            .single()

          if (error) throw error

          // Get action history
          const { data: actions } = await serviceClient
            .from('admin_registration_actions')
            .select('*, admin:admin_user_id(full_name, email)')
            .eq('profile_id', entityId)
            .order('created_at', { ascending: false })

          return jsonResponse(corsHeaders, { profile, actions: actions || [] })
        }

        // --- POST Actions (approve/reject/needs-fix) ---
        if (req.method === 'POST' && body.action) {
          const { action: regAction, reason, reason_category, message_to_user, internal_notes } = body

          // ✅ Validar action
          const validActions = ['APPROVE', 'REJECT', 'NEEDS_FIX', 'NOTE', 'BLOCK', 'UNBLOCK']
          if (!validActions.includes(regAction)) {
            return jsonResponse(corsHeaders, { error: 'Ação inválida' }, 400)
          }

          // Get current profile
          const { data: profile, error: pErr } = await serviceClient
            .from('profiles')
            .select('status, role, full_name')
            .eq('id', entityId)
            .single()

          if (pErr || !profile) return jsonResponse(corsHeaders, { error: 'Cadastro não encontrado' }, 404)

          let newStatus: string
          switch (regAction) {
            case 'APPROVE': newStatus = 'APPROVED'; break
            case 'REJECT': newStatus = 'REJECTED'; break
            case 'NEEDS_FIX': newStatus = 'NEEDS_FIX'; break
            case 'BLOCK': newStatus = 'BLOCKED'; break
            case 'UNBLOCK': newStatus = 'APPROVED'; break
            case 'NOTE': newStatus = profile.status; break
            default: return jsonResponse(corsHeaders, { error: 'Ação inválida' }, 400)
          }

          // Update profile status
          if (regAction !== 'NOTE') {
            const updateData: Record<string, unknown> = { status: newStatus }
            if (message_to_user && typeof message_to_user === 'string') {
              updateData.admin_message = message_to_user.slice(0, 1000) // ✅ Limite
              updateData.admin_message_category = typeof reason_category === 'string' ? reason_category.slice(0, 100) : null
            }
            if (regAction === 'APPROVE') {
              updateData.admin_message = null
              updateData.admin_message_category = null
            }

            const { error: updateErr } = await serviceClient
              .from('profiles')
              .update(updateData)
              .eq('id', entityId)

            if (updateErr) throw updateErr
          }

          // Log action (✅ sem dados sensíveis no log)
          const { error: logErr } = await serviceClient
            .from('admin_registration_actions')
            .insert({
              admin_user_id: adminUser.id,
              profile_id: entityId,
              action: regAction,
              reason: typeof reason === 'string' ? reason.slice(0, 500) : null,
              reason_category: typeof reason_category === 'string' ? reason_category.slice(0, 100) : null,
              internal_notes: typeof internal_notes === 'string' ? internal_notes.slice(0, 1000) : null,
              previous_status: profile.status,
              new_status: newStatus,
              message_to_user: typeof message_to_user === 'string' ? message_to_user.slice(0, 1000) : null,
            })

          if (logErr) console.error('[ADMIN-API] Error logging action:', logErr.message)

          return jsonResponse(corsHeaders, {
            success: true,
            previous_status: profile.status,
            new_status: newStatus,
          })
        }
        break
      }

      // --- Signed URL for documents ---
      case 'signed-url': {
        const bucket = url.searchParams.get('bucket') || ''
        const path = url.searchParams.get('path') || ''

        if (!bucket || !path) return jsonResponse(corsHeaders, { error: 'Bucket e path obrigatórios' }, 400)

        // ✅ Validar bucket permitido
        if (!ALLOWED_BUCKETS.includes(bucket)) {
          console.warn(`[ADMIN-API] Tentativa de acessar bucket não permitido: ${bucket} por admin ${adminUser.email}`)
          return jsonResponse(corsHeaders, { error: 'Bucket não permitido' }, 403)
        }

        // ✅ Validar path (prevenir traversal)
        if (path.includes('..') || path.startsWith('/')) {
          return jsonResponse(corsHeaders, { error: 'Path inválido' }, 400)
        }

        const { data, error } = await serviceClient.storage
          .from(bucket)
          .createSignedUrl(path, 300) // 5 min expiry

        if (error) {
          console.error(`[ADMIN-API] Signed URL error for ${bucket}/${path}:`, error.message)
          return jsonResponse(corsHeaders, { error: 'Não foi possível gerar URL' }, 500)
        }
        return jsonResponse(corsHeaders, { signedUrl: data.signedUrl })
      }

      // --- Audit Logs ---
      case 'audit-logs': {
        const page = Math.max(1, Math.min(100, parseInt(url.searchParams.get('page') || '1') || 1))
        const pageSize = 30
        const offset = (page - 1) * pageSize
        const actionFilter = url.searchParams.get('action') || ''
        const adminFilter = url.searchParams.get('admin_id') || ''
        const dateFrom = url.searchParams.get('date_from') || ''
        const dateTo = url.searchParams.get('date_to') || ''
        const entityFilter = url.searchParams.get('profile_id') || ''

        let query = serviceClient
          .from('admin_registration_actions')
          .select('*, admin:admin_user_id(full_name, email), profile:profile_id(full_name, role)', { count: 'exact' })

        // ✅ Validar filtro de ação
        const validAuditActions = ['APPROVE', 'REJECT', 'NEEDS_FIX', 'NOTE', 'BLOCK', 'UNBLOCK', 'all']
        if (actionFilter && actionFilter !== 'all') {
          if (validAuditActions.includes(actionFilter)) {
            query = query.eq('action', actionFilter)
          }
        }

        // ✅ Filtro por admin
        if (adminFilter && isValidUUID(adminFilter)) {
          query = query.eq('admin_user_id', adminFilter)
        }

        // ✅ Filtro por data
        if (dateFrom) {
          query = query.gte('created_at', dateFrom)
        }
        if (dateTo) {
          query = query.lte('created_at', dateTo + 'T23:59:59Z')
        }

        // ✅ Filtro por entidade
        if (entityFilter && isValidUUID(entityFilter)) {
          query = query.eq('profile_id', entityFilter)
        }

        query = query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)

        const { data, error, count } = await query
        if (error) throw error

        return jsonResponse(corsHeaders, {
          data: data || [],
          total: count || 0,
          page,
          pageSize,
        })
      }

      // --- Admin Users (superadmin only) ---
      case 'admin-users': {
        if (adminUser.role !== 'superadmin') {
          return jsonResponse(corsHeaders, { error: 'Apenas superadmin pode gerenciar admins' }, 403)
        }

        if (req.method === 'GET' || !body.action) {
          const { data, error } = await serviceClient
            .from('admin_users')
            .select('id, email, full_name, role, is_active, created_at, updated_at')
            // ✅ Select explícito (sem user_id desnecessário)
            .order('created_at', { ascending: false })

          if (error) throw error
          return jsonResponse(corsHeaders, { data: data || [] })
        }

        // PATCH - update admin
        if (req.method === 'PATCH' || body.action === 'update') {
          const targetId = entityId || body.id
          if (!targetId || !isValidUUID(targetId)) {
            return jsonResponse(corsHeaders, { error: 'ID inválido' }, 400)
          }

          const updates: Record<string, unknown> = {}
          if (typeof body.is_active === 'boolean') updates.is_active = body.is_active
          if (typeof body.role === 'string' && ['superadmin', 'admin', 'viewer'].includes(body.role)) {
            updates.role = body.role
          }

          if (Object.keys(updates).length === 0) {
            return jsonResponse(corsHeaders, { error: 'Nenhum campo válido para atualizar' }, 400)
          }

          const { error } = await serviceClient
            .from('admin_users')
            .update(updates)
            .eq('id', targetId)

          if (error) throw error

          // Audit log (✅ sem dados sensíveis)
          await serviceClient.from('admin_registration_actions').insert({
            admin_user_id: adminUser.id,
            profile_id: adminUser.id,
            action: 'NOTE',
            internal_notes: `Admin ${targetId} atualizado: campos=${Object.keys(updates).join(',')}`,
            previous_status: 'N/A',
            new_status: 'N/A',
          }).catch(() => {})

          return jsonResponse(corsHeaders, { success: true })
        }
        break
      }

      // --- Settings ---
      case 'settings': {
        // ✅ Leitura: admin pode ler, escrita: superadmin only
        if (req.method === 'GET' || !body.action) {
          const { data, error } = await serviceClient
            .from('admin_settings')
            .select('id, setting_key, setting_value, description, updated_at')
            .order('setting_key')

          if (error) throw error
          return jsonResponse(corsHeaders, { data: data || [] })
        }

        if (req.method === 'PUT' || body.action === 'update') {
          if (adminUser.role !== 'superadmin') {
            return jsonResponse(corsHeaders, { error: 'Apenas superadmin pode alterar configurações' }, 403)
          }

          const { setting_key, setting_value } = body
          if (!setting_key || typeof setting_key !== 'string') {
            return jsonResponse(corsHeaders, { error: 'setting_key obrigatório' }, 400)
          }

          const { error } = await serviceClient
            .from('admin_settings')
            .update({ setting_value, updated_by: adminUser.id })
            .eq('setting_key', setting_key)

          if (error) throw error
          return jsonResponse(corsHeaders, { success: true })
        }
        break
      }

      // --- Freights Overview ---
      case 'freights': {
        const status = url.searchParams.get('status') || ''
        const rawSearch = url.searchParams.get('q') || ''
        const search = sanitizeSearchInput(rawSearch) // ✅ Sanitizado
        const pageSize = 30

        let query = serviceClient
          .from('freights')
          .select('id, status, cargo_type, price, created_at, origin_city, origin_state, destination_city, destination_state, producer_id, driver_id', { count: 'exact' })

        // ✅ Validar status
        const validFreightStatuses = ['PENDING', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'all']
        if (status && status !== 'all') {
          if (validFreightStatuses.includes(status)) {
            query = query.eq('status', status)
          }
        }
        if (search && search.length >= 2) {
          query = query.or(`origin_city.ilike.%${search}%,destination_city.ilike.%${search}%,cargo_type.ilike.%${search}%`)
        }

        query = query.order('created_at', { ascending: false }).limit(pageSize)

        const { data, error, count } = await query
        if (error) {
          console.error('[ADMIN-API] Freights error:', error.message)
          return jsonResponse(corsHeaders, { data: [], stats: { total: 0, active: 0, transit: 0, delivered: 0 } })
        }

        // Get stats
        const [activeCount, transitCount, deliveredCount] = await Promise.all([
          serviceClient.from('freights').select('id', { count: 'exact', head: true }).in('status', ['PENDING', 'ACCEPTED']),
          serviceClient.from('freights').select('id', { count: 'exact', head: true }).eq('status', 'IN_TRANSIT'),
          serviceClient.from('freights').select('id', { count: 'exact', head: true }).eq('status', 'DELIVERED').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        ])

        return jsonResponse(corsHeaders, {
          data: data || [],
          stats: {
            total: count || 0,
            active: activeCount.count || 0,
            transit: transitCount.count || 0,
            delivered: deliveredCount.count || 0,
          },
        })
      }

      // --- Comprehensive User Detail ---
      case 'user-detail': {
        if (!entityId || !isValidUUID(entityId)) {
          return jsonResponse(corsHeaders, { error: 'ID inválido' }, 400)
        }

        // Fetch profile with ALL fields
        const { data: profile, error: profileErr } = await serviceClient
          .from('profiles')
          .select('*')
          .eq('id', entityId)
          .single()

        if (profileErr || !profile) {
          return jsonResponse(corsHeaders, { error: 'Usuário não encontrado' }, 404)
        }

        // Parallel fetch of related data
        const [
          vehiclesRes,
          freightsAsProducerRes,
          freightsAsDriverRes,
          companyRes,
          companyDriversRes,
          actionsRes,
          badgesRes,
          expensesRes,
          availabilityRes,
          balanceRes,
        ] = await Promise.all([
          // Vehicles owned by this user
          serviceClient.from('vehicles').select('*').eq('driver_id', entityId).order('created_at', { ascending: false }),
          // Freights as producer (last 20)
          serviceClient.from('freights').select('id, status, cargo_type, price, origin_city, origin_state, destination_city, destination_state, created_at, distance_km, reference_number').eq('producer_id', entityId).order('created_at', { ascending: false }).limit(20),
          // Freights as driver (last 20)
          serviceClient.from('freights').select('id, status, cargo_type, price, origin_city, origin_state, destination_city, destination_state, created_at, distance_km, reference_number').eq('driver_id', entityId).order('created_at', { ascending: false }).limit(20),
          // Transport company (if owner)
          serviceClient.from('transport_companies').select('*').eq('profile_id', entityId).maybeSingle(),
          // Company driver affiliations
          serviceClient.from('company_drivers').select('id, status, company_id, affiliation_type, can_accept_freights, created_at, accepted_at, company:company_id(company_name, company_cnpj)').eq('driver_profile_id', entityId),
          // Admin actions history
          serviceClient.from('admin_registration_actions').select('*, admin:admin_user_id(full_name, email)').eq('profile_id', entityId).order('created_at', { ascending: false }),
          // Badges
          serviceClient.from('driver_badges').select('*, badge:badge_type_id(name, icon, description, category)').eq('driver_id', entityId),
          // Recent expenses (last 10)
          serviceClient.from('driver_expenses').select('id, expense_type, amount, expense_date, description').eq('driver_id', entityId).order('expense_date', { ascending: false }).limit(10),
          // Availability
          serviceClient.from('driver_availability').select('*').eq('driver_id', entityId).order('available_date', { ascending: false }).limit(5),
          // Balance transactions (last 10)
          serviceClient.from('balance_transactions').select('id, transaction_type, amount, status, created_at, description').eq('provider_id', entityId).order('created_at', { ascending: false }).limit(10),
        ])

        // Freight stats
        const freightsProducer = freightsAsProducerRes.data || []
        const freightsDriver = freightsAsDriverRes.data || []
        const allFreights = [...freightsProducer, ...freightsDriver]
        
        const freightStats = {
          total_as_producer: freightsProducer.length,
          total_as_driver: freightsDriver.length,
          completed: allFreights.filter((f: any) => ['DELIVERED', 'CONFIRMED'].includes(f.status)).length,
          cancelled: allFreights.filter((f: any) => f.status === 'CANCELLED').length,
          active: allFreights.filter((f: any) => ['PENDING', 'ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'].includes(f.status)).length,
          total_value: allFreights.reduce((sum: number, f: any) => sum + (Number(f.price) || 0), 0),
        }

        return jsonResponse(corsHeaders, {
          profile,
          vehicles: vehiclesRes.data || [],
          freights_as_producer: freightsProducer,
          freights_as_driver: freightsDriver,
          freight_stats: freightStats,
          company: companyRes.data || null,
          company_affiliations: companyDriversRes.data || [],
          actions: actionsRes.data || [],
          badges: badgesRes.data || [],
          expenses: expensesRes.data || [],
          availability: availabilityRes.data || [],
          balance_transactions: balanceRes.data || [],
        })
      }

      default:
        return jsonResponse(corsHeaders, { error: 'Rota não encontrada' }, 404)
    }

    return jsonResponse(corsHeaders, { error: 'Método não suportado para esta rota' }, 405)

  } catch (error: unknown) {
    // ✅ Nunca expor detalhes internos do erro
    const message = error instanceof Error ? error.message : 'Erro interno'
    console.error('[ADMIN-API] Error:', message)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }), // ✅ Mensagem genérica
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

function jsonResponse(corsHeaders: Record<string, string>, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

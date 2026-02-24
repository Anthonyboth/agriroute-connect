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
  const isPreview = origin.includes('.lovable.app') || origin.includes('localhost')
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : isPreview ? origin : ALLOWED_ORIGINS[0]
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
  'freight-attachments',
]

// ✅ Validação UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value)
}

// ✅ Sanitização de input para filtros PostgREST
function sanitizeSearchInput(input: string): string {
  return input
    .replace(/[%_\\'"(),.;:!@#$^&*=+\[\]{}|<>?/~`]/g, '')
    .trim()
    .slice(0, 100)
}

function clampInt(val: string | null, min: number, max: number, fallback: number): number {
  const n = parseInt(val || '') || fallback
  return Math.max(min, Math.min(max, n))
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const action = pathParts[1] || ''
    const entityId = pathParts[2] || ''
    const subAction = pathParts[3] || ''

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // ✅ Validar presença do header Authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse(corsHeaders, { error: 'Não autenticado' }, 401)
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    })
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })

    // 1) Validate JWT
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return jsonResponse(corsHeaders, { error: 'Não autenticado' }, 401)
    }

    // 2) Check allowlist
    const { data: adminUser, error: adminError } = await serviceClient
      .from('admin_users')
      .select('id, email, role, is_active, full_name')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (adminError || !adminUser) {
      console.warn(`[ADMIN-API] Unauthorized access attempt by user_id=${user.id}`)
      return jsonResponse(corsHeaders, { error: 'Acesso negado' }, 403)
    }

    console.log(`[ADMIN-API] Admin ${adminUser.email} (${adminUser.role}) -> ${action}/${entityId}${subAction ? '/' + subAction : ''}`)

    if (!['GET', 'POST', 'PUT', 'PATCH'].includes(req.method)) {
      return jsonResponse(corsHeaders, { error: 'Método não suportado' }, 405)
    }

    const body = req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH'
      ? await req.json().catch(() => ({}))
      : {}

    // ===================== ROUTING =====================
    switch (action) {

      // ==================== DASHBOARD STATS ====================
      case 'stats': {
        const now = new Date()
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

        const [
          pending, approved7d, rejected7d, needsFix, blocked,
          pendingByRole, recentActions,
          freightsPending, freightsActive, freightsTransit, freightsDelivered30d, freightsCancelled30d,
          servicesOpen, servicesClosed, servicesCancelled,
          totalUsers,
        ] = await Promise.all([
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED').gte('created_at', sevenDaysAgo),
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'REJECTED').gte('created_at', sevenDaysAgo),
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'NEEDS_FIX'),
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'BLOCKED'),
          serviceClient.from('profiles').select('role').eq('status', 'PENDING'),
          serviceClient.from('admin_registration_actions').select('*, admin:admin_user_id(full_name, email)').order('created_at', { ascending: false }).limit(15),
          serviceClient.from('freights').select('id', { count: 'exact', head: true }).in('status', ['NEW', 'APPROVED', 'OPEN']),
          serviceClient.from('freights').select('id', { count: 'exact', head: true }).in('status', ['ACCEPTED', 'LOADING', 'LOADED']),
          serviceClient.from('freights').select('id', { count: 'exact', head: true }).eq('status', 'IN_TRANSIT'),
          serviceClient.from('freights').select('id', { count: 'exact', head: true }).in('status', ['DELIVERED', 'DELIVERED_PENDING_CONFIRMATION', 'COMPLETED']).gte('created_at', thirtyDaysAgo),
          serviceClient.from('freights').select('id', { count: 'exact', head: true }).eq('status', 'CANCELLED').gte('created_at', thirtyDaysAgo),
          serviceClient.from('service_requests').select('id', { count: 'exact', head: true }).in('status', ['pending', 'accepted']),
          serviceClient.from('service_requests').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
          serviceClient.from('service_requests').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }),
        ])

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

      // ==================== REGISTRATIONS ====================
      case 'registrations': {
        if (req.method === 'GET' || !body.action) {
          const status = url.searchParams.get('status') || ''
          const role = url.searchParams.get('role') || ''
          const rawSearch = url.searchParams.get('q') || ''
          const search = sanitizeSearchInput(rawSearch)
          const page = clampInt(url.searchParams.get('page'), 1, 100, 1)
          const pageSize = 20
          const offset = (page - 1) * pageSize

          let query = serviceClient
            .from('profiles')
            .select('id, user_id, full_name, phone, cpf_cnpj, role, status, created_at, selfie_url, document_photo_url, cnh_photo_url, address_proof_url, admin_message, admin_message_category, base_city_name, base_state, document_validation_status, cnh_validation_status', { count: 'exact' })

          const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'NEEDS_FIX', 'BLOCKED', 'all']
          const validRoles = ['MOTORISTA', 'MOTORISTA_AFILIADO', 'PRODUTOR', 'TRANSPORTADORA', 'PRESTADOR_SERVICOS', 'all']

          if (status && status !== 'all' && validStatuses.includes(status)) {
            query = query.eq('status', status)
          }
          if (role && role !== 'all' && validRoles.includes(role)) {
            query = query.eq('role', role)
          }
          if (search && search.length >= 2) {
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

      // ==================== REGISTRATION DETAIL ====================
      case 'registration': {
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

          const { data: actions } = await serviceClient
            .from('admin_registration_actions')
            .select('*, admin:admin_user_id(full_name, email)')
            .eq('profile_id', entityId)
            .order('created_at', { ascending: false })

          return jsonResponse(corsHeaders, { profile, actions: actions || [] })
        }

        if (req.method === 'POST' && body.action) {
          const { action: regAction, reason, reason_category, message_to_user, internal_notes } = body
          const validActions = ['APPROVE', 'REJECT', 'NEEDS_FIX', 'NOTE', 'BLOCK', 'UNBLOCK']
          if (!validActions.includes(regAction)) {
            return jsonResponse(corsHeaders, { error: 'Ação inválida' }, 400)
          }

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

          if (regAction !== 'NOTE') {
            const updateData: Record<string, unknown> = { status: newStatus }
            if (message_to_user && typeof message_to_user === 'string') {
              updateData.admin_message = message_to_user.slice(0, 1000)
              updateData.admin_message_category = typeof reason_category === 'string' ? reason_category.slice(0, 100) : null
            }
            if (regAction === 'APPROVE') {
              updateData.admin_message = null
              updateData.admin_message_category = null
            }
            const { error: updateErr } = await serviceClient.from('profiles').update(updateData).eq('id', entityId)
            if (updateErr) throw updateErr
          }

          await serviceClient.from('admin_registration_actions').insert({
            admin_user_id: adminUser.id,
            profile_id: entityId,
            action: regAction,
            reason: typeof reason === 'string' ? reason.slice(0, 500) : null,
            reason_category: typeof reason_category === 'string' ? reason_category.slice(0, 100) : null,
            internal_notes: typeof internal_notes === 'string' ? internal_notes.slice(0, 1000) : null,
            previous_status: profile.status,
            new_status: newStatus,
            message_to_user: typeof message_to_user === 'string' ? message_to_user.slice(0, 1000) : null,
          }).catch((e) => console.error('[ADMIN-API] Error logging action:', e?.message))

          return jsonResponse(corsHeaders, { success: true, previous_status: profile.status, new_status: newStatus })
        }
        break
      }

      // ==================== REGISTRATION VALIDATION ====================
      case 'registration-validation': {
        if (!entityId || !isValidUUID(entityId)) return jsonResponse(corsHeaders, { error: 'ID inválido' }, 400)
        if (req.method !== 'POST') return jsonResponse(corsHeaders, { error: 'Método não suportado' }, 405)

        const { field, status, notes } = body
        const allowedFields = ['document_validation_status', 'cnh_validation_status', 'rntrc_validation_status', 'validation_status', 'background_check_status']
        const normalizedStatus = typeof status === 'string' ? status.toUpperCase() : ''
        const allowedStatuses = ['PENDING', 'VALIDATED', 'APPROVED', 'REJECTED']

        if (!allowedFields.includes(field)) return jsonResponse(corsHeaders, { error: 'Campo inválido' }, 400)
        if (!allowedStatuses.includes(normalizedStatus)) return jsonResponse(corsHeaders, { error: 'Status inválido' }, 400)

        const dbStatus = field === 'background_check_status'
          ? normalizedStatus === 'VALIDATED' ? 'APPROVED' : normalizedStatus
          : normalizedStatus === 'APPROVED' ? 'VALIDATED' : normalizedStatus

        const { data: profile, error: profileError } = await serviceClient
          .from('profiles')
          .select('status, document_validation_status, cnh_validation_status, rntrc_validation_status, validation_status, background_check_status')
          .eq('id', entityId)
          .single()

        if (profileError || !profile) return jsonResponse(corsHeaders, { error: 'Não encontrado' }, 404)

        const { data: adminProfile } = await serviceClient.from('profiles').select('id').eq('user_id', user.id).maybeSingle()

        const updateData: Record<string, unknown> = { [field]: dbStatus }
        if (typeof notes === 'string') updateData.validation_notes = notes.slice(0, 1000)
        if (field === 'validation_status') {
          if (dbStatus === 'PENDING') { updateData.validated_at = null; updateData.validated_by = null }
          else { updateData.validated_at = new Date().toISOString(); updateData.validated_by = adminProfile?.id || null }
        }

        const { error: updateError } = await serviceClient.from('profiles').update(updateData).eq('id', entityId)
        if (updateError) throw updateError

        const previousValue = (profile as Record<string, unknown>)[field]
        await serviceClient.from('admin_registration_actions').insert({
          admin_user_id: adminUser.id,
          profile_id: entityId,
          action: 'NOTE',
          reason_category: 'VALIDATION',
          internal_notes: typeof notes === 'string' && notes.trim().length > 0 ? notes.slice(0, 1000) : `Validação ${field} alterada para ${dbStatus}`,
          previous_status: profile.status,
          new_status: profile.status,
          metadata: { validation_field: field, previous_validation_status: previousValue, new_validation_status: dbStatus },
        }).catch((e) => console.error('[ADMIN-API] Error logging validation:', e?.message))

        return jsonResponse(corsHeaders, { success: true, field, previous_status: previousValue, new_status: dbStatus })
      }

      // ==================== SIGNED URL ====================
      case 'signed-url': {
        const bucket = url.searchParams.get('bucket') || ''
        const path = url.searchParams.get('path') || ''
        if (!bucket || !path) return jsonResponse(corsHeaders, { error: 'Bucket e path obrigatórios' }, 400)
        if (!ALLOWED_BUCKETS.includes(bucket)) return jsonResponse(corsHeaders, { error: 'Bucket não permitido' }, 403)
        if (path.includes('..') || path.startsWith('/')) return jsonResponse(corsHeaders, { error: 'Path inválido' }, 400)

        const { data, error } = await serviceClient.storage.from(bucket).createSignedUrl(path, 3600)
        if (error) return jsonResponse(corsHeaders, { error: 'Não foi possível gerar URL' }, 500)
        return jsonResponse(corsHeaders, { signedUrl: data.signedUrl })
      }

      // ==================== AUDIT LOGS ====================
      case 'audit-logs': {
        const page = clampInt(url.searchParams.get('page'), 1, 100, 1)
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

        const validAuditActions = ['APPROVE', 'REJECT', 'NEEDS_FIX', 'NOTE', 'BLOCK', 'UNBLOCK', 'all']
        if (actionFilter && actionFilter !== 'all' && validAuditActions.includes(actionFilter)) {
          query = query.eq('action', actionFilter)
        }
        if (adminFilter && isValidUUID(adminFilter)) query = query.eq('admin_user_id', adminFilter)
        if (dateFrom) query = query.gte('created_at', dateFrom)
        if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59Z')
        if (entityFilter && isValidUUID(entityFilter)) query = query.eq('profile_id', entityFilter)

        query = query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)
        const { data, error, count } = await query
        if (error) throw error

        return jsonResponse(corsHeaders, { data: data || [], total: count || 0, page, pageSize })
      }

      // ==================== ADMIN USERS (superadmin) ====================
      case 'admin-users': {
        if (adminUser.role !== 'superadmin') return jsonResponse(corsHeaders, { error: 'Apenas superadmin' }, 403)

        if (req.method === 'GET' || !body.action) {
          const { data, error } = await serviceClient.from('admin_users')
            .select('id, email, full_name, role, is_active, created_at, updated_at')
            .order('created_at', { ascending: false })
          if (error) throw error
          return jsonResponse(corsHeaders, { data: data || [] })
        }

        if (req.method === 'PATCH' || body.action === 'update') {
          const targetId = entityId || body.id
          if (!targetId || !isValidUUID(targetId)) return jsonResponse(corsHeaders, { error: 'ID inválido' }, 400)

          const updates: Record<string, unknown> = {}
          if (typeof body.is_active === 'boolean') updates.is_active = body.is_active
          if (typeof body.role === 'string' && ['superadmin', 'admin', 'viewer'].includes(body.role)) updates.role = body.role
          if (Object.keys(updates).length === 0) return jsonResponse(corsHeaders, { error: 'Nenhum campo válido' }, 400)

          const { error } = await serviceClient.from('admin_users').update(updates).eq('id', targetId)
          if (error) throw error
          return jsonResponse(corsHeaders, { success: true })
        }
        break
      }

      // ==================== SETTINGS ====================
      case 'settings': {
        if (req.method === 'GET' || !body.action) {
          const { data, error } = await serviceClient.from('admin_settings')
            .select('id, setting_key, setting_value, description, updated_at').order('setting_key')
          if (error) throw error
          return jsonResponse(corsHeaders, { data: data || [] })
        }
        if (req.method === 'PUT' || body.action === 'update') {
          if (adminUser.role !== 'superadmin') return jsonResponse(corsHeaders, { error: 'Apenas superadmin' }, 403)
          const { setting_key, setting_value } = body
          if (!setting_key || typeof setting_key !== 'string') return jsonResponse(corsHeaders, { error: 'setting_key obrigatório' }, 400)
          const { error } = await serviceClient.from('admin_settings').update({ setting_value, updated_by: adminUser.id }).eq('setting_key', setting_key)
          if (error) throw error
          return jsonResponse(corsHeaders, { success: true })
        }
        break
      }

      // ==================== FREIGHTS LIST ====================
      case 'freights': {
        // Sub-route: freights/{id} -> freight detail
        if (entityId && isValidUUID(entityId)) {
          return await handleFreightDetail(serviceClient, entityId, corsHeaders)
        }

        const status = url.searchParams.get('status') || ''
        const rawSearch = url.searchParams.get('q') || ''
        const search = sanitizeSearchInput(rawSearch)
        const page = clampInt(url.searchParams.get('page'), 1, 100, 1)
        const pageSize = clampInt(url.searchParams.get('pageSize'), 1, 50, 20)
        const dateFrom = url.searchParams.get('dateFrom') || ''
        const dateTo = url.searchParams.get('dateTo') || ''
        const offset = (page - 1) * pageSize

        let query = serviceClient
          .from('freights')
          .select('id, created_at, status, origin_city, origin_state, destination_city, destination_state, cargo_type, price, pickup_date, delivery_date, producer_id, driver_id, distance_km, weight, vehicle_type_required, reference_number, required_trucks, accepted_trucks, urgency, is_guest_freight, company_id', { count: 'exact' })

        const validFreightStatuses = ['NEW', 'APPROVED', 'OPEN', 'ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED', 'DELIVERED_PENDING_CONFIRMATION', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'all']
        if (status && status !== 'all' && validFreightStatuses.includes(status)) {
          query = query.eq('status', status)
        }
        if (search && search.length >= 2) {
          query = query.or(`origin_city.ilike.%${search}%,destination_city.ilike.%${search}%,cargo_type.ilike.%${search}%`)
        }
        if (dateFrom) query = query.gte('created_at', dateFrom)
        if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59Z')

        query = query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)
        const { data, error, count } = await query
        if (error) {
          console.error('[ADMIN-API] Freights list error:', error.message)
          return jsonResponse(corsHeaders, { data: [], total: 0, stats: {} })
        }

        // Resolve producer/driver names
        const profileIds = new Set<string>()
        data?.forEach((f: any) => {
          if (f.producer_id) profileIds.add(f.producer_id)
          if (f.driver_id) profileIds.add(f.driver_id)
        })

        let profileMap: Record<string, { full_name: string; phone: string }> = {}
        if (profileIds.size > 0) {
          const { data: profiles } = await serviceClient
            .from('profiles')
            .select('id, full_name, phone')
            .in('id', Array.from(profileIds))
          profiles?.forEach((p: any) => { profileMap[p.id] = { full_name: p.full_name, phone: p.phone } })
        }

        const enrichedData = data?.map((f: any) => ({
          ...f,
          producer_name: profileMap[f.producer_id]?.full_name || null,
          driver_name: profileMap[f.driver_id]?.full_name || null,
        })) || []

        // Stats
        const now = new Date()
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const [activeCount, transitCount, deliveredCount, totalCount] = await Promise.all([
          serviceClient.from('freights').select('id', { count: 'exact', head: true }).in('status', ['NEW', 'APPROVED', 'OPEN', 'ACCEPTED', 'LOADING', 'LOADED']),
          serviceClient.from('freights').select('id', { count: 'exact', head: true }).eq('status', 'IN_TRANSIT'),
          serviceClient.from('freights').select('id', { count: 'exact', head: true }).in('status', ['DELIVERED', 'DELIVERED_PENDING_CONFIRMATION', 'COMPLETED']).gte('created_at', sevenDaysAgo),
          serviceClient.from('freights').select('id', { count: 'exact', head: true }),
        ])

        return jsonResponse(corsHeaders, {
          data: enrichedData,
          total: count || 0,
          page,
          pageSize,
          totalPages: Math.ceil((count || 0) / pageSize),
          stats: {
            total: totalCount.count || 0,
            active: activeCount.count || 0,
            transit: transitCount.count || 0,
            delivered: deliveredCount.count || 0,
          },
        })
      }

      // ==================== USER DETAIL 360° ====================
      case 'user-detail': {
        if (!entityId || !isValidUUID(entityId)) return jsonResponse(corsHeaders, { error: 'ID inválido' }, 400)

        // Sub-routes
        if (subAction === 'freights') {
          return await handleUserFreights(serviceClient, entityId, url, corsHeaders)
        }
        if (subAction === 'services') {
          return await handleUserServices(serviceClient, entityId, url, corsHeaders)
        }
        if (subAction === 'timeline') {
          return await handleUserTimeline(serviceClient, entityId, corsHeaders)
        }

        const { data: profile, error: profileErr } = await serviceClient
          .from('profiles')
          .select('*')
          .eq('id', entityId)
          .single()

        if (profileErr || !profile) return jsonResponse(corsHeaders, { error: 'Usuário não encontrado' }, 404)

        const [
          vehiclesRes, freightsAsProducerRes, freightsAsDriverRes,
          companyRes, companyDriversRes, actionsRes,
          badgesRes, expensesRes, availabilityRes, balanceRes,
          serviceReqAsClient, serviceReqAsProvider,
        ] = await Promise.all([
          serviceClient.from('vehicles').select('*').eq('driver_id', entityId).order('created_at', { ascending: false }),
          serviceClient.from('freights').select('id, status, cargo_type, price, origin_city, origin_state, destination_city, destination_state, created_at, distance_km, reference_number').eq('producer_id', entityId).order('created_at', { ascending: false }).limit(20),
          serviceClient.from('freights').select('id, status, cargo_type, price, origin_city, origin_state, destination_city, destination_state, created_at, distance_km, reference_number').eq('driver_id', entityId).order('created_at', { ascending: false }).limit(20),
          serviceClient.from('transport_companies').select('*').eq('profile_id', entityId).maybeSingle(),
          serviceClient.from('company_drivers').select('id, status, company_id, affiliation_type, can_accept_freights, created_at, accepted_at, company:company_id(company_name, company_cnpj)').eq('driver_profile_id', entityId),
          serviceClient.from('admin_registration_actions').select('*, admin:admin_user_id(full_name, email)').eq('profile_id', entityId).order('created_at', { ascending: false }),
          serviceClient.from('driver_badges').select('*, badge:badge_type_id(name, icon, description, category)').eq('driver_id', entityId),
          serviceClient.from('driver_expenses').select('id, expense_type, amount, expense_date, description').eq('driver_id', entityId).order('expense_date', { ascending: false }).limit(10),
          serviceClient.from('driver_availability').select('*').eq('driver_id', entityId).order('available_date', { ascending: false }).limit(5),
          serviceClient.from('balance_transactions').select('id, transaction_type, amount, status, created_at, description').eq('provider_id', entityId).order('created_at', { ascending: false }).limit(10),
          serviceClient.from('service_requests').select('id, service_type, status, location_address, estimated_price, final_price, created_at').eq('client_id', entityId).order('created_at', { ascending: false }).limit(20),
          serviceClient.from('service_requests').select('id, service_type, status, location_address, estimated_price, final_price, created_at').eq('provider_id', entityId).order('created_at', { ascending: false }).limit(20),
        ])

        const freightsProducer = freightsAsProducerRes.data || []
        const freightsDriver = freightsAsDriverRes.data || []
        const allFreights = [...freightsProducer, ...freightsDriver]

        const freightStats = {
          total_as_producer: freightsProducer.length,
          total_as_driver: freightsDriver.length,
          completed: allFreights.filter((f: any) => ['DELIVERED', 'COMPLETED', 'DELIVERED_PENDING_CONFIRMATION'].includes(f.status)).length,
          cancelled: allFreights.filter((f: any) => f.status === 'CANCELLED').length,
          active: allFreights.filter((f: any) => ['NEW', 'APPROVED', 'OPEN', 'ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'].includes(f.status)).length,
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
          services_as_client: serviceReqAsClient.data || [],
          services_as_provider: serviceReqAsProvider.data || [],
        })
      }

      // ==================== RISK METRICS ====================
      case 'risk': {
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

        const [
          pendingReg, needsFixReg, rejected30d, blocked,
          fraudEvents, auditEvents,
          cancelledFreights30d, totalFreights30d,
          duplicateCpf,
        ] = await Promise.all([
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'NEEDS_FIX'),
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'REJECTED').gte('created_at', thirtyDaysAgo),
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'BLOCKED'),
          serviceClient.from('antifraud_nfe_events').select('id, severity, rule_code, created_at, status', { count: 'exact' }).eq('resolved', false).order('created_at', { ascending: false }).limit(20),
          serviceClient.from('auditoria_eventos').select('id, tipo, severidade, descricao, created_at, resolvido', { count: 'exact' }).eq('resolvido', false).order('created_at', { ascending: false }).limit(20),
          serviceClient.from('freights').select('id', { count: 'exact', head: true }).eq('status', 'CANCELLED').gte('created_at', thirtyDaysAgo),
          serviceClient.from('freights').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
          // Duplicate CPF detection
          serviceClient.rpc('get_duplicate_cpfs').catch(() => ({ data: [], error: null })),
        ])

        const pending = pendingReg.count || 0
        const rejected = rejected30d.count || 0
        const fraudCount = fraudEvents.count || 0
        const auditCount = auditEvents.count || 0
        const cancelledF = cancelledFreights30d.count || 0
        const totalF = totalFreights30d.count || 0
        const cancelRate = totalF > 0 ? Math.round((cancelledF / totalF) * 100) : 0

        const riskScore = Math.min(100, Math.round(
          (pending * 1.5 + rejected * 3 + fraudCount * 10 + auditCount * 2 + (blocked.count || 0) * 5 + cancelRate) / 5
        ))

        return jsonResponse(corsHeaders, {
          risk_score: riskScore,
          pending_registrations: pending,
          needs_fix_registrations: needsFixReg.count || 0,
          rejected_30d: rejected,
          blocked_total: blocked.count || 0,
          fraud_events: fraudEvents.data || [],
          fraud_count: fraudCount,
          audit_events: auditEvents.data || [],
          audit_count: auditCount,
          freight_cancel_rate: cancelRate,
          cancelled_freights_30d: cancelledF,
          total_freights_30d: totalF,
          duplicate_cpfs: (duplicateCpf as any)?.data || [],
        })
      }

      // ==================== REPORTS ====================
      case 'reports': {
        const reportType = entityId || 'overview'
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()

        if (reportType === 'registrations') {
          // Registrations report
          const { data: regData } = await serviceClient
            .from('profiles')
            .select('role, status, created_at')
            .gte('created_at', ninetyDaysAgo)

          // Group by month and status
          const byMonth: Record<string, Record<string, number>> = {}
          const byRole: Record<string, number> = {}
          const byStatus: Record<string, number> = {}

          regData?.forEach((r: any) => {
            const month = r.created_at?.substring(0, 7) || 'unknown'
            if (!byMonth[month]) byMonth[month] = {}
            byMonth[month][r.status] = (byMonth[month][r.status] || 0) + 1
            byRole[r.role] = (byRole[r.role] || 0) + 1
            byStatus[r.status] = (byStatus[r.status] || 0) + 1
          })

          return jsonResponse(corsHeaders, { type: 'registrations', by_month: byMonth, by_role: byRole, by_status: byStatus, total: regData?.length || 0 })
        }

        if (reportType === 'freights') {
          const { data: freightData } = await serviceClient
            .from('freights')
            .select('status, origin_state, destination_state, price, created_at, cargo_type, distance_km')
            .gte('created_at', ninetyDaysAgo)

          const byMonth: Record<string, Record<string, number>> = {}
          const byStatus: Record<string, number> = {}
          const byState: Record<string, number> = {}
          const byCargo: Record<string, number> = {}
          let totalValue = 0
          let totalDistance = 0

          freightData?.forEach((f: any) => {
            const month = f.created_at?.substring(0, 7) || 'unknown'
            if (!byMonth[month]) byMonth[month] = {}
            byMonth[month][f.status] = (byMonth[month][f.status] || 0) + 1
            byStatus[f.status] = (byStatus[f.status] || 0) + 1
            if (f.origin_state) byState[f.origin_state] = (byState[f.origin_state] || 0) + 1
            if (f.cargo_type) byCargo[f.cargo_type] = (byCargo[f.cargo_type] || 0) + 1
            totalValue += Number(f.price) || 0
            totalDistance += Number(f.distance_km) || 0
          })

          const total = freightData?.length || 0
          const completed = byStatus['DELIVERED'] || 0 + (byStatus['COMPLETED'] || 0)
          const cancelled = byStatus['CANCELLED'] || 0
          const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
          const cancelRate = total > 0 ? Math.round((cancelled / total) * 100) : 0

          return jsonResponse(corsHeaders, {
            type: 'freights',
            by_month: byMonth,
            by_status: byStatus,
            by_state: byState,
            by_cargo: byCargo,
            total,
            total_value: totalValue,
            total_distance: totalDistance,
            avg_value: total > 0 ? Math.round(totalValue / total) : 0,
            completion_rate: completionRate,
            cancel_rate: cancelRate,
          })
        }

        if (reportType === 'admin-activity') {
          const { data: adminActions } = await serviceClient
            .from('admin_registration_actions')
            .select('action, admin_user_id, created_at, admin:admin_user_id(full_name, email)')
            .gte('created_at', ninetyDaysAgo)

          const byAdmin: Record<string, { name: string; count: number; actions: Record<string, number> }> = {}
          const byAction: Record<string, number> = {}
          const byMonth: Record<string, number> = {}

          adminActions?.forEach((a: any) => {
            const adminName = a.admin?.full_name || a.admin?.email || a.admin_user_id
            if (!byAdmin[a.admin_user_id]) byAdmin[a.admin_user_id] = { name: adminName, count: 0, actions: {} }
            byAdmin[a.admin_user_id].count++
            byAdmin[a.admin_user_id].actions[a.action] = (byAdmin[a.admin_user_id].actions[a.action] || 0) + 1
            byAction[a.action] = (byAction[a.action] || 0) + 1
            const month = a.created_at?.substring(0, 7) || 'unknown'
            byMonth[month] = (byMonth[month] || 0) + 1
          })

          return jsonResponse(corsHeaders, { type: 'admin-activity', by_admin: byAdmin, by_action: byAction, by_month: byMonth, total: adminActions?.length || 0 })
        }

        // Overview
        const [totalUsers, totalFreights, totalServices] = await Promise.all([
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }),
          serviceClient.from('freights').select('id', { count: 'exact', head: true }),
          serviceClient.from('service_requests').select('id', { count: 'exact', head: true }),
        ])

        return jsonResponse(corsHeaders, {
          type: 'overview',
          total_users: totalUsers.count || 0,
          total_freights: totalFreights.count || 0,
          total_services: totalServices.count || 0,
        })
      }

      // ==================== FINANCIAL ====================
      case 'financial': {
        const page = clampInt(url.searchParams.get('page'), 1, 100, 1)
        const pageSize = 20
        const offset = (page - 1) * pageSize
        const typeFilter = url.searchParams.get('type') || 'all'
        const statusFilter2 = url.searchParams.get('status') || 'all'

        let query = serviceClient
          .from('balance_transactions')
          .select('id, transaction_type, amount, status, created_at, description, reference_type, reference_id, provider_id, balance_before, balance_after', { count: 'exact' })

        if (typeFilter && typeFilter !== 'all') query = query.eq('transaction_type', typeFilter)
        if (statusFilter2 && statusFilter2 !== 'all') query = query.eq('status', statusFilter2)

        query = query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)
        const { data, error, count } = await query
        if (error) throw error

        // Resolve provider names
        const providerIds = new Set<string>()
        data?.forEach((t: any) => { if (t.provider_id) providerIds.add(t.provider_id) })
        let providerMap: Record<string, string> = {}
        if (providerIds.size > 0) {
          const { data: profiles } = await serviceClient.from('profiles').select('id, full_name').in('id', Array.from(providerIds))
          profiles?.forEach((p: any) => { providerMap[p.id] = p.full_name })
        }

        const enriched = data?.map((t: any) => ({ ...t, provider_name: providerMap[t.provider_id] || null })) || []

        // Stats
        const [totalCredits, totalDebits, pendingPayouts] = await Promise.all([
          serviceClient.from('balance_transactions').select('amount').eq('transaction_type', 'credit').eq('status', 'completed'),
          serviceClient.from('balance_transactions').select('amount').eq('transaction_type', 'debit').eq('status', 'completed'),
          serviceClient.from('driver_payout_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ])

        const sumCredits = totalCredits.data?.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0) || 0
        const sumDebits = totalDebits.data?.reduce((s: number, r: any) => s + Math.abs(Number(r.amount) || 0), 0) || 0

        return jsonResponse(corsHeaders, {
          data: enriched,
          total: count || 0,
          page, pageSize,
          totalPages: Math.ceil((count || 0) / pageSize),
          stats: { total_credits: sumCredits, total_debits: sumDebits, pending_payouts: pendingPayouts.count || 0 },
        })
      }

      // ==================== VEHICLES ====================
      case 'vehicles': {
        const page = clampInt(url.searchParams.get('page'), 1, 100, 1)
        const pageSize = 20
        const offset = (page - 1) * pageSize
        const rawSearch = url.searchParams.get('q') || ''
        const search = sanitizeSearchInput(rawSearch)

        let query = serviceClient
          .from('vehicles')
          .select('id, license_plate, vehicle_type, brand, model, year, color, axle_count, has_tracker, antt_rntrc, driver_id, created_at, capacity_kg, capacity_m3', { count: 'exact' })

        if (search && search.length >= 2) {
          query = query.or(`license_plate.ilike.%${search}%,brand.ilike.%${search}%,model.ilike.%${search}%,antt_rntrc.ilike.%${search}%`)
        }

        query = query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)
        const { data, error, count } = await query
        if (error) throw error

        // Resolve driver names
        const driverIds = new Set<string>()
        data?.forEach((v: any) => { if (v.driver_id) driverIds.add(v.driver_id) })
        let driverMap: Record<string, string> = {}
        if (driverIds.size > 0) {
          const { data: profiles } = await serviceClient.from('profiles').select('id, full_name').in('id', Array.from(driverIds))
          profiles?.forEach((p: any) => { driverMap[p.id] = p.full_name })
        }

        const enriched = data?.map((v: any) => ({ ...v, driver_name: driverMap[v.driver_id] || null })) || []

        const [totalVehicles, withTracker] = await Promise.all([
          serviceClient.from('vehicles').select('id', { count: 'exact', head: true }),
          serviceClient.from('vehicles').select('id', { count: 'exact', head: true }).eq('has_tracker', true),
        ])

        return jsonResponse(corsHeaders, {
          data: enriched,
          total: count || 0,
          page, pageSize,
          totalPages: Math.ceil((count || 0) / pageSize),
          stats: { total: totalVehicles.count || 0, with_tracker: withTracker.count || 0 },
        })
      }

      // ==================== TRANSPORT COMPANIES ====================
      case 'companies': {
        const page = clampInt(url.searchParams.get('page'), 1, 100, 1)
        const pageSize = 20
        const offset = (page - 1) * pageSize
        const rawSearch = url.searchParams.get('q') || ''
        const search = sanitizeSearchInput(rawSearch)

        let query = serviceClient
          .from('transport_companies')
          .select('id, company_name, company_cnpj, company_type, profile_id, is_verified, created_at, city, state, phone, email, total_vehicles, total_drivers, status', { count: 'exact' })

        if (search && search.length >= 2) {
          query = query.or(`company_name.ilike.%${search}%,company_cnpj.ilike.%${search}%`)
        }

        query = query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)
        const { data, error, count } = await query
        if (error) throw error

        // Resolve owner names
        const profileIds = new Set<string>()
        data?.forEach((c: any) => { if (c.profile_id) profileIds.add(c.profile_id) })
        let profileMap: Record<string, string> = {}
        if (profileIds.size > 0) {
          const { data: profiles } = await serviceClient.from('profiles').select('id, full_name').in('id', Array.from(profileIds))
          profiles?.forEach((p: any) => { profileMap[p.id] = p.full_name })
        }

        const enriched = data?.map((c: any) => ({ ...c, owner_name: profileMap[c.profile_id] || null })) || []

        const [totalCompanies, verified] = await Promise.all([
          serviceClient.from('transport_companies').select('id', { count: 'exact', head: true }),
          serviceClient.from('transport_companies').select('id', { count: 'exact', head: true }).eq('is_verified', true),
        ])

        return jsonResponse(corsHeaders, {
          data: enriched,
          total: count || 0,
          page, pageSize,
          totalPages: Math.ceil((count || 0) / pageSize),
          stats: { total: totalCompanies.count || 0, verified: verified.count || 0 },
        })
      }

      // ==================== SERVICE REQUESTS ====================
      case 'services': {
        const page = clampInt(url.searchParams.get('page'), 1, 100, 1)
        const pageSize = 20
        const offset = (page - 1) * pageSize
        const statusFilter3 = url.searchParams.get('status') || 'all'
        const rawSearch = url.searchParams.get('q') || ''
        const search = sanitizeSearchInput(rawSearch)

        let query = serviceClient
          .from('service_requests')
          .select('id, service_type, status, location_address, estimated_price, final_price, created_at, completed_at, client_id, provider_id, urgency_level, description', { count: 'exact' })

        if (statusFilter3 && statusFilter3 !== 'all') query = query.eq('status', statusFilter3)
        if (search && search.length >= 2) {
          query = query.or(`service_type.ilike.%${search}%,location_address.ilike.%${search}%,description.ilike.%${search}%`)
        }

        query = query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)
        const { data, error, count } = await query
        if (error) throw error

        // Resolve client/provider names
        const pIds = new Set<string>()
        data?.forEach((s: any) => { if (s.client_id) pIds.add(s.client_id); if (s.provider_id) pIds.add(s.provider_id) })
        let pMap: Record<string, string> = {}
        if (pIds.size > 0) {
          const { data: profiles } = await serviceClient.from('profiles').select('id, full_name').in('id', Array.from(pIds))
          profiles?.forEach((p: any) => { pMap[p.id] = p.full_name })
        }

        const enriched = data?.map((s: any) => ({
          ...s,
          client_name: pMap[s.client_id] || null,
          provider_name: pMap[s.provider_id] || null,
        })) || []

        const [openSvc, completedSvc, cancelledSvc] = await Promise.all([
          serviceClient.from('service_requests').select('id', { count: 'exact', head: true }).in('status', ['pending', 'accepted']),
          serviceClient.from('service_requests').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
          serviceClient.from('service_requests').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
        ])

        return jsonResponse(corsHeaders, {
          data: enriched,
          total: count || 0,
          page, pageSize,
          totalPages: Math.ceil((count || 0) / pageSize),
          stats: { open: openSvc.count || 0, completed: completedSvc.count || 0, cancelled: cancelledSvc.count || 0 },
        })
      }

      // ==================== NOTIFICATIONS ====================
      case 'notifications': {
        if (req.method === 'POST' && body.action === 'send') {
          // Send notification to user(s)
          const { target_user_ids, title, message, type } = body
          if (!title || !message) return jsonResponse(corsHeaders, { error: 'Título e mensagem obrigatórios' }, 400)

          const notifType = typeof type === 'string' ? type : 'admin_message'
          const notifications: any[] = []

          if (Array.isArray(target_user_ids) && target_user_ids.length > 0) {
            for (const uid of target_user_ids.slice(0, 100)) {
              if (isValidUUID(uid)) {
                notifications.push({
                  user_id: uid,
                  title: String(title).slice(0, 200),
                  message: String(message).slice(0, 2000),
                  type: notifType,
                  is_read: false,
                })
              }
            }
          } else if (body.target === 'all') {
            // Broadcast to all active users
            const { data: allUsers } = await serviceClient.from('profiles').select('user_id').eq('status', 'APPROVED').limit(500)
            allUsers?.forEach((u: any) => {
              if (u.user_id) {
                notifications.push({
                  user_id: u.user_id,
                  title: String(title).slice(0, 200),
                  message: String(message).slice(0, 2000),
                  type: notifType,
                  is_read: false,
                })
              }
            })
          }

          if (notifications.length === 0) return jsonResponse(corsHeaders, { error: 'Nenhum destinatário válido' }, 400)

          const { error } = await serviceClient.from('notifications').insert(notifications)
          if (error) throw error

          return jsonResponse(corsHeaders, { success: true, sent_count: notifications.length })
        }

        // List recent notifications sent by admins
        const page = clampInt(url.searchParams.get('page'), 1, 100, 1)
        const pageSize = 30
        const offset = (page - 1) * pageSize

        const { data, error, count } = await serviceClient
          .from('notifications')
          .select('id, user_id, title, message, type, is_read, created_at', { count: 'exact' })
          .eq('type', 'admin_message')
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1)

        if (error) throw error

        return jsonResponse(corsHeaders, {
          data: data || [],
          total: count || 0,
          page, pageSize,
          totalPages: Math.ceil((count || 0) / pageSize),
        })
      }

      default:
        return jsonResponse(corsHeaders, { error: 'Rota não encontrada' }, 404)
    }

    return jsonResponse(corsHeaders, { error: 'Método não suportado' }, 405)

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno'
    console.error('[ADMIN-API] Error:', message)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

// ==================== HANDLER: Freight Detail ====================
async function handleFreightDetail(serviceClient: any, freightId: string, corsHeaders: Record<string, string>) {
  const { data: freight, error } = await serviceClient
    .from('freights')
    .select('*')
    .eq('id', freightId)
    .single()

  if (error || !freight) return jsonResponse(corsHeaders, { error: 'Frete não encontrado' }, 404)

  // Resolve producer + driver names, assignments, trip progress
  const [producerRes, driverRes, assignmentsRes, tripProgressRes, checkinsRes] = await Promise.all([
    freight.producer_id
      ? serviceClient.from('profiles').select('id, full_name, phone, role, cpf_cnpj, base_city_name, base_state').eq('id', freight.producer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    freight.driver_id
      ? serviceClient.from('profiles').select('id, full_name, phone, role, cpf_cnpj, base_city_name, base_state').eq('id', freight.driver_id).maybeSingle()
      : Promise.resolve({ data: null }),
    serviceClient.from('freight_assignments').select('*, driver:driver_id(full_name, phone), vehicle:vehicle_id(license_plate, vehicle_type)').eq('freight_id', freightId),
    serviceClient.from('driver_trip_progress').select('*').eq('freight_id', freightId).order('created_at', { ascending: false }).limit(50).catch(() => ({ data: [] })),
    serviceClient.from('driver_checkins').select('*').eq('freight_id', freightId).order('checked_at', { ascending: false }).catch(() => ({ data: [] })),
  ])

  return jsonResponse(corsHeaders, {
    freight,
    producer: producerRes.data || null,
    driver: driverRes.data || null,
    assignments: assignmentsRes.data || [],
    trip_progress: tripProgressRes.data || [],
    checkins: checkinsRes.data || [],
  })
}

// ==================== HANDLER: User Freights ====================
async function handleUserFreights(serviceClient: any, userId: string, url: URL, corsHeaders: Record<string, string>) {
  const role = url.searchParams.get('role') || 'all'
  const page = clampInt(url.searchParams.get('page'), 1, 100, 1)
  const pageSize = 20
  const offset = (page - 1) * pageSize

  const fields = 'id, status, cargo_type, price, origin_city, origin_state, destination_city, destination_state, created_at, distance_km, reference_number, pickup_date, delivery_date'

  const queries = []
  if (role === 'all' || role === 'producer') {
    queries.push(serviceClient.from('freights').select(fields, { count: 'exact' }).eq('producer_id', userId).order('created_at', { ascending: false }).range(offset, offset + pageSize - 1))
  }
  if (role === 'all' || role === 'driver') {
    queries.push(serviceClient.from('freights').select(fields, { count: 'exact' }).eq('driver_id', userId).order('created_at', { ascending: false }).range(offset, offset + pageSize - 1))
  }

  const results = await Promise.all(queries)
  const data = results.flatMap((r: any) => r.data || [])
  const total = results.reduce((sum: number, r: any) => sum + (r.count || 0), 0)

  return jsonResponse(corsHeaders, { data, total, page, pageSize })
}

// ==================== HANDLER: User Services ====================
async function handleUserServices(serviceClient: any, userId: string, url: URL, corsHeaders: Record<string, string>) {
  const page = clampInt(url.searchParams.get('page'), 1, 100, 1)
  const pageSize = 20
  const offset = (page - 1) * pageSize

  const [asClient, asProvider] = await Promise.all([
    serviceClient.from('service_requests').select('id, service_type, status, location_address, estimated_price, final_price, created_at, completed_at', { count: 'exact' }).eq('client_id', userId).order('created_at', { ascending: false }).range(offset, offset + pageSize - 1),
    serviceClient.from('service_requests').select('id, service_type, status, location_address, estimated_price, final_price, created_at, completed_at', { count: 'exact' }).eq('provider_id', userId).order('created_at', { ascending: false }).range(offset, offset + pageSize - 1),
  ])

  return jsonResponse(corsHeaders, {
    as_client: asClient.data || [],
    as_provider: asProvider.data || [],
    total_client: asClient.count || 0,
    total_provider: asProvider.count || 0,
  })
}

// ==================== HANDLER: User Timeline ====================
async function handleUserTimeline(serviceClient: any, userId: string, corsHeaders: Record<string, string>) {
  const [actions, freightEvents] = await Promise.all([
    serviceClient.from('admin_registration_actions')
      .select('id, action, reason, created_at, admin:admin_user_id(full_name)')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    serviceClient.from('freights')
      .select('id, status, created_at, origin_city, destination_city, reference_number')
      .or(`producer_id.eq.${userId},driver_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const timeline = [
    ...(actions.data || []).map((a: any) => ({ type: 'admin_action', ...a, timestamp: a.created_at })),
    ...(freightEvents.data || []).map((f: any) => ({ type: 'freight', ...f, timestamp: f.created_at })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return jsonResponse(corsHeaders, { timeline })
}

function jsonResponse(corsHeaders: Record<string, string>, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

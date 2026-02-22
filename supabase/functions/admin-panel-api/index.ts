import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
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

    // Auth client - validates the user's JWT
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
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

    // 2) Check allowlist
    const { data: adminUser, error: adminError } = await serviceClient
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (adminError || !adminUser) {
      console.warn(`[ADMIN-API] Unauthorized access attempt by ${user.id}`)
      return new Response(JSON.stringify({ error: 'Acesso negado. Você não é um administrador autorizado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    console.log(`[ADMIN-API] Admin ${adminUser.email} (${adminUser.role}) -> ${action}`)

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

        const [pending, approved7d, rejected7d, pendingByRole, recentActions] = await Promise.all([
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED').gte('created_at', sevenDaysAgo),
          serviceClient.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'REJECTED').gte('created_at', sevenDaysAgo),
          serviceClient.from('profiles').select('role').eq('status', 'PENDING'),
          serviceClient.from('admin_registration_actions').select('*, admin:admin_user_id(full_name, email)').order('created_at', { ascending: false }).limit(10),
        ])

        // Count by role
        const roleCounts: Record<string, number> = {}
        pendingByRole.data?.forEach((p: any) => {
          roleCounts[p.role] = (roleCounts[p.role] || 0) + 1
        })

        return jsonResponse({
          pending_total: pending.count || 0,
          approved_7d: approved7d.count || 0,
          rejected_7d: rejected7d.count || 0,
          pending_by_role: roleCounts,
          recent_actions: recentActions.data || [],
        })
      }

      // --- List Registrations ---
      case 'registrations': {
        if (req.method === 'GET' || !body.action) {
          const status = url.searchParams.get('status') || ''
          const role = url.searchParams.get('role') || ''
          const search = url.searchParams.get('q') || ''
          const page = parseInt(url.searchParams.get('page') || '1')
          const pageSize = 20
          const offset = (page - 1) * pageSize

          let query = serviceClient
            .from('profiles')
            .select('id, user_id, full_name, phone, cpf_cnpj, role, status, created_at, selfie_url, document_photo_url, cnh_photo_url, address_proof_url, admin_message, admin_message_category, base_city_name, base_state, document_validation_status, cnh_validation_status', { count: 'exact' })

          if (status && status !== 'all') query = query.eq('status', status)
          if (role && role !== 'all') query = query.eq('role', role)
          if (search) {
            query = query.or(`full_name.ilike.%${search}%,cpf_cnpj.ilike.%${search}%,phone.ilike.%${search}%`)
          }

          query = query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)

          const { data, error, count } = await query
          if (error) throw error

          return jsonResponse({
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
        if (!entityId) return jsonResponse({ error: 'ID obrigatório' }, 400)

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

          return jsonResponse({ profile, actions: actions || [] })
        }

        // --- POST Actions (approve/reject/needs-fix) ---
        if (req.method === 'POST' && body.action) {
          const { action: regAction, reason, reason_category, message_to_user, internal_notes } = body

          // Get current profile
          const { data: profile, error: pErr } = await serviceClient
            .from('profiles')
            .select('status, role, full_name')
            .eq('id', entityId)
            .single()

          if (pErr || !profile) return jsonResponse({ error: 'Cadastro não encontrado' }, 404)

          let newStatus: string
          switch (regAction) {
            case 'APPROVE': newStatus = 'APPROVED'; break
            case 'REJECT': newStatus = 'REJECTED'; break
            case 'NEEDS_FIX': newStatus = 'NEEDS_FIX'; break
            case 'NOTE': newStatus = profile.status; break
            default: return jsonResponse({ error: 'Ação inválida' }, 400)
          }

          // Update profile status
          if (regAction !== 'NOTE') {
            const updateData: any = { status: newStatus }
            if (message_to_user) {
              updateData.admin_message = message_to_user
              updateData.admin_message_category = reason_category || null
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

          // Log action
          const { error: logErr } = await serviceClient
            .from('admin_registration_actions')
            .insert({
              admin_user_id: adminUser.id,
              profile_id: entityId,
              action: regAction,
              reason,
              reason_category,
              internal_notes,
              previous_status: profile.status,
              new_status: newStatus,
              message_to_user,
            })

          if (logErr) console.error('[ADMIN-API] Error logging action:', logErr)

          return jsonResponse({
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

        if (!bucket || !path) return jsonResponse({ error: 'Bucket e path obrigatórios' }, 400)

        const { data, error } = await serviceClient.storage
          .from(bucket)
          .createSignedUrl(path, 300) // 5 min expiry

        if (error) throw error
        return jsonResponse({ signedUrl: data.signedUrl })
      }

      // --- Audit Logs ---
      case 'audit-logs': {
        const page = parseInt(url.searchParams.get('page') || '1')
        const pageSize = 30
        const offset = (page - 1) * pageSize
        const actionFilter = url.searchParams.get('action') || ''

        let query = serviceClient
          .from('admin_registration_actions')
          .select('*, admin:admin_user_id(full_name, email), profile:profile_id(full_name, role, cpf_cnpj)', { count: 'exact' })

        if (actionFilter && actionFilter !== 'all') {
          query = query.eq('action', actionFilter)
        }

        query = query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)

        const { data, error, count } = await query
        if (error) throw error

        return jsonResponse({
          data: data || [],
          total: count || 0,
          page,
          pageSize,
        })
      }

      // --- Admin Users (superadmin only) ---
      case 'admin-users': {
        if (adminUser.role !== 'superadmin') {
          return jsonResponse({ error: 'Apenas superadmin pode gerenciar admins' }, 403)
        }

        if (req.method === 'GET' || !body.action) {
          const { data, error } = await serviceClient
            .from('admin_users')
            .select('*')
            .order('created_at', { ascending: false })

          if (error) throw error
          return jsonResponse({ data: data || [] })
        }

        // PATCH - update admin
        if (req.method === 'PATCH' || body.action === 'update') {
          const targetId = entityId || body.id
          if (!targetId) return jsonResponse({ error: 'ID obrigatório' }, 400)

          const updates: any = {}
          if (body.is_active !== undefined) updates.is_active = body.is_active
          if (body.role) updates.role = body.role

          const { error } = await serviceClient
            .from('admin_users')
            .update(updates)
            .eq('id', targetId)

          if (error) throw error

          // Audit log
          await serviceClient.from('admin_registration_actions').insert({
            admin_user_id: adminUser.id,
            profile_id: adminUser.id, // self-reference for admin changes
            action: 'NOTE',
            internal_notes: `Admin ${targetId} atualizado: ${JSON.stringify(updates)}`,
            previous_status: 'N/A',
            new_status: 'N/A',
          }).catch(() => {})

          return jsonResponse({ success: true })
        }
        break
      }

      // --- Settings (superadmin only) ---
      case 'settings': {
        if (req.method === 'GET' || !body.action) {
          const { data, error } = await serviceClient
            .from('admin_settings')
            .select('*')
            .order('setting_key')

          if (error) throw error
          return jsonResponse({ data: data || [] })
        }

        if (req.method === 'PUT' || body.action === 'update') {
          if (adminUser.role !== 'superadmin') {
            return jsonResponse({ error: 'Apenas superadmin pode alterar configurações' }, 403)
          }

          const { setting_key, setting_value } = body
          if (!setting_key) return jsonResponse({ error: 'setting_key obrigatório' }, 400)

          const { error } = await serviceClient
            .from('admin_settings')
            .update({ setting_value, updated_by: adminUser.id })
            .eq('setting_key', setting_key)

          if (error) throw error
          return jsonResponse({ success: true })
        }
        break
      }

      default:
        return jsonResponse({ error: `Ação desconhecida: ${action}` }, 404)
    }

    return jsonResponse({ error: 'Método não suportado' }, 405)

  } catch (error: any) {
    console.error('[ADMIN-API] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

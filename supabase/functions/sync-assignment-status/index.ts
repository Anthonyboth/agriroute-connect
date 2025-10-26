import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('[sync-assignment-status] Starting sync process')

    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Buscar assignments desatualizados
    const { data: outOfSync, error: fetchError } = await supabaseAdmin
      .from('freight_assignments')
      .select(`
        id,
        status,
        freight:freights!inner(
          id,
          status
        )
      `)
      .neq('status', 'CANCELLED')

    if (fetchError) {
      console.error('[sync-assignment-status] Error fetching assignments:', fetchError)
      throw fetchError
    }

    console.log(`[sync-assignment-status] Found ${outOfSync?.length || 0} assignments to check`)

    // Filtrar apenas os que estão desatualizados e com status final no freight
    const toUpdate = (outOfSync || []).filter((a: any) => {
      const freightStatus = a.freight.status
      const assignmentStatus = a.status
      
      const isFinalStatus = ['DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED', 'CANCELLED'].includes(freightStatus)
      const needsSync = assignmentStatus !== freightStatus
      
      return isFinalStatus && needsSync
    })

    console.log(`[sync-assignment-status] ${toUpdate.length} assignments need sync`)

    if (toUpdate.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: 'No assignments to sync',
          stats: { total: 0, updated: 0, failed: 0 },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Usar função RPC para fazer update sem trigger
    const { data: syncResult, error: syncError } = await supabaseAdmin.rpc(
      'sync_assignment_status_bulk',
      {
        assignment_ids: toUpdate.map((a: any) => a.id),
        freight_statuses: toUpdate.map((a: any) => a.freight.status),
      }
    )

    if (syncError) {
      console.error('[sync-assignment-status] Sync error:', syncError)
      throw syncError
    }

    console.log('[sync-assignment-status] Sync complete:', syncResult)

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Sync completed',
        result: syncResult,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('[sync-assignment-status] Error:', error)
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

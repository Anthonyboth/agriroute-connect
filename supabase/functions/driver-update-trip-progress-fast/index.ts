import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BodySchema = z.object({
  freightId: z.string().uuid(),
  newStatus: z.string().min(1).max(64),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

function nowIso() {
  return new Date().toISOString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ success: false, error: 'SERVER_MISCONFIG', message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'AUTH_REQUIRED', message: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = userRes?.user;
    if (userErr || !user) {
      return new Response(JSON.stringify({ success: false, error: 'INVALID_TOKEN', message: 'Token inválido ou expirado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const raw = await req.json();
    const body = BodySchema.parse(raw);
    const freightId = body.freightId;
    const newStatus = body.newStatus.toUpperCase().trim();
    const lat = body.lat ?? null;
    const lng = body.lng ?? null;
    const notes = body.notes ?? null;
    const ts = nowIso();

    // Resolve caller profile id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError || !profile?.id) {
      return new Response(JSON.stringify({ success: false, error: 'PROFILE_NOT_FOUND', message: 'Perfil não encontrado para o usuário autenticado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only drivers/providers should hit this endpoint
    if (profile.role === 'TRANSPORTADORA') {
      return new Response(JSON.stringify({ success: false, error: 'FORBIDDEN', message: 'Transportadora deve usar o fluxo administrativo' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check assignment exists (driver must be assigned)
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('freight_assignments')
      .select('id, status')
      .eq('freight_id', freightId)
      .eq('driver_id', profile.id)
      .not('status', 'in', '(CANCELLED,REJECTED)')
      .limit(1)
      .maybeSingle();

    if (assignmentError) {
      return new Response(JSON.stringify({ success: false, error: 'ASSIGNMENT_LOOKUP_FAILED', message: assignmentError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!assignment?.id) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_ASSIGNED', message: 'Motorista não está atribuído a este frete' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Read current progress
    const { data: currentProgress, error: progressFetchError } = await supabaseAdmin
      .from('driver_trip_progress')
      .select('id, current_status, accepted_at, loading_at, loaded_at, in_transit_at, delivered_at')
      .eq('freight_id', freightId)
      .eq('driver_id', profile.id)
      .maybeSingle();

    if (progressFetchError) {
      return new Response(JSON.stringify({ success: false, error: 'PROGRESS_LOOKUP_FAILED', message: progressFetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const previousStatus = currentProgress?.current_status ?? 'NEW';

    // Idempotent
    if (currentProgress?.current_status === newStatus) {
      return new Response(
        JSON.stringify({
          success: true,
          idempotent: true,
          progress_id: currentProgress.id,
          previous_status: previousStatus,
          new_status: newStatus,
          timestamp: ts,
          durationMs: Date.now() - startedAt,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    // Prepare timestamps updates
    const patch: Record<string, unknown> = {
      current_status: newStatus,
      last_lat: lat,
      last_lng: lng,
      driver_notes: notes,
      updated_at: ts,
    };

    if (!currentProgress?.accepted_at) patch.accepted_at = ts;
    if (newStatus === 'LOADING') patch.loading_at = ts;
    if (newStatus === 'LOADED') patch.loaded_at = ts;
    if (newStatus === 'IN_TRANSIT') patch.in_transit_at = ts;
    if (['DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED'].includes(newStatus)) patch.delivered_at = ts;

    let progressId = currentProgress?.id as string | undefined;

    if (!progressId) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('driver_trip_progress')
        .insert({
          freight_id: freightId,
          driver_id: profile.id,
          assignment_id: assignment.id,
          ...patch,
        })
        .select('id')
        .single();

      if (insertError) {
        return new Response(JSON.stringify({ success: false, error: 'PROGRESS_INSERT_FAILED', message: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      progressId = inserted.id;
    } else {
      const { error: updateError } = await supabaseAdmin
        .from('driver_trip_progress')
        .update(patch)
        .eq('id', progressId);

      if (updateError) {
        return new Response(JSON.stringify({ success: false, error: 'PROGRESS_UPDATE_FAILED', message: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Background sync (do not block driver UX)
    const bg = async () => {
      // 1) Best-effort insert into freight_status_history (may trigger legacy logic)
      try {
        await supabaseAdmin.from('freight_status_history').insert({
          freight_id: freightId,
          status: newStatus,
          changed_by: profile.id,
          notes: notes ?? `Status atualizado: ${previousStatus} → ${newStatus}`,
          location_lat: lat,
          location_lng: lng,
          created_at: ts,
        } as any);
      } catch (e) {
        console.warn('[driver-update-trip-progress-fast] history insert failed', e);
      }

      // 2) Keep assignment status in sync (best-effort)
      try {
        await supabaseAdmin
          .from('freight_assignments')
          .update({ status: newStatus, updated_at: ts })
          .eq('id', assignment.id);
      } catch (e) {
        console.warn('[driver-update-trip-progress-fast] assignment sync failed', e);
      }
    };

    // @ts-ignore - available in Supabase Edge runtime
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(bg());
    } else {
      bg();
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Progresso atualizado com sucesso',
        progress_id: progressId,
        previous_status: previousStatus,
        new_status: newStatus,
        timestamp: ts,
        durationMs: Date.now() - startedAt,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (e) {
    console.error('[driver-update-trip-progress-fast] fatal', e);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'UNEXPECTED_ERROR',
        message: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

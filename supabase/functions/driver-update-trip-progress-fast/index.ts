import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BodySchema = z.object({
  freightId: z.string().uuid(),
  newStatus: z.string().min(1).max(64),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

// Ordem estrita dos status (não permite regressão nem pulo)
const STATUS_ORDER_FULL = [
  'NEW',
  'ACCEPTED',
  'LOADING',
  'LOADED',
  'IN_TRANSIT',
  'DELIVERED_PENDING_CONFIRMATION',
  'DELIVERED',
  'COMPLETED',
] as const;

// Fluxo simplificado para MOTO, GUINCHO, MUDANÇA (sem etapa LOADED)
const STATUS_ORDER_SIMPLIFIED = [
  'NEW',
  'ACCEPTED',
  'LOADING',
  'IN_TRANSIT',
  'DELIVERED_PENDING_CONFIRMATION',
  'DELIVERED',
  'COMPLETED',
] as const;

// Service types que usam fluxo simplificado (sem LOADED)
const SIMPLIFIED_SERVICE_TYPES = ['FRETE_MOTO', 'GUINCHO', 'MUDANCA', 'FRETE_URBANO', 'TRANSPORTE_PET', 'ENTREGA_PACOTES'];

function normalizeStatus(s: unknown): string {
  return String(s ?? '').toUpperCase().trim();
}

function getStatusOrder(serviceType: string | null): readonly string[] {
  if (serviceType && SIMPLIFIED_SERVICE_TYPES.includes(serviceType)) {
    return STATUS_ORDER_SIMPLIFIED;
  }
  return STATUS_ORDER_FULL;
}

function validateStrictTransition(previousStatus: string, nextStatus: string, serviceType: string | null = null): { ok: boolean; error?: string; message?: string; warning?: string } {
  const prev = normalizeStatus(previousStatus) || 'NEW';
  const next = normalizeStatus(nextStatus);
  const statusOrder = getStatusOrder(serviceType);

  const prevIndex = statusOrder.indexOf(prev);
  const nextIndex = statusOrder.indexOf(next);

  if (nextIndex === -1) {
    return { ok: false, error: 'STATUS_UNKNOWN', message: `Status inválido: ${nextStatus}` };
  }

  // Se o status anterior for desconhecido, não arriscar: exigir ACCEPTED como primeiro passo
  if (prevIndex === -1) {
    if (next !== 'ACCEPTED') {
      return {
        ok: false,
        error: 'STATUS_UNKNOWN_PREVIOUS',
        message: `Transição inválida. Status atual não reconhecido (${previousStatus}). Reinicie pelo passo "ACCEPTED".`,
      };
    }
    return { ok: true };
  }

  // Idempotência (mesmo status)
  if (prevIndex === nextIndex) return { ok: true };

  // Bloquear regressão
  if (nextIndex < prevIndex) {
    return { ok: false, error: 'STATUS_REGRESSION_BLOCKED', message: `Transição inválida: não é permitido voltar (${prev} → ${next}).` };
  }

  // Pulo de etapas — tolerância inteligente
  if (nextIndex > prevIndex + 1) {
    // ✅ CORREÇÃO: Permitir LOADING → IN_TRANSIT (pular LOADED) para QUALQUER frete
    // A etapa LOADED é opcional — muitos fretes rurais não precisam dela.
    // Quando service_type é null/desconhecido, também permitir este pulo.
    if (prev === 'LOADING' && next === 'IN_TRANSIT') {
      console.warn(`[validateStrictTransition] Permitindo pulo LOADING→IN_TRANSIT (LOADED opcional). serviceType=${serviceType}`);
      return { ok: true, warning: 'LOADED_SKIPPED' };
    }

    // ✅ Tolerância: permitir pulo de no máximo 2 etapas com warning
    // (cobre dessincronia entre assignment.status e driver_trip_progress.current_status)
    if (nextIndex <= prevIndex + 2) {
      const skipped = statusOrder.slice(prevIndex + 1, nextIndex).join(', ');
      console.warn(`[validateStrictTransition] Pulo tolerado: ${prev} → ${next} (pulou: ${skipped}). serviceType=${serviceType}`);
      return { ok: true, warning: `SKIP_TOLERATED: ${skipped}` };
    }

    const expected = statusOrder[prevIndex + 1];
    return { ok: false, error: 'STATUS_SKIP_BLOCKED', message: `Transição inválida: de ${prev} você deve ir para ${expected} (não pode pular para ${next}).` };
  }

  return { ok: true };
}

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
    const newStatus = normalizeStatus(body.newStatus);
    const lat = body.lat ?? null;
    const lng = body.lng ?? null;
    const notes = body.notes ?? null;
    const ts = nowIso();

    // Resolve caller profile id (multi-profile safe: busca array e prioriza papel MOTORISTA)
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id);

    if (profileError || !profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'PROFILE_NOT_FOUND', message: 'Perfil não encontrado para o usuário autenticado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Priorizar perfil de motorista para este contexto
    const driverRoles = ['MOTORISTA', 'MOTORISTA_AFILIADO', 'AUTONOMO'];
    const profile = profiles.find(p => driverRoles.includes(p.role)) || profiles[0];

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

    // Buscar service_type do frete para determinar fluxo de status correto
    const { data: freightData } = await supabaseAdmin
      .from('freights')
      .select('service_type')
      .eq('id', freightId)
      .single();

    const serviceType = freightData?.service_type ?? null;

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

    // Preferir status já conhecido do assignment quando ainda não existe driver_trip_progress
    // (isso evita histórico "NEW → LOADING" quando o assignment já estava em ACCEPTED).
    const previousStatus = normalizeStatus(currentProgress?.current_status ?? assignment.status ?? 'NEW') || 'NEW';

    // =====================================================
    // Validação estrita no FAST PATH (service_role) — evita regressões e pulos
    // Usa fluxo simplificado para MOTO/GUINCHO/MUDANCA (sem etapa LOADED)
    // =====================================================
    const validation = validateStrictTransition(previousStatus, newStatus, serviceType);
    console.log('[driver-update-trip-progress-fast]', {
      freightId, profileId: profile.id, previousStatus, newStatus, serviceType,
      validationOk: validation.ok, validationError: validation.error,
    });
    if (!validation.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: validation.error,
          message: validation.message,
          previous_status: previousStatus,
          new_status: newStatus,
          timestamp: ts,
          durationMs: Date.now() - startedAt,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

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

    // Definir timestamps apenas na primeira ocorrência (preservar histórico real)
    const currentStatusOrder = getStatusOrder(serviceType);
    const acceptedIndex = currentStatusOrder.indexOf('ACCEPTED');
    const prevIndex = currentStatusOrder.indexOf(previousStatus);
    const nextIndex = currentStatusOrder.indexOf(newStatus);

    // Se já estamos em/apos ACCEPTED (ou indo para ACCEPTED+), garantir accepted_at
    const beyondAccepted = (prevIndex !== -1 && prevIndex >= acceptedIndex) || (nextIndex !== -1 && nextIndex >= acceptedIndex);
    if (beyondAccepted && !currentProgress?.accepted_at) patch.accepted_at = ts;

    if (newStatus === 'LOADING' && !currentProgress?.loading_at) patch.loading_at = ts;
    if (newStatus === 'LOADED' && !currentProgress?.loaded_at) patch.loaded_at = ts;
    if (newStatus === 'IN_TRANSIT' && !currentProgress?.in_transit_at) patch.in_transit_at = ts;
    if (['DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED'].includes(newStatus) && !currentProgress?.delivered_at) patch.delivered_at = ts;

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

    // =====================================================
    // CRITICAL: Sync assignment status (NOT best-effort)
    // Must run BEFORE returning to prevent desync
    // =====================================================
    const assignmentPatch: Record<string, unknown> = { 
      status: newStatus, 
      updated_at: ts 
    };
    // Also set delivered_at on assignment when delivering
    if (['DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED'].includes(newStatus)) {
      assignmentPatch.delivered_at = ts;
    }

    const { error: assignSyncErr } = await supabaseAdmin
      .from('freight_assignments')
      .update(assignmentPatch)
      .eq('id', assignment.id);

    if (assignSyncErr) {
      console.error('[driver-update-trip-progress-fast] CRITICAL: assignment sync failed:', assignSyncErr.message);
      // Retry once with a small delay (trigger interference)
      await new Promise(r => setTimeout(r, 200));
      const { error: retryErr } = await supabaseAdmin
        .from('freight_assignments')
        .update(assignmentPatch)
        .eq('id', assignment.id);
      if (retryErr) {
        console.error('[driver-update-trip-progress-fast] CRITICAL: assignment sync retry also failed:', retryErr.message);
      }
    }

    // Background tasks (non-blocking: history + notifications)
    const bg = async () => {
      // 1) Insert into freight_status_history
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

      // 2) Verify assignment sync stuck (trigger may have reverted status)
      try {
        const { data: verifyAssignment } = await supabaseAdmin
          .from('freight_assignments')
          .select('status')
          .eq('id', assignment.id)
          .single();
        
        if (verifyAssignment && verifyAssignment.status !== newStatus) {
          console.warn(`[driver-update-trip-progress-fast] Assignment status reverted! Expected ${newStatus}, got ${verifyAssignment.status}. Re-applying...`);
          await supabaseAdmin
            .from('freight_assignments')
            .update({ status: newStatus, updated_at: nowIso() })
            .eq('id', assignment.id);
        }
      } catch (e) {
        console.warn('[driver-update-trip-progress-fast] assignment verify failed', e);
      }

      // 3) CRÍTICO: Notificar produtor + criar pagamento quando motorista reporta entrega
      if (newStatus === 'DELIVERED_PENDING_CONFIRMATION') {
        try {
          const { data: freight } = await supabaseAdmin
            .from('freights')
            .select('id, producer_id, price, required_trucks, origin_city, destination_city')
            .eq('id', freightId)
            .single();

          if (freight?.producer_id) {
            const { data: driverProfile } = await supabaseAdmin
              .from('profiles')
              .select('full_name')
              .eq('id', profile.id)
              .single();

            const driverName = driverProfile?.full_name || 'Motorista';
            const route = `${freight.origin_city || '?'} → ${freight.destination_city || '?'}`;

            const { data: assignmentData } = await supabaseAdmin
              .from('freight_assignments')
              .select('agreed_price')
              .eq('id', assignment.id)
              .single();

            const agreedPrice = assignmentData?.agreed_price;
            const requiredTrucks = Math.max(freight.required_trucks || 1, 1);
            const fallbackAmount = Math.round((freight.price || 0) / requiredTrucks * 100) / 100;
            
            let amount: number;
            if (agreedPrice && agreedPrice > 0) {
              if (requiredTrucks > 1 && (freight.price || 0) > 0 && Math.abs(agreedPrice - (freight.price || 0)) <= 0.01) {
                amount = Math.round((freight.price || 0) / requiredTrucks * 100) / 100;
                console.log(`[driver-update-trip-progress-fast] agreed_price ≈ freight.price em multi-carreta, dividindo: ${agreedPrice} → ${amount}`);
              } else {
                amount = agreedPrice;
              }
            } else {
              amount = fallbackAmount;
            }

            // 3a) Notificar produtor sobre entrega reportada
            await supabaseAdmin.from('notifications').insert({
              user_id: freight.producer_id,
              title: '🚚 Entrega Reportada',
              message: `${driverName} reportou a entrega do frete ${route}. Você tem 72h para confirmar.`,
              type: 'delivery_reported',
              data: {
                freight_id: freightId,
                driver_id: profile.id,
                driver_name: driverName,
                assignment_id: assignment.id,
                amount,
              },
              read: false,
            });
            console.log('[driver-update-trip-progress-fast] Produtor notificado sobre entrega');

            // 3b) Criar external_payment se não existir
            const { data: existingPayment } = await supabaseAdmin
              .from('external_payments')
              .select('id')
              .eq('freight_id', freightId)
              .eq('driver_id', profile.id)
              .maybeSingle();

            if (!existingPayment && amount > 0) {
              await supabaseAdmin.from('external_payments').insert({
                freight_id: freightId,
                producer_id: freight.producer_id,
                driver_id: profile.id,
                amount,
                status: 'proposed',
                notes: agreedPrice ? 'Pagamento automático: valor acordado com o motorista' : 'Pagamento automático: valor calculado',
                proposed_at: ts,
              });
              console.log('[driver-update-trip-progress-fast] External payment criado:', amount);

              // 3c) Notificar produtor sobre pagamento pendente
              await supabaseAdmin.from('notifications').insert({
                user_id: freight.producer_id,
                title: '💰 Pagamento Pendente',
                message: `O frete foi entregue. Confirme o pagamento de R$ ${amount.toFixed(2).replace('.', ',')} para ${driverName}.`,
                type: 'payment_pending',
                data: {
                  freight_id: freightId,
                  driver_id: profile.id,
                  amount,
                  source: agreedPrice ? 'agreed_price' : 'calculated',
                },
                read: false,
              });
              console.log('[driver-update-trip-progress-fast] Produtor notificado sobre pagamento pendente');
            }
          }
        } catch (e) {
          console.error('[driver-update-trip-progress-fast] Erro ao notificar/criar pagamento:', e);
        }
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

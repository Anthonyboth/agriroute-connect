// supabase/functions/monitor-match-feed/index.ts
// Synthetic health check for the match feed pipeline.
// Logs in as sentinel users (real RLS), calls get_authoritative_feed,
// records telemetry, and sends Telegram alerts with dedupe + recovery.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Role = "MOTORISTA" | "PRESTADOR_SERVICOS" | "TRANSPORTADORA";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TG_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;

// ── Helpers ──

async function sendTelegram(text: string) {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: TG_CHAT_ID,
          text,
          disable_web_page_preview: true,
        }),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Telegram send failed", res.status, body);
    } else {
      await res.text(); // consume body
    }
  } catch (e) {
    console.error("Telegram error:", e);
  }
}

// ── Alert state (dedupe + recovery) ──

async function getAlertState(admin: any, key: string) {
  const { data, error } = await admin
    .from("match_alert_state")
    .select("*")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertAlertState(
  admin: any,
  key: string,
  patch: Record<string, any>
) {
  const { error } = await admin.from("match_alert_state").upsert(
    {
      key,
      ...patch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) console.error("alert state upsert error", error);
}

// ── Telemetry ──

async function logTelemetry(admin: any, row: Record<string, any>) {
  const { error } = await admin.from("match_telemetry").insert(row);
  if (error) console.error("telemetry insert error", error);
}

// ── Sentinel auth ──

async function signInAsSentinel(role: Role) {
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });

  const envMap: Record<Role, { email: string; password: string }> = {
    MOTORISTA: {
      email: "SENTINEL_DRIVER_EMAIL",
      password: "SENTINEL_DRIVER_PASSWORD",
    },
    PRESTADOR_SERVICOS: {
      email: "SENTINEL_PROVIDER_EMAIL",
      password: "SENTINEL_PROVIDER_PASSWORD",
    },
    TRANSPORTADORA: {
      email: "SENTINEL_COMPANY_EMAIL",
      password: "SENTINEL_COMPANY_PASSWORD",
    },
  };

  const creds = envMap[role];
  const email = Deno.env.get(creds.email);
  const password = Deno.env.get(creds.password);

  if (!email || !password) {
    throw new Error(`Missing sentinel credentials for ${role}`);
  }

  const { data, error } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;

  return { anon, session: data.session!, user: data.user! };
}

// ── Failure detection ──

function computeFailure(params: {
  role: Role;
  cityCount: number;
  rpcFreights: number;
  rpcServices: number;
  durationMs: number;
}) {
  const { role, cityCount, rpcFreights, rpcServices, durationMs } = params;
  const rpcTotal = rpcFreights + rpcServices;

  // Rule 1: RPC returned items but none displayed (sentinel has cities)
  if (cityCount > 0 && rpcTotal === 0) {
    return { ok: false as const, code: "RPC_RETURNED_ZERO_WITH_CITIES" };
  }

  // Rule 2: Extreme latency
  if (durationMs > 5000) {
    return { ok: false as const, code: "RPC_SLOW_OVER_5S" };
  }

  // Rule 3: Provider-specific — services zero
  if (role === "PRESTADOR_SERVICOS" && rpcServices === 0 && cityCount > 0) {
    return { ok: false as const, code: "SERVICES_MATCH_ZERO" };
  }

  return { ok: true as const, code: null };
}

// ── Single role check ──

async function runCheck(role: Role, env: string) {
  const t0 = Date.now();

  try {
    const { anon, user } = await signInAsSentinel(role);

    // Call the authoritative feed RPC with real RLS
    const { data: payload, error } = await anon.rpc("get_authoritative_feed", {
      p_user_id: user.id,
      p_role: role,
      p_debug: false,
    });

    const durationMs = Date.now() - t0;

    if (error) {
      return {
        ok: false,
        role,
        user_id: user.id,
        duration_ms: durationMs,
        failure_code: "RPC_ERROR",
        failure_detail: { message: error.message },
        rpc_freights: 0,
        rpc_services: 0,
        city_ids_count: 0,
        feed_total_eligible: null,
        feed_total_displayed: null,
      };
    }

    const freights = Array.isArray(payload?.freights) ? payload.freights : [];
    const services = Array.isArray(payload?.service_requests)
      ? payload.service_requests
      : [];

    // Get sentinel's active cities
    const { data: userCities } = await anon
      .from("user_cities")
      .select("city_id")
      .eq("user_id", user.id)
      .eq("is_active", true);

    const cityCount = (userCities || []).length;
    const rpcFreights = freights.length;
    const rpcServices = services.length;

    const failure = computeFailure({
      role,
      cityCount,
      rpcFreights,
      rpcServices,
      durationMs,
    });

    return {
      ok: failure.ok,
      role,
      user_id: user.id,
      duration_ms: durationMs,
      failure_code: failure.code,
      failure_detail: {
        cityCount,
        rpcFreights,
        rpcServices,
      },
      rpc_freights: rpcFreights,
      rpc_services: rpcServices,
      city_ids_count: cityCount,
      feed_total_eligible: payload?.metrics?.feed_total_eligible ?? null,
      feed_total_displayed: payload?.metrics?.feed_total_displayed ?? null,
    };
  } catch (e) {
    return {
      ok: false,
      role,
      user_id: null,
      duration_ms: Date.now() - t0,
      failure_code: "EXCEPTION",
      failure_detail: { message: String(e?.message || e) },
      rpc_freights: 0,
      rpc_services: 0,
      city_ids_count: 0,
      feed_total_eligible: null,
      feed_total_displayed: null,
    };
  }
}

// ── Main handler ──

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: require X-Monitor-Token or valid service_role Bearer token
  const monitorToken = Deno.env.get("MONITOR_CRON_TOKEN");
  const reqToken = req.headers.get("x-monitor-token");
  const authHeader = req.headers.get("authorization") || "";
  const isServiceRole = authHeader === `Bearer ${SERVICE_KEY}`;

  if (!isServiceRole && (!monitorToken || reqToken !== monitorToken)) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  }

  try {
    const env = Deno.env.get("APP_ENV") || "prod";
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Determine which roles to check (all by default, or pass ?role=MOTORISTA)
    const url = new URL(req.url);
    const roleParam = url.searchParams.get("role");
    const roles: Role[] = roleParam
      ? [roleParam as Role]
      : ["MOTORISTA", "PRESTADOR_SERVICOS", "TRANSPORTADORA"];

    const results = [];

    for (const role of roles) {
      const r = await runCheck(role, env);
      results.push(r);

      // 1) Log telemetry
      await logTelemetry(admin, {
        env,
        check_name: "feed_synthetic",
        source: "sentinel",
        role: r.role,
        user_id: r.user_id,
        city_ids_count: r.city_ids_count,
        city_pairs_count: 0,
        rpc_freights_count: r.rpc_freights,
        rpc_services_count: r.rpc_services,
        displayed_freights_count: r.rpc_freights,
        displayed_services_count: r.rpc_services,
        feed_total_eligible: r.feed_total_eligible,
        feed_total_displayed: r.feed_total_displayed,
        duration_ms: r.duration_ms,
        ok: r.ok,
        failure_code: r.failure_code,
        failure_detail: r.failure_detail,
      });

      // 2) Dedupe + recovery alerts
      const stateKey = `match_feed_${env}_${role}`;
      const prev = await getAlertState(admin, stateKey);
      const nowIso = new Date().toISOString();
      let failStreak = Number(prev?.fail_streak || 0);

      if (!r.ok) {
        failStreak += 1;
        const shouldOpen = failStreak >= 3;

        const lastSentAt = prev?.last_sent_at
          ? new Date(prev.last_sent_at).getTime()
          : 0;
        const canSend = Date.now() - lastSentAt > 15 * 60 * 1000;

        await upsertAlertState(admin, stateKey, {
          is_open: shouldOpen || prev?.is_open || false,
          last_fail_at: nowIso,
          fail_streak: failStreak,
        });

        if (shouldOpen && canSend) {
          const detail = r.failure_detail as any;
          const msg =
            `🚨 AgriRoute Match ALERT (${env}) — ${role}\n` +
            `failure_code: ${r.failure_code}\n` +
            `cities: ${detail?.cityCount ?? "?"}\n` +
            `rpc: freights=${detail?.rpcFreights ?? 0}, services=${detail?.rpcServices ?? 0}\n` +
            `duration_ms: ${r.duration_ms}`;

          await sendTelegram(msg);
          await upsertAlertState(admin, stateKey, { last_sent_at: nowIso });
        }
      } else {
        const wasOpen = !!prev?.is_open;
        if (wasOpen) {
          const lastSentAt = prev?.last_sent_at
            ? new Date(prev.last_sent_at).getTime()
            : 0;
          const canSend = Date.now() - lastSentAt > 60 * 1000;

          if (canSend) {
            const msg =
              `✅ AgriRoute Match RECOVERY (${env}) — ${role}\n` +
              `rpc: freights=${r.rpc_freights}, services=${r.rpc_services}\n` +
              `duration_ms: ${r.duration_ms}`;

            await sendTelegram(msg);
          }
        }

        await upsertAlertState(admin, stateKey, {
          is_open: false,
          fail_streak: 0,
          last_ok_at: nowIso,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message || e) }),
      {
        headers: { ...corsHeaders, "content-type": "application/json" },
        status: 500,
      }
    );
  }
});

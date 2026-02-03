import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Body = {
  freightId: string;
  newStatus: string;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!supabaseUrl || !anonKey) {
      return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY env' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Body;
    const freightId = String(body?.freightId ?? '').trim();
    const newStatus = String(body?.newStatus ?? '').trim();

    if (!freightId || !newStatus) {
      return new Response(JSON.stringify({ error: 'freightId and newStatus are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = {
      p_freight_id: freightId,
      p_new_status: newStatus,
      p_lat: body?.lat ?? null,
      p_lng: body?.lng ?? null,
      p_notes: body?.notes ?? null,
    };

    const url = `${supabaseUrl}/rest/v1/rpc/update_trip_progress`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        authorization: authHeader,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    const durationMs = Date.now() - startedAt;

    console.log('[debug-update-trip-progress] status:', res.status, 'durationMs:', durationMs);
    console.log('[debug-update-trip-progress] response body:', text);

    return new Response(
      JSON.stringify({
        ok: res.ok,
        status: res.status,
        durationMs,
        body: text,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (e) {
    const durationMs = Date.now() - startedAt;
    console.error('[debug-update-trip-progress] error:', e);
    return new Response(
      JSON.stringify({
        ok: false,
        status: 500,
        durationMs,
        error: e instanceof Error ? e.message : String(e),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});

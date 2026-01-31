import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Retorna dados públicos (não sensíveis) de um participante (produtor/motorista),
 * mas SOMENTE se o usuário logado for participante do frete informado.
 *
 * Motivação:
 * - Em fretes multi-carreta, o frete pode permanecer com status OPEN mesmo após aceite via assignments.
 * - Algumas políticas/view de leitura pública podem não liberar `profiles_secure` nessa janela.
 * - Este endpoint usa service role, porém aplica autorização explícita via checagem de participação.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const freight_id = body?.freight_id as string | undefined;
    const participant_profile_id = body?.participant_profile_id as string | undefined;
    const participant_type = body?.participant_type as ("driver" | "producer") | undefined;

    if (!freight_id || !participant_profile_id || !participant_type) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "freight_id, participant_profile_id e participant_type são obrigatórios",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Autenticar usuário
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mapear auth.users.id -> profiles.id
    const { data: callerProfile, error: callerProfileErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (callerProfileErr || !callerProfile?.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Perfil do usuário não encontrado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const caller_profile_id = callerProfile.id as string;

    // Checar participação no frete
    const { data: freight, error: freightErr } = await supabase
      .from("freights")
      .select("id, producer_id, driver_id, drivers_assigned")
      .eq("id", freight_id)
      .maybeSingle();

    if (freightErr || !freight?.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Frete não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const driversAssigned = Array.isArray((freight as any).drivers_assigned)
      ? ((freight as any).drivers_assigned as string[])
      : [];

    let isParticipant = false;
    if (freight.producer_id === caller_profile_id) isParticipant = true;
    if (freight.driver_id === caller_profile_id) isParticipant = true;
    if (driversAssigned.includes(caller_profile_id)) isParticipant = true;

    if (!isParticipant) {
      // Fallback: existe freight_assignment ativo para este usuário?
      const { data: assignmentRow } = await supabase
        .from("freight_assignments")
        .select("id")
        .eq("freight_id", freight_id)
        .eq("driver_id", caller_profile_id)
        .limit(1)
        .maybeSingle();

      if (assignmentRow?.id) isParticipant = true;
    }

    if (!isParticipant) {
      return new Response(
        JSON.stringify({ success: false, error: "Acesso negado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Retornar SOMENTE dados públicos, via view segura
    const { data: profile, error: profileErr } = await supabase
      .from("profiles_secure")
      .select("id, full_name, profile_photo_url, created_at, rating, total_ratings, status")
      .eq("id", participant_profile_id)
      .maybeSingle();

    if (profileErr) {
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar perfil" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!profile) {
      return new Response(
        JSON.stringify({ success: false, error: "Perfil não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        profile,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[get-participant-public-profile] Fatal:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

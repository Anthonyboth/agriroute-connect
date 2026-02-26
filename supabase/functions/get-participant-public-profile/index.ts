import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPLETED_FREIGHT_STATUSES = ["DELIVERED", "DELIVERED_PENDING_CONFIRMATION", "COMPLETED"];
const COMPLETED_SERVICE_STATUSES = ["COMPLETED", "completed"];

const extractStorageRef = (value: string | null | undefined): { bucket: string; path: string } | null => {
  if (!value) return null;

  const trimmed = value.trim().replace(/^\/+/, "");

  const signedMatch = trimmed.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+?)(\?|$)/);
  if (signedMatch) {
    return { bucket: signedMatch[1], path: decodeURIComponent(signedMatch[2]) };
  }

  const publicMatch = trimmed.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+?)(\?|$)/);
  if (publicMatch) {
    return { bucket: publicMatch[1], path: decodeURIComponent(publicMatch[2]) };
  }

  const knownBuckets = ["driver-documents", "profile-photos", "identity-selfies", "vehicle-documents", "freight-attachments"];
  for (const bucket of knownBuckets) {
    if (trimmed.startsWith(`${bucket}/`)) {
      return {
        bucket,
        path: decodeURIComponent(trimmed.slice(bucket.length + 1)),
      };
    }
  }

  return null;
};

const signIfNeeded = async (
  supabase: ReturnType<typeof createClient>,
  value: string | null | undefined,
): Promise<string | null> => {
  if (!value) return null;

  const ref = extractStorageRef(value);
  if (!ref) return value;

  const { data, error } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.path, 3600);
  if (error || !data?.signedUrl) {
    return value;
  }

  return data.signedUrl;
};

/**
 * Retorna dados públicos (não sensíveis) de um participante (produtor/motorista),
 * mas SOMENTE se o usuário logado for participante do frete informado.
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

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile, error: callerProfileErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (callerProfileErr || !callerProfile?.id) {
      return new Response(JSON.stringify({ success: false, error: "Perfil do usuário não encontrado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const caller_profile_id = callerProfile.id as string;

    const { data: freight, error: freightErr } = await supabase
      .from("freights")
      .select("id, producer_id, driver_id, drivers_assigned")
      .eq("id", freight_id)
      .maybeSingle();

    if (freightErr || !freight?.id) {
      return new Response(JSON.stringify({ success: false, error: "Frete não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const driversAssigned = Array.isArray((freight as any).drivers_assigned)
      ? ((freight as any).drivers_assigned as string[])
      : [];

    let isParticipant = false;
    if (freight.producer_id === caller_profile_id) isParticipant = true;
    if (freight.driver_id === caller_profile_id) isParticipant = true;
    if (driversAssigned.includes(caller_profile_id)) isParticipant = true;

    if (!isParticipant) {
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
      const { data: userCompanies } = await supabase
        .from("transport_companies")
        .select("id")
        .eq("profile_id", caller_profile_id);

      if (userCompanies && userCompanies.length > 0) {
        const companyIds = userCompanies.map((c) => c.id);
        const { data: companyAssignment } = await supabase
          .from("freight_assignments")
          .select("id")
          .eq("freight_id", freight_id)
          .in("company_id", companyIds)
          .limit(1)
          .maybeSingle();

        if (companyAssignment?.id) isParticipant = true;
      }
    }

    if (!isParticipant) {
      return new Response(JSON.stringify({ success: false, error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles_secure")
      .select("id, full_name, profile_photo_url, created_at, rating, total_ratings, status")
      .eq("id", participant_profile_id)
      .maybeSingle();

    if (profileErr) {
      return new Response(JSON.stringify({ success: false, error: "Erro ao buscar perfil" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!profile) {
      return new Response(JSON.stringify({ success: false, error: "Perfil não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (participant_type !== "driver") {
      return new Response(
        JSON.stringify({
          success: true,
          profile,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const [directCountResult, assignmentCountResult, serviceCountResult, ratingsResult, vehicleResult] = await Promise.all([
      supabase
        .from("freights")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", participant_profile_id)
        .in("status", COMPLETED_FREIGHT_STATUSES),
      supabase
        .from("freight_assignments")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", participant_profile_id)
        .in("status", COMPLETED_FREIGHT_STATUSES),
      supabase
        .from("service_requests")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", participant_profile_id)
        .in("status", COMPLETED_SERVICE_STATUSES),
      supabase
        .from("freight_ratings")
        .select("rating")
        .eq("rated_user_id", participant_profile_id),
      supabase
        .from("vehicles")
        .select("id, vehicle_type, license_plate, max_capacity_tons")
        .eq("driver_id", participant_profile_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const completedFreights =
      (directCountResult.count || 0) +
      (assignmentCountResult.count || 0) +
      (serviceCountResult.count || 0);

    let averageRating = profile.rating || 0;
    let totalRatings = profile.total_ratings || 0;

    if (ratingsResult.data && ratingsResult.data.length > 0) {
      totalRatings = ratingsResult.data.length;
      averageRating = ratingsResult.data.reduce((sum, r: any) => sum + (r.rating || 0), 0) / ratingsResult.data.length;
    }

    let vehicle = null;
    let vehiclePhotos: Array<{ id: string; photo_url: string; photo_type: string; created_at: string }> = [];

    if (vehicleResult.data) {
      const plate = vehicleResult.data.license_plate || "";
      const plateMasked = plate.length > 4
        ? `${plate.substring(0, 4)}****`
        : `${plate.substring(0, Math.max(0, plate.length - 2))}**`;

      vehicle = {
        id: vehicleResult.data.id,
        type: vehicleResult.data.vehicle_type || "Não informado",
        plate_masked: plateMasked,
        capacity_kg: vehicleResult.data.max_capacity_tons ? Number(vehicleResult.data.max_capacity_tons) * 1000 : null,
      };

      const { data: photosData } = await supabase
        .from("vehicle_photo_history")
        .select("id, photo_url, photo_type, created_at")
        .eq("vehicle_id", vehicleResult.data.id)
        .order("created_at", { ascending: false })
        .limit(6);

      if (photosData?.length) {
        vehiclePhotos = await Promise.all(
          photosData.map(async (photo: any) => ({
            id: photo.id,
            photo_url: (await signIfNeeded(supabase, photo.photo_url)) || photo.photo_url,
            photo_type: photo.photo_type,
            created_at: photo.created_at,
          })),
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        profile: {
          ...profile,
          rating: averageRating,
          total_ratings: totalRatings,
        },
        completed_freights: completedFreights,
        vehicle,
        vehicle_photos: vehiclePhotos,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[get-participant-public-profile] Fatal:", error);
    return new Response(JSON.stringify({ success: false, error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

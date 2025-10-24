import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar profile do motorista
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "MOTORISTA" && profile.role !== "MOTORISTA_AFILIADO")) {
      return new Response(
        JSON.stringify({ error: "Not a driver" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar assignments do motorista
    const { data: assignments, error } = await supabase
      .from("freight_assignments")
      .select(`
        *,
        freight:freights(
          id,
          cargo_type,
          weight,
          origin_address,
          origin_city,
          origin_state,
          destination_address,
          destination_city,
          destination_state,
          distance_km,
          pickup_date,
          delivery_date,
          urgency,
          service_type,
          required_trucks,
          accepted_trucks,
          status,
          producer:profiles!freights_producer_id_fkey(
            id,
            full_name,
            contact_phone
          )
        )
      `)
      .eq("driver_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return new Response(
      JSON.stringify({ assignments }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error fetching assignments:", error);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
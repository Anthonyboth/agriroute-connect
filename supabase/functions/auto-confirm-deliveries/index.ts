import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    console.log("Starting auto-confirm deliveries process...");

    // Executar a função que confirma automaticamente as entregas
    const { error } = await supabase.rpc('auto_confirm_deliveries');

    if (error) {
      console.error("Error auto-confirming deliveries:", error);
      throw error;
    }

    console.log("Auto-confirm deliveries completed successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Auto-confirm deliveries process completed",
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("Error in auto-confirm-deliveries function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Internal error", 
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
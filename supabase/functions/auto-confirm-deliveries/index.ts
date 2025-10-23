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

    console.log("[AUTO-CONFIRM] 🚀 Iniciando processo de auto-confirmação de entregas...");

    // Executar a função RPC que confirma automaticamente as entregas
    const { data, error } = await supabase.rpc('auto_confirm_deliveries');

    if (error) {
      console.error("[AUTO-CONFIRM] ❌ Erro ao executar RPC:", error);
      throw error;
    }

    console.log("[AUTO-CONFIRM] ✅ Processo concluído com sucesso!");
    console.log("[AUTO-CONFIRM] 📊 Resultado:", JSON.stringify(data));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Auto-confirm deliveries process completed",
        result: data,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("[AUTO-CONFIRM] ❌ Erro fatal:", error);
    console.error("[AUTO-CONFIRM] 📝 Stack trace:", error.stack);
    
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
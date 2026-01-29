import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = "-1003009756749";

// Lista de Edge Functions críticas para monitorar
const CRITICAL_FUNCTIONS = [
  "accept-freight-multiple",
  "accept-freight",
  "accept-freight-proposal",
  "create-freight-payment",
  "create-external-payment",
  "nfe-emitir",
  "send-notification",
  "process-driver-payout",
  "create-payout-request",
  "get-payout-requests"
];

// Funções de baixa prioridade (monitorar mas não alertar)
const SECONDARY_FUNCTIONS = [
  "calculate-route",
  "reverse-geocode",
  "spatial-freight-matching",
  "driver-spatial-matching",
  "antt-calculator"
];

interface HealthCheckResult {
  function_name: string;
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  response_time_ms: number;
  error_message?: string;
  last_checked: string;
}

async function sendTelegramAlert(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log("[HEALTH-MONITOR] TELEGRAM_BOT_TOKEN não configurado");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );
    return response.ok;
  } catch (error) {
    console.error("[HEALTH-MONITOR] Erro ao enviar alerta Telegram:", error);
    return false;
  }
}

async function checkFunctionHealth(
  functionName: string
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/${functionName}`,
      {
        method: "OPTIONS",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    // OPTIONS deve retornar 200 ou 204
    if (response.ok || response.status === 204) {
      return {
        function_name: functionName,
        status: responseTime > 5000 ? "degraded" : "healthy",
        response_time_ms: responseTime,
        last_checked: new Date().toISOString(),
      };
    }
    
    return {
      function_name: functionName,
      status: "unhealthy",
      response_time_ms: responseTime,
      error_message: `HTTP ${response.status}: ${response.statusText}`,
      last_checked: new Date().toISOString(),
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      function_name: functionName,
      status: "unhealthy",
      response_time_ms: responseTime,
      error_message: error instanceof Error ? error.message : "Unknown error",
      last_checked: new Date().toISOString(),
    };
  }
}

async function getRecentFunctionErrors(
  supabase: any,
  functionName: string
): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { count } = await supabase
    .from("error_logs")
    .select("*", { count: "exact", head: true })
    .ilike("module", `%${functionName}%`)
    .gte("created_at", oneHourAgo);
  
  return count || 0;
}

async function saveHealthCheckResults(
  supabase: any,
  results: HealthCheckResult[]
): Promise<void> {
  // Criar tabela se não existir (via upsert)
  for (const result of results) {
    await supabase
      .from("edge_function_health")
      .upsert({
        function_name: result.function_name,
        status: result.status,
        response_time_ms: result.response_time_ms,
        error_message: result.error_message,
        last_checked: result.last_checked,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "function_name"
      });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[HEALTH-MONITOR] 🔍 Iniciando verificação de saúde das Edge Functions...");

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verificar todas as funções críticas em paralelo
    const allFunctions = [...CRITICAL_FUNCTIONS, ...SECONDARY_FUNCTIONS];
    const healthPromises = allFunctions.map((fn) => checkFunctionHealth(fn));
    const results = await Promise.all(healthPromises);
    
    // Adicionar contagem de erros recentes
    const resultsWithErrors = await Promise.all(
      results.map(async (result) => {
        const recentErrors = await getRecentFunctionErrors(supabase, result.function_name);
        return { ...result, recent_errors: recentErrors };
      })
    );
    
    // Salvar resultados
    await saveHealthCheckResults(supabase, results);
    
    // Identificar funções com problemas
    const unhealthyFunctions = resultsWithErrors.filter(
      (r) => r.status === "unhealthy" && CRITICAL_FUNCTIONS.includes(r.function_name)
    );
    const degradedFunctions = resultsWithErrors.filter(
      (r) => r.status === "degraded" && CRITICAL_FUNCTIONS.includes(r.function_name)
    );
    const functionsWithErrors = resultsWithErrors.filter(
      (r) => r.recent_errors > 5 && CRITICAL_FUNCTIONS.includes(r.function_name)
    );
    
    // Enviar alerta se houver problemas críticos
    if (unhealthyFunctions.length > 0 || functionsWithErrors.length > 0) {
      const alertMessage = `
🚨 <b>ALERTA: Edge Functions com Problemas</b>

📅 ${new Date().toLocaleString("pt-BR", { timeZone: "America/Cuiaba" })}

${unhealthyFunctions.length > 0 ? `
❌ <b>FUNÇÕES OFFLINE (${unhealthyFunctions.length}):</b>
${unhealthyFunctions.map((f) => `  • ${f.function_name}: ${f.error_message}`).join("\n")}
` : ""}

${degradedFunctions.length > 0 ? `
⚠️ <b>FUNÇÕES LENTAS (${degradedFunctions.length}):</b>
${degradedFunctions.map((f) => `  • ${f.function_name}: ${f.response_time_ms}ms`).join("\n")}
` : ""}

${functionsWithErrors.length > 0 ? `
🔴 <b>FUNÇÕES COM ERROS FREQUENTES:</b>
${functionsWithErrors.map((f) => `  • ${f.function_name}: ${f.recent_errors} erros/hora`).join("\n")}
` : ""}

🔧 <b>Ação necessária:</b> Verificar logs e reiniciar funções afetadas.
      `.trim();
      
      await sendTelegramAlert(alertMessage);
      console.log("[HEALTH-MONITOR] ⚠️ Alerta enviado ao Telegram");
    }
    
    // Calcular estatísticas gerais
    const totalFunctions = results.length;
    const healthyCount = results.filter((r) => r.status === "healthy").length;
    const degradedCount = results.filter((r) => r.status === "degraded").length;
    const unhealthyCount = results.filter((r) => r.status === "unhealthy").length;
    const avgResponseTime = Math.round(
      results.reduce((acc, r) => acc + r.response_time_ms, 0) / totalFunctions
    );
    
    const executionTime = Date.now() - startTime;
    
    console.log(`[HEALTH-MONITOR] ✅ Verificação concluída em ${executionTime}ms`);
    console.log(`[HEALTH-MONITOR] 📊 Resumo: ${healthyCount}/${totalFunctions} saudáveis, ${degradedCount} degradadas, ${unhealthyCount} offline`);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        execution_time_ms: executionTime,
        summary: {
          total: totalFunctions,
          healthy: healthyCount,
          degraded: degradedCount,
          unhealthy: unhealthyCount,
          avg_response_time_ms: avgResponseTime,
        },
        results: resultsWithErrors,
        alerts_sent: unhealthyFunctions.length > 0 || functionsWithErrors.length > 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[HEALTH-MONITOR] ❌ Erro crítico:", error);
    
    // Enviar alerta de erro crítico
    await sendTelegramAlert(`
🚨 <b>ERRO CRÍTICO: Monitor de Edge Functions falhou</b>

❌ ${error instanceof Error ? error.message : "Erro desconhecido"}

📅 ${new Date().toLocaleString("pt-BR", { timeZone: "America/Cuiaba" })}
    `.trim());
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

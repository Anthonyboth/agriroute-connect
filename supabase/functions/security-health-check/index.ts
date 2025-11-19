import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const issues = [];

    // 1. Verificar políticas RLS usando profiles.role diretamente
    const { data: oldStylePolicies } = await supabase.rpc('scan_policies_for_role_references');
    if (oldStylePolicies && oldStylePolicies.length > 0) {
      issues.push({
        severity: 'CRITICAL',
        type: 'OLD_STYLE_RLS',
        message: `${oldStylePolicies.length} política(s) RLS ainda usam profiles.role diretamente`,
        details: oldStylePolicies.slice(0, 5)
      });
    }

    // 2. Verificar tentativas de acesso não autorizado (últimas 24h)
    const { data: unauthorizedAttempts } = await supabase
      .from('error_logs')
      .select('*')
      .eq('error_category', 'UNAUTHORIZED_ACCESS')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    if (unauthorizedAttempts && unauthorizedAttempts.length > 5) {
      issues.push({
        severity: 'MEDIUM',
        type: 'UNAUTHORIZED_ATTEMPTS',
        message: `${unauthorizedAttempts.length} tentativa(s) de acesso não autorizado nas últimas 24h`,
        details: unauthorizedAttempts.slice(0, 5)
      });
    }

    // 3. Verificar Edge Functions com muitos erros (últimas 24h)
    const { data: functionErrors } = await supabase
      .from('error_logs')
      .select('function_name')
      .eq('error_type', 'EDGE_FUNCTION_ERROR')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    const errorCounts: Record<string, number> = {};
    functionErrors?.forEach(log => {
      if (log.function_name) {
        errorCounts[log.function_name] = (errorCounts[log.function_name] || 0) + 1;
      }
    });
    
    const problematicFunctions = Object.entries(errorCounts).filter(([_, count]) => count > 10);
    if (problematicFunctions.length > 0) {
      issues.push({
        severity: 'MEDIUM',
        type: 'FUNCTION_ERRORS',
        message: `${problematicFunctions.length} Edge Function(s) com +10 erros nas últimas 24h`,
        details: problematicFunctions
      });
    }

    // 4. Verificar tabelas com RLS mas sem políticas
    const { data: tables } = await supabase.rpc('check_tables_without_policies');
    if (tables && tables.length > 0) {
      issues.push({
        severity: 'HIGH',
        type: 'RLS_NO_POLICIES',
        message: `${tables.length} tabela(s) com RLS ativado mas sem políticas`,
        details: tables
      });
    }

    // Se houver problemas, notificar Telegram
    if (issues.length > 0) {
      let message = `🔒 <b>RELATÓRIO DE SEGURANÇA</b>\n\n`;
      message += `<b>${issues.length} problema(s) detectado(s):</b>\n\n`;
      
      issues.forEach((issue, index) => {
        const emoji = issue.severity === 'CRITICAL' ? '🔴' : issue.severity === 'HIGH' ? '🟠' : '🟡';
        message += `${emoji} <b>${issue.severity}</b> - ${issue.type}\n`;
        message += `   ${issue.message}\n\n`;
      });
      
      message += `<b>Timestamp:</b> ${new Date().toISOString()}\n`;
      message += `\n💡 <i>Revise o painel de segurança para detalhes completos</i>`;

      await supabase.functions.invoke('send-telegram-alert', {
        body: {
          errorData: {
            errorType: 'SECURITY_HEALTH_CHECK',
            errorCategory: 'MONITORING',
            errorMessage: `Relatório de segurança: ${issues.length} problema(s) detectado(s)`,
            metadata: {
              issues_count: issues.length,
              critical_count: issues.filter(i => i.severity === 'CRITICAL').length,
              high_count: issues.filter(i => i.severity === 'HIGH').length,
              issues: issues,
              timestamp: new Date().toISOString()
            }
          }
        }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      issues_found: issues.length,
      issues: issues 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in security health check:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

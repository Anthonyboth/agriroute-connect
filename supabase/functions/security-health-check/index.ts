import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const issues = [];

    // 1. Verificar políticas RLS usando profiles.role diretamente (separar por tipo)
    const { data: oldStylePolicies } = await supabase.rpc('scan_policies_for_role_references');
    if (oldStylePolicies && oldStylePolicies.length > 0) {
      // Separar violações reais de avisos de duplicação
      const roleViolations = oldStylePolicies.filter(p => p.violation_type === 'PROFILES_ROLE_CHECK');
      const duplicatePolicies = oldStylePolicies.filter(p => p.violation_type === 'DUPLICATE_POLICIES');
      
      if (roleViolations.length > 0) {
        issues.push({
          severity: 'CRITICAL',
          type: 'OLD_STYLE_RLS',
          message: `${roleViolations.length} política(s) RLS ainda usam profiles.role diretamente`,
          details: roleViolations.slice(0, 5)
        });
      }
      
      if (duplicatePolicies.length > 0) {
        issues.push({
          severity: 'LOW',
          type: 'DUPLICATE_POLICIES',
          message: `${duplicatePolicies.length} tabela(s) com políticas RLS duplicadas (revisar para consolidação)`,
          details: duplicatePolicies.slice(0, 5)
        });
      }
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

    // -----------------------------------------------------------------------
    // ALERTAS: evitar spam com itens puramente informativos (ex.: duplicações)
    // -----------------------------------------------------------------------
    // A lista `issues` pode conter itens LOW (ex.: DUPLICATE_POLICIES) que são
    // úteis para housekeeping, mas não indicam um incidente de segurança.
    // Para o bot/monitoramento, enviamos alerta apenas quando houver pelo
    // menos 1 item acionável (MEDIUM/HIGH/CRITICAL).
    const actionableSeverities = new Set(['MEDIUM', 'HIGH', 'CRITICAL']);
    const actionableIssues = issues.filter((i) => actionableSeverities.has(i.severity));

    // Se houver problemas acionáveis, notificar Telegram
    if (actionableIssues.length > 0) {
      let message = `🔒 <b>RELATÓRIO DE SEGURANÇA</b>\n\n`;
      message += `<b>${actionableIssues.length} alerta(s) acionável(is):</b>\n\n`;

      actionableIssues.forEach((issue) => {
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
            errorMessage: `Relatório de segurança: ${actionableIssues.length} alerta(s) acionável(is)`,
            metadata: {
              issues_total_count: issues.length,
              actionable_issues_count: actionableIssues.length,
              critical_count: actionableIssues.filter((i) => i.severity === 'CRITICAL').length,
              high_count: actionableIssues.filter((i) => i.severity === 'HIGH').length,
              medium_count: actionableIssues.filter((i) => i.severity === 'MEDIUM').length,
              actionable_issues: actionableIssues,
              all_issues: issues,
              timestamp: new Date().toISOString(),
            },
          },
        },
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      issues_found: issues.length,
      actionable_issues_found: actionableIssues.length,
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

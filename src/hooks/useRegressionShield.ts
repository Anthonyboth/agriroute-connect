/**
 * src/hooks/useRegressionShield.ts
 * 
 * BLINDAGEM DE REGRESSÃO — Biblioteca de bugs corrigidos e suas soluções.
 * 
 * Este hook serve como documentação viva de todos os bugs críticos encontrados
 * e corrigidos no AgriRoute. Antes de implementar qualquer mudança relacionada,
 * CONSULTE esta lista para evitar reintroduzir bugs já resolvidos.
 * 
 * Formato de cada entrada:
 * - id: Identificador único do bug
 * - date: Data da correção
 * - severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
 * - area: Área do sistema afetada
 * - bug: Descrição do bug
 * - rootCause: Causa raiz
 * - fix: O que foi feito para corrigir
 * - files: Arquivos afetados
 * - rules: Regras que NUNCA devem ser violadas
 */

export interface RegressionEntry {
  id: string;
  date: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  area: string;
  bug: string;
  rootCause: string;
  fix: string;
  files: string[];
  rules: string[];
}

/**
 * REGISTRO DE BUGS CORRIGIDOS — NÃO REMOVA ENTRADAS, APENAS ADICIONE NOVAS.
 */
export const REGRESSION_REGISTRY: RegressionEntry[] = [
  // ═══════════════════════════════════════════════════════════════
  // BUG #001 — Desistência 404 por estado inconsistente
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'FRT-001',
    date: '2026-03-06',
    severity: 'CRITICAL',
    area: 'freight-withdrawal',
    bug: 'Edge function withdraw-freight retornava 404 NOT_OWNER_OR_NOT_FOUND mesmo com assignment ativo.',
    rootCause: 'Frete tinha status=OPEN e driver_id=NULL apesar de ter freight_assignment com status=ACCEPTED. A RPC process_freight_withdrawal só verificava freights.driver_id, ignorando freight_assignments.',
    fix: 'RPC agora usa freight_assignments como fallback quando driver_id é NULL. Busca assignment ativo do motorista e prossegue normalmente.',
    files: [
      'supabase/migrations/*_process_freight_withdrawal.sql',
      'supabase/functions/withdraw-freight/index.ts',
    ],
    rules: [
      'NUNCA confiar apenas em freights.driver_id para verificar propriedade — sempre ter fallback para freight_assignments.',
      'Queries de propriedade devem usar: WHERE (driver_id = X) OR EXISTS (SELECT 1 FROM freight_assignments WHERE freight_id = F AND driver_profile_id = X AND status = ACCEPTED).',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // BUG #002 — Cancelamento permitido após carregamento
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'FRT-002',
    date: '2026-03-06',
    severity: 'CRITICAL',
    area: 'freight-cancellation',
    bug: 'Motorista/produtor conseguia cancelar frete após status LOADED, IN_TRANSIT ou DELIVERED_PENDING_CONFIRMATION.',
    rootCause: 'RPC process_freight_withdrawal não validava status. Permitia desistência em qualquer status não-terminal.',
    fix: 'RPC agora retorna STATUS_REQUIRES_SUPPORT para status LOADED+. Edge function traduz o erro. Frontend esconde botão de cancelar e mostra "Contate suporte".',
    files: [
      'supabase/migrations/*_process_freight_withdrawal.sql',
      'supabase/functions/withdraw-freight/index.ts',
      'src/pages/driver/DriverOngoingTab.tsx',
      'src/hooks/useFreightCancellation.ts',
    ],
    rules: [
      'NUNCA permitir cancelamento/desistência em status LOADED, IN_TRANSIT, DELIVERED_PENDING_CONFIRMATION — exigir suporte/admin.',
      'Validação de status deve existir em 3 camadas: RPC (servidor), Edge Function (middleware), Frontend (UI).',
      'Produtor só cancela diretamente antes de LOADING. Após LOADING, precisa de suporte.',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // BUG #003 — Desistência multi-truck zerava todos os motoristas
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'FRT-003',
    date: '2026-03-06',
    severity: 'CRITICAL',
    area: 'freight-withdrawal-multitruck',
    bug: 'Quando 1 motorista desistia de frete com required_trucks > 1, a RPC zerava accepted_trucks e drivers_assigned, removendo TODOS os motoristas.',
    rootCause: 'RPC usava SET accepted_trucks = 0, drivers_assigned = ARRAY[]::uuid[] ao invés de decrementar/remover apenas o motorista que desistiu.',
    fix: 'RPC agora usa array_remove(drivers_assigned, p_driver_profile_id) e accepted_trucks = accepted_trucks - 1. Só reseta para OPEN se accepted_trucks chegar a 0.',
    files: [
      'supabase/migrations/*_process_freight_withdrawal.sql',
    ],
    rules: [
      'NUNCA zerar accepted_trucks ou drivers_assigned em frete multi-truck — usar array_remove() e decremento unitário.',
      'Verificar required_trucks > 1 antes de decidir se o frete volta para OPEN ou permanece ACCEPTED com menos motoristas.',
      'Sempre usar SET app.skip_recalc = true antes de UPDATE em freights para evitar trigger recalc_freight_accepted_trucks reverter mudanças.',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // BUG #004 — Trigger recalc revertia status durante operação
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'FRT-004',
    date: '2026-03-06',
    severity: 'HIGH',
    area: 'freight-trigger-interference',
    bug: 'O trigger recalc_freight_accepted_trucks revertia o status do frete durante a execução da RPC de withdrawal.',
    rootCause: 'O trigger recalculava accepted_trucks e alterava o status automaticamente, competindo com a lógica da RPC.',
    fix: 'RPC agora define SET app.skip_recalc = true antes de qualquer UPDATE em freights, e reseta ao final.',
    files: [
      'supabase/migrations/*_process_freight_withdrawal.sql',
    ],
    rules: [
      'SEMPRE usar SET app.skip_recalc = true em RPCs que alteram status/driver_id de freights.',
      'Triggers automáticos NÃO devem competir com lógica de RPCs — usar variável de sessão para bypass.',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // BUG #005 — Estado inconsistente: OPEN com assignment ACCEPTED
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'FRT-005',
    date: '2026-03-06',
    severity: 'HIGH',
    area: 'freight-data-integrity',
    bug: 'Frete ficava com status=OPEN e driver_id=NULL enquanto freight_assignments tinha registro ativo com status=ACCEPTED.',
    rootCause: 'Trigger ou operação concorrente alterou freights sem sincronizar freight_assignments. Possível race condition entre aceite e recalc.',
    fix: 'Migração de correção manual + RPC com fallback para freight_assignments. Cleanup automático para fretes single-truck inconsistentes.',
    files: [
      'supabase/migrations/*_fix_inconsistent_freight.sql',
    ],
    rules: [
      'freights.status e freight_assignments DEVEM estar sempre sincronizados.',
      'Se freights.driver_id é NULL e existe assignment ACCEPTED, isso é uma inconsistência que deve ser corrigida.',
      'Operações de aceite/desistência devem ser atômicas (dentro de uma única transação).',
    ],
  },
];

/**
 * Hook para consultar a biblioteca de regressão.
 * Use para buscar bugs conhecidos por área, severidade ou palavras-chave.
 */
export function useRegressionShield() {
  const findByArea = (area: string): RegressionEntry[] => {
    return REGRESSION_REGISTRY.filter(entry =>
      entry.area.toLowerCase().includes(area.toLowerCase())
    );
  };

  const findBySeverity = (severity: RegressionEntry['severity']): RegressionEntry[] => {
    return REGRESSION_REGISTRY.filter(entry => entry.severity === severity);
  };

  const findByKeyword = (keyword: string): RegressionEntry[] => {
    const kw = keyword.toLowerCase();
    return REGRESSION_REGISTRY.filter(entry =>
      entry.bug.toLowerCase().includes(kw) ||
      entry.rootCause.toLowerCase().includes(kw) ||
      entry.fix.toLowerCase().includes(kw) ||
      entry.rules.some(r => r.toLowerCase().includes(kw))
    );
  };

  const getRulesForArea = (area: string): string[] => {
    return findByArea(area).flatMap(entry => entry.rules);
  };

  const getAllRules = (): string[] => {
    return REGRESSION_REGISTRY.flatMap(entry => entry.rules);
  };

  return {
    registry: REGRESSION_REGISTRY,
    findByArea,
    findBySeverity,
    findByKeyword,
    getRulesForArea,
    getAllRules,
    totalBugs: REGRESSION_REGISTRY.length,
    criticalBugs: REGRESSION_REGISTRY.filter(e => e.severity === 'CRITICAL').length,
  };
}

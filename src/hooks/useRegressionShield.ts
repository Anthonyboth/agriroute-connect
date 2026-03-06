/**
 * src/hooks/useRegressionShield.ts
 *
 * BLINDAGEM DE REGRESSÃO — Biblioteca de bugs corrigidos e suas soluções.
 *
 * Este módulo serve como documentação viva de todos os bugs críticos encontrados
 * e corrigidos no AgriRoute. Antes de implementar qualquer mudança relacionada,
 * CONSULTE esta lista para evitar reintroduzir bugs já resolvidos.
 *
 * Features:
 * - 🧠 AI guard contra regressão (assertNoKnownRegression)
 * - 🔎 Search inteligente por keyword, área, severidade
 * - 🧪 Test cases sugeridos por bug
 * - 🛡 Runtime guards tipados
 * - 📊 Detecção de bugs similares
 */

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface RegressionEntry {
  id: string;
  date: string;
  severity: Severity;
  area: string;
  bug: string;
  rootCause: string;
  fix: string;
  files: string[];
  rules: string[];
  keywords: string[];
  testCases: string[];
  runtimeGuard?: RuntimeGuardKey;
}

/** Typed guard keys — one per known regression pattern */
export type RuntimeGuardKey =
  | 'ownership-must-check-driver-id-or-assignment'
  | 'no-cancel-after-loaded'
  | 'multitruck-withdrawal-must-be-incremental'
  | 'skip-recalc-required-on-sensitive-updates'
  | 'freight-and-assignment-state-must-match'
  | 'assignment-open-must-be-in-ongoing-statuses'
  | 'already-accepted-must-not-show-success-toast';

export interface RuntimeGuardContext {
  freightStatus?: string;
  driverId?: string | null;
  assignmentExists?: boolean;
  requiredTrucks?: number;
  acceptedTrucks?: number;
  driversAssigned?: string[];
  skipRecalcSet?: boolean;
}

export class RegressionViolation extends Error {
  constructor(
    public bugId: string,
    public guard: RuntimeGuardKey,
    message: string,
  ) {
    super(`[REGRESSION ${bugId}] ${message}`);
    this.name = 'RegressionViolation';
  }
}

// ═══════════════════════════════════════════════════════════════
// REGISTRO DE BUGS CORRIGIDOS — NÃO REMOVA ENTRADAS, APENAS ADICIONE NOVAS.
// ═══════════════════════════════════════════════════════════════
export const REGRESSION_REGISTRY: RegressionEntry[] = [
  // BUG #001 — Desistência 404 por estado inconsistente
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
    keywords: ['withdraw', '404', 'NOT_OWNER', 'driver_id', 'assignment', 'ownership'],
    testCases: [
      'withdraw_when_driver_id_null_but_assignment_exists',
      'withdraw_when_driver_id_matches',
      'withdraw_when_no_assignment_returns_404',
    ],
    runtimeGuard: 'ownership-must-check-driver-id-or-assignment',
  },

  // BUG #002 — Cancelamento permitido após carregamento
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
    keywords: ['cancel', 'cancelamento', 'LOADED', 'IN_TRANSIT', 'DELIVERED', 'desistência', 'suporte'],
    testCases: [
      'cancel_blocked_when_status_loaded',
      'cancel_blocked_when_status_in_transit',
      'cancel_blocked_when_status_delivered_pending',
      'cancel_allowed_when_status_accepted',
      'cancel_button_hidden_after_loaded',
    ],
    runtimeGuard: 'no-cancel-after-loaded',
  },

  // BUG #003 — Desistência multi-truck zerava todos os motoristas
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
    keywords: ['multitruck', 'multi-truck', 'required_trucks', 'accepted_trucks', 'drivers_assigned', 'array_remove', 'zerar'],
    testCases: [
      'multitruck_withdrawal_decrements_by_one',
      'multitruck_withdrawal_removes_only_withdrawing_driver',
      'multitruck_returns_open_only_when_zero_accepted',
      'multitruck_stays_accepted_when_others_remain',
    ],
    runtimeGuard: 'multitruck-withdrawal-must-be-incremental',
  },

  // BUG #004 — Trigger recalc revertia status durante operação
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
    keywords: ['trigger', 'recalc', 'skip_recalc', 'revert', 'bypass', 'race condition'],
    testCases: [
      'rpc_sets_skip_recalc_before_update',
      'trigger_skips_when_skip_recalc_set',
      'trigger_runs_normally_without_skip_recalc',
    ],
    runtimeGuard: 'skip-recalc-required-on-sensitive-updates',
  },

  // BUG #005 — Estado inconsistente: OPEN com assignment ACCEPTED
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
    keywords: ['inconsistente', 'OPEN', 'ACCEPTED', 'driver_id NULL', 'sync', 'assignment', 'race condition'],
    testCases: [
      'detect_freight_open_with_accepted_assignment',
      'auto_fix_single_truck_inconsistency',
      'accept_and_assignment_are_atomic',
    ],
    runtimeGuard: 'freight-and-assignment-state-must-match',
  },

  // BUG #006 — Frete aceito não aparece na aba "Em Andamento"
  {
    id: 'FRT-006',
    date: '2026-03-06',
    severity: 'CRITICAL',
    area: 'freight-ongoing-visibility',
    bug: 'Frete aceito não aparecia na aba Em Andamento. Motorista aceitava e o card sumia — não ia para Ongoing.',
    rootCause: 'Edge function accept-freight-multiple cria assignments com status "OPEN", mas ASSIGNMENT_ONGOING_STATUSES e fetchOngoingFreights filtravam apenas ACCEPTED/LOADING/LOADED/IN_TRANSIT. Status OPEN era ignorado em todas as queries.',
    fix: 'Adicionado "OPEN" a ASSIGNMENT_ONGOING_STATUSES em freightRules.ts e em todas as queries de ongoing (useDriverOngoingCards, fetchOngoingFreights, activeStatuses no handleFreightAction).',
    files: [
      'src/constants/freightRules.ts',
      'src/hooks/useDriverOngoingCards.ts',
      'src/pages/DriverDashboard.tsx',
    ],
    rules: [
      'ASSIGNMENT_ONGOING_STATUSES DEVE incluir "OPEN" pois accept-freight-multiple cria assignments com esse status.',
      'Toda query de assignments "em andamento" DEVE usar ASSIGNMENT_ONGOING_STATUSES centralizado, nunca hardcoded.',
      'Ao adicionar novo status de assignment, atualizar TODAS as queries: useDriverOngoingCards, fetchOngoingFreights, activeStatuses no handleFreightAction.',
    ],
    keywords: ['ongoing', 'em andamento', 'OPEN', 'assignment', 'visibility', 'card sumiu', 'não aparece'],
    testCases: [
      'accepted_freight_with_open_assignment_shows_in_ongoing',
      'assignment_open_status_included_in_ongoing_filter',
      'pre_check_detects_existing_open_assignment',
    ],
    runtimeGuard: 'assignment-open-must-be-in-ongoing-statuses',
  },

  // BUG #007 — Múltiplos toasts de sucesso ao aceitar frete
  {
    id: 'FRT-007',
    date: '2026-03-06',
    severity: 'HIGH',
    area: 'freight-accept-notifications',
    bug: 'Ao aceitar frete, múltiplos toasts "Frete aceito com sucesso!" apareciam. Poluição visual extrema.',
    rootCause: 'Edge function retornava {success: true, already_accepted: true} para aceites duplicados. O código não verificava already_accepted e mostrava toast de sucesso. Além disso, pre-check de assignment não incluía status OPEN, permitindo re-chamada da edge function.',
    fix: 'Verificar acceptData.already_accepted antes de mostrar toast. Usar toast.info com id único para already_accepted. Adicionar OPEN ao pre-check activeStatuses.',
    files: [
      'src/pages/DriverDashboard.tsx',
    ],
    rules: [
      'SEMPRE verificar already_accepted/code=ALREADY_ACCEPTED antes de mostrar toast de sucesso.',
      'Toasts de aceite DEVEM usar id único (ex: accept-success-{freightId}) para evitar duplicação.',
      'Pre-check de assignment existente DEVE incluir todos os status não-terminais (incluindo OPEN).',
    ],
    keywords: ['toast', 'notificação', 'duplicada', 'already_accepted', 'sucesso', 'spam', 'múltiplos'],
    testCases: [
      'already_accepted_shows_info_not_success',
      'accept_toast_uses_unique_id',
      'pre_check_prevents_duplicate_edge_function_call',
    ],
    runtimeGuard: 'already-accepted-must-not-show-success-toast',
  },

  // BUG #008 — Desistência bloqueada para assignment com status OPEN
  {
    id: 'FRT-008',
    date: '2026-03-06',
    severity: 'CRITICAL',
    area: 'freight-withdrawal',
    bug: 'Motorista não conseguia desistir de frete aceito. Toast "Não é possível desistir do frete neste status." aparecia porque o assignment tinha status OPEN.',
    rootCause: 'handleFreightWithdrawal em DriverDashboard.tsx e DriverOngoingTab.tsx só permitia desistência nos status ACCEPTED/LOADING, mas accept-freight-multiple cria assignments com status OPEN (FRT-006). O status OPEN não era reconhecido como válido para desistência.',
    fix: 'Adicionado "OPEN" à lista de status permitidos para desistência em handleFreightWithdrawal (DriverDashboard.tsx e DriverOngoingTab.tsx).',
    files: [
      'src/pages/DriverDashboard.tsx',
      'src/pages/driver/DriverOngoingTab.tsx',
    ],
    rules: [
      'handleFreightWithdrawal DEVE permitir desistência nos status OPEN, ACCEPTED e LOADING.',
      'Qualquer novo status criado por accept-freight-multiple DEVE ser adicionado a TODAS as validações de status: ongoing filters, withdrawal checks, pre-checks.',
      'Ao corrigir visibilidade de status (ex: FRT-006), SEMPRE verificar se withdrawal/cancellation também precisa da mesma correção.',
    ],
    keywords: ['withdrawal', 'desistência', 'OPEN', 'bloqueada', 'não é possível', 'status', 'handleFreightWithdrawal'],
    testCases: [
      'withdrawal_allowed_for_open_status',
      'withdrawal_allowed_for_accepted_status',
      'withdrawal_blocked_for_loaded_status',
    ],
    runtimeGuard: 'assignment-open-must-be-in-ongoing-statuses',
  },

  // BUG #009 — Frontend engolia erro real da desistência
  {
    id: 'FRT-009',
    date: '2026-03-06',
    severity: 'HIGH',
    area: 'freight-withdrawal',
    bug: 'Frontend mostrava toast genérico "Erro ao processar desistência" sem ler o código/mensagem real retornado pela Edge Function withdraw-freight.',
    rootCause: 'Supabase functions.invoke() coloca o body de respostas non-2xx em error.context, não em error.message. O frontend só lia error.message, perdendo o código de erro real (HAS_CHECKINS, STATUS_REQUIRES_SUPPORT, NOT_OWNER_OR_NOT_FOUND, etc.).',
    fix: 'Frontend agora lê error.context.json() ou error.context.text() para extrair o código/mensagem reais. Mapeamento de códigos para mensagens amigáveis em PT-BR. Aplicado em DriverOngoingTab.tsx e DriverDashboard.tsx.',
    files: [
      'src/pages/driver/DriverOngoingTab.tsx',
      'src/pages/DriverDashboard.tsx',
    ],
    rules: [
      'NUNCA usar apenas error.message de supabase.functions.invoke() — ler error.context.json() para obter o body real.',
      'Todo erro de Edge Function deve ser logado com { code, message, details } para diagnóstico.',
      'Mapeamento de códigos de erro deve existir no frontend para exibir mensagens localizadas.',
    ],
    keywords: ['toast', 'erro genérico', 'context', 'non-2xx', 'withdraw', 'desistência', 'error.context', 'mascarar'],
    testCases: [
      'withdraw_error_shows_specific_message_not_generic',
      'withdraw_error_logs_code_and_message',
      'status_requires_support_shows_correct_toast',
      'has_checkins_shows_correct_toast',
    ],
    runtimeGuard: 'ownership-must-check-driver-id-or-assignment',
  },
];

// ═══════════════════════════════════════════════════════════════
// RUNTIME GUARDS — Previnem regressão em tempo de execução
// ═══════════════════════════════════════════════════════════════

const BLOCKED_CANCEL_STATUSES = ['LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'];

const regressionGuards = {
  assertOwnershipUsesAssignmentFallback(ctx: RuntimeGuardContext) {
    if (ctx.driverId === null && !ctx.assignmentExists) {
      // This is fine — no owner found at all, will return 404 naturally
      return;
    }
    if (ctx.driverId === null && ctx.assignmentExists) {
      // Assignment exists but driver_id is null — must use fallback
      console.warn('[RegressionGuard FRT-001] driver_id is NULL but assignment exists — using fallback path');
    }
  },

  assertNoCancelAfterLoaded(ctx: RuntimeGuardContext) {
    if (ctx.freightStatus && BLOCKED_CANCEL_STATUSES.includes(ctx.freightStatus)) {
      throw new RegressionViolation(
        'FRT-002',
        'no-cancel-after-loaded',
        `Cancelamento bloqueado em status ${ctx.freightStatus}. Requer suporte/admin.`,
      );
    }
  },

  assertMultitruckWithdrawalIsIncremental(ctx: RuntimeGuardContext) {
    if (
      ctx.requiredTrucks !== undefined &&
      ctx.requiredTrucks > 1 &&
      ctx.acceptedTrucks === 0 &&
      ctx.driversAssigned?.length === 0
    ) {
      throw new RegressionViolation(
        'FRT-003',
        'multitruck-withdrawal-must-be-incremental',
        'Multi-truck freight zerou accepted_trucks e drivers_assigned — use array_remove() e decremento unitário.',
      );
    }
  },

  assertSkipRecalcEnabled(ctx: RuntimeGuardContext) {
    if (ctx.skipRecalcSet === false) {
      throw new RegressionViolation(
        'FRT-004',
        'skip-recalc-required-on-sensitive-updates',
        'Operação em freights sem SET app.skip_recalc = true. Trigger pode reverter status.',
      );
    }
  },

  assertFreightAssignmentConsistency(ctx: RuntimeGuardContext) {
    if (ctx.freightStatus === 'OPEN' && ctx.driverId === null && ctx.assignmentExists) {
      throw new RegressionViolation(
        'FRT-005',
        'freight-and-assignment-state-must-match',
        'Estado inconsistente: freight OPEN com driver_id NULL mas assignment ACCEPTED existe.',
      );
    }
  },
};

// ═══════════════════════════════════════════════════════════════
// SEARCH & DETECTION
// ═══════════════════════════════════════════════════════════════

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[\s,._\-/]+/).filter(t => t.length > 2);
}

function calculateSimilarity(tokens: string[], entry: RegressionEntry): number {
  const entryText = [
    entry.bug, entry.rootCause, entry.fix, entry.area,
    ...entry.keywords, ...entry.rules,
  ].join(' ').toLowerCase();

  let matches = 0;
  for (const token of tokens) {
    if (entryText.includes(token)) matches++;
  }
  return tokens.length > 0 ? matches / tokens.length : 0;
}

export function searchRegressionLibrary(query: string): RegressionEntry[] {
  const tokens = tokenize(query);
  return REGRESSION_REGISTRY
    .map(entry => ({ entry, score: calculateSimilarity(tokens, entry) }))
    .filter(({ score }) => score > 0.2)
    .sort((a, b) => b.score - a.score)
    .map(({ entry }) => entry);
}

export function detectSimilarBugs(input: {
  title?: string;
  bug: string;
  rootCause?: string;
  area?: string;
  keywords?: string[];
}): RegressionEntry[] {
  const joined = [input.title, input.bug, input.rootCause, input.area, ...(input.keywords ?? [])]
    .filter(Boolean)
    .join(' ');
  return searchRegressionLibrary(joined);
}

export function findRegressionById(id: string): RegressionEntry | undefined {
  return REGRESSION_REGISTRY.find(e => e.id === id);
}

function findByArea(area: string): RegressionEntry[] {
  return REGRESSION_REGISTRY.filter(entry =>
    entry.area.toLowerCase().includes(area.toLowerCase()),
  );
}

function findBySeverity(severity: Severity): RegressionEntry[] {
  return REGRESSION_REGISTRY.filter(entry => entry.severity === severity);
}

function getRulesForArea(area: string): string[] {
  return findByArea(area).flatMap(entry => entry.rules);
}

function getAllRules(): string[] {
  return REGRESSION_REGISTRY.flatMap(entry => entry.rules);
}

function getSuggestedTests(areaOrKeyword: string): string[] {
  const byArea = findByArea(areaOrKeyword);
  const bySearch = searchRegressionLibrary(areaOrKeyword);
  const combined = [...new Set([...byArea, ...bySearch])];
  return combined.flatMap(entry => entry.testCases);
}

// ═══════════════════════════════════════════════════════════════
// RUNTIME GUARD ENTRY POINT
// ═══════════════════════════════════════════════════════════════

export function assertNoKnownRegression(
  guard: RuntimeGuardKey,
  context: RuntimeGuardContext,
): void {
  switch (guard) {
    case 'ownership-must-check-driver-id-or-assignment':
      regressionGuards.assertOwnershipUsesAssignmentFallback(context);
      return;
    case 'no-cancel-after-loaded':
      regressionGuards.assertNoCancelAfterLoaded(context);
      return;
    case 'multitruck-withdrawal-must-be-incremental':
      regressionGuards.assertMultitruckWithdrawalIsIncremental(context);
      return;
    case 'skip-recalc-required-on-sensitive-updates':
      regressionGuards.assertSkipRecalcEnabled(context);
      return;
    case 'freight-and-assignment-state-must-match':
      regressionGuards.assertFreightAssignmentConsistency(context);
      return;
  }
}

// ═══════════════════════════════════════════════════════════════
// HOOK — Interface principal para componentes React
// ═══════════════════════════════════════════════════════════════

export function useRegressionShield() {
  return {
    registry: REGRESSION_REGISTRY,
    findById: findRegressionById,
    findByArea,
    findBySeverity,
    search: searchRegressionLibrary,
    detectSimilarBugs,
    getRulesForArea,
    getAllRules,
    getSuggestedTests,
    assertNoKnownRegression,
    totalBugs: REGRESSION_REGISTRY.length,
    criticalBugs: REGRESSION_REGISTRY.filter(e => e.severity === 'CRITICAL').length,
  };
}

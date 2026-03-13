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
  | 'already-accepted-must-not-show-success-toast'
  | 'accept-must-allow-accepted-with-slots'
  | 'gps-permission-denied-must-not-throw'
  | 'gps-watchdog-must-detect-disabled-location'
  | 'native-gps-errors-must-not-trigger-alerts'
  | 'withdrawn-driver-must-not-access-freight-details'
  | 'available-feed-must-exclude-driver-active-assignments'
  | 'rpc-column-names-must-match-table-schema'
  | 'lazy-imports-must-use-lazyWithRetry'
  | 'validation-toasts-must-be-neutral'
  | 'build-gradle-must-use-signing-properties'
  | 'preflight-must-validate-index-html-content-and-assets';

export interface RuntimeGuardContext {
  freightStatus?: string;
  driverId?: string | null;
  assignmentExists?: boolean;
  assignmentStatus?: string;
  requiredTrucks?: number;
  acceptedTrucks?: number;
  driversAssigned?: string[];
  skipRecalcSet?: boolean;
  ongoingStatuses?: string[];
  alreadyAccepted?: boolean;
  freightIdsInAvailable?: string[];
  driverActiveFreightIds?: string[];
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

  // BUG #010 — "Aguardando motorista" exibido para o próprio motorista atribuído
  {
    id: 'FRT-010',
    date: '2026-03-06',
    severity: 'CRITICAL',
    area: 'freight-details-visibility',
    bug: 'Motorista via FreightDetails via "Aguardando motorista" em vez de ver seu próprio perfil, mesmo tendo assignment ativo no frete.',
    rootCause: 'FreightDetails.tsx verificava hasActiveAssignment filtrando por status IN (ACCEPTED, LOADING, LOADED, IN_TRANSIT, DELIVERED_PENDING_CONFIRMATION), mas assignments criados por accept-freight-multiple têm status OPEN. Status OPEN não estava na lista, causando isParticipant=false e caindo no fallback "Aguardando motorista".',
    fix: 'Adicionado "OPEN" ao filtro .in("status") na query de freight_assignments dentro de FreightDetails.tsx.',
    files: [
      'src/components/FreightDetails.tsx',
    ],
    rules: [
      'TODA query de freight_assignments que verifica participação DEVE incluir status OPEN.',
      'Ao usar .in("status", [...]) em freight_assignments, SEMPRE consultar ASSIGNMENT_ONGOING_STATUSES de freightRules.ts.',
      'Nunca hardcodar listas de status de assignment — usar a constante centralizada.',
    ],
    keywords: ['aguardando motorista', 'isParticipant', 'OPEN', 'FreightDetails', 'hasActiveAssignment', 'assignment status'],
    testCases: [
      'driver_with_open_assignment_sees_own_profile',
      'driver_with_open_assignment_is_participant',
      'freight_details_includes_open_in_assignment_filter',
    ],
    runtimeGuard: 'assignment-open-must-be-in-ongoing-statuses',
  },

  // BUG #011 — Coluna metadata inexistente na tabela notifications (409)
  {
    id: 'FRT-011',
    date: '2026-03-06',
    severity: 'CRITICAL',
    area: 'freight-withdrawal',
    bug: 'Edge function withdraw-freight retornava 409 com erro "column metadata of relation notifications does not exist". Erro persistiu mesmo após adicionar a coluna via migração.',
    rootCause: 'Duas causas encadeadas: (1) A coluna metadata JSONB não existia na tabela notifications — a RPC process_freight_withdrawal tentava INSERT com campo metadata inexistente. (2) Após adicionar a coluna via ALTER TABLE, o PostgreSQL mantinha o plano de execução cacheado da RPC antiga, que não reconhecia a nova coluna. Era necessário recriar a função (CREATE OR REPLACE) para forçar recompilação do plano.',
    fix: 'Migração 1: ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB. Migração 2: CREATE OR REPLACE FUNCTION process_freight_withdrawal(...) para forçar recompilação do plano e reconhecer a nova coluna.',
    files: [
      'supabase/migrations/*_add_metadata_to_notifications.sql',
      'supabase/migrations/*_recreate_process_freight_withdrawal.sql',
    ],
    rules: [
      'Ao adicionar coluna usada por RPC existente, SEMPRE recriar a RPC (CREATE OR REPLACE) na mesma migração ou migração subsequente para forçar recompilação do plano.',
      'NUNCA assumir que ALTER TABLE será reconhecido automaticamente por RPCs/funções existentes — PostgreSQL cacheia planos de execução.',
      'Toda INSERT em notifications DEVE incluir o campo metadata (JSONB) — mesmo que NULL.',
      'Testar RPCs após schema changes executando-as diretamente, não apenas verificando information_schema.',
    ],
    keywords: ['metadata', 'notifications', '409', 'cached plan', 'recompilação', 'ALTER TABLE', 'CREATE OR REPLACE', 'column does not exist'],
    testCases: [
      'withdrawal_creates_notification_with_metadata',
      'rpc_recognizes_new_columns_after_migration',
      'notification_insert_includes_metadata_field',
    ],
  },

  // BUG #012 — Frete OPEN mas com accepted_trucks/drivers_assigned sujos
  {
    id: 'FRT-012',
    date: '2026-03-06',
    severity: 'CRITICAL',
    area: 'freight-withdrawal',
    bug: 'Após desistência, frete ficava status=OPEN mas com accepted_trucks=1 e drivers_assigned preenchido. UI tratava como "totalmente preenchido" e não exibia como disponível.',
    rootCause: 'A RPC process_freight_withdrawal (single-truck path) fazia UPDATE SET status=OPEN, driver_id=NULL mas NÃO limpava accepted_trucks, drivers_assigned e is_full_booking. O trigger recalc_freight_accepted_trucks era bypassed por skip_recalc=true.',
    fix: 'RPC agora limpa TODOS os campos: status=OPEN, driver_id=NULL, accepted_trucks=0, drivers_assigned={}, is_full_booking=false. Também reordenada: cancela assignments ANTES de atualizar freight para que triggers vejam estado correto.',
    files: [
      'supabase/migrations/*_fix_withdrawal_clear_all_fields.sql',
    ],
    rules: [
      'TODA desistência/cancelamento DEVE zerar accepted_trucks, drivers_assigned e is_full_booking além de status e driver_id.',
      'Ao usar skip_recalc=true, a RPC DEVE limpar manualmente TODOS os campos que o trigger recalc normalmente limparia.',
      'Ordem correta na withdrawal: (1) cancelar assignments, (2) cancelar proposals, (3) deletar trip progress, (4) atualizar freight com TODOS os campos limpos, (5) notificação.',
    ],
    keywords: ['accepted_trucks', 'drivers_assigned', 'is_full_booking', 'stale', 'disponível', 'fully booked', 'withdrawal', 'OPEN'],
    testCases: [
      'withdrawal_clears_accepted_trucks_to_zero',
      'withdrawal_clears_drivers_assigned_to_empty',
      'withdrawal_sets_is_full_booking_false',
      'withdrawn_freight_appears_in_available_list',
    ],
  },

  // ── BUG #013 ─────────────────────────────────────────────────
  {
    id: 'FRT-013',
    date: '2026-03-06',
    severity: 'CRITICAL',
    area: 'freight-withdrawal',
    bug: 'Desistência do motorista não cancelava o assignment corretamente. A RPC usava freights.driver_id para decidir single/multi-truck, mas após uma withdrawal anterior driver_id=NULL, fazendo a RPC seguir o caminho errado. Resultado: assignment ficava OPEN, frete ficava OPEN com dados inconsistentes, e notificações duplicadas "Frete aceito!" a cada ciclo aceitar/desistir/re-aceitar.',
    rootCause: 'process_freight_withdrawal verificava freights.driver_id para decidir o caminho (single vs multi-truck). Após uma desistência anterior que já zerou driver_id=NULL, a re-aceitação nem sempre re-setava driver_id antes da próxima desistência, fazendo a RPC tomar o caminho multi-truck e falhar em encontrar o assignment. Além disso, notify_freight_status_change tinha janela de dedup de 5 minutos que não impedia duplicatas em ciclos aceitar/desistir espaçados.',
    fix: 'RPC refatorada: agora busca PRIMEIRO o assignment do motorista via freight_assignments (ignorando freights.driver_id), depois busca o freight. Janela de dedup de notificações reduzida para 30 segundos. Cleanup global de assignments OPEN órfãos.',
    files: [
      'supabase/migrations/*_bug013_withdrawal_assignment_fix.sql',
    ],
    rules: [
      'NUNCA usar freights.driver_id como condição principal para encontrar assignments na desistência. Sempre buscar via freight_assignments diretamente.',
      'A RPC de withdrawal DEVE fazer FOR UPDATE no assignment E no freight para evitar race conditions.',
      'Notificações de aceitação devem ter dedup por freight_id com janela curta (30s) para evitar spam em ciclos rápidos de aceitar/desistir.',
      'Ao cancelar assignments, usar status NOT IN com lista COMPLETA de terminais: CANCELLED, COMPLETED, DELIVERED, WITHDRAWN.',
    ],
    keywords: ['withdrawal', 'driver_id', 'assignment', 'OPEN', 'stale', 'notification', 'duplicate', 'dedup', 're-accept'],
    testCases: [
      'withdrawal_cancels_assignment_when_driver_id_is_null',
      're_accept_after_withdrawal_does_not_duplicate_notifications',
      'withdrawal_finds_assignment_directly_not_via_freight_driver_id',
      'orphaned_open_assignments_are_cleaned_up',
    ],
  },

  // ── BUG #014 ─────────────────────────────────────────────────
  {
    id: 'FRT-014',
    date: '2026-03-06',
    severity: 'CRITICAL',
    area: 'freight-acceptance',
    bug: 'accept-freight-multiple retornava 409 "Freight not available" para fretes com status ACCEPTED que ainda tinham vagas disponíveis (multi-truck). Além disso, recalc_freight_accepted_trucks não excluía status WITHDRAWN da contagem de assignments ativos, mantendo fretes em ACCEPTED mesmo após todos os motoristas desistirem.',
    rootCause: 'Duas falhas combinadas: (1) accept-freight-multiple bloqueava QUALQUER status !== OPEN, incluindo ACCEPTED com vagas disponíveis em fretes multi-truck. (2) recalc_freight_accepted_trucks e sync_freight_status_on_assignment_update excluíam apenas CANCELLED/REJECTED da contagem ativa, mas NÃO WITHDRAWN — assignments desistidos eram contados como ativos, impedindo o retorno a OPEN.',
    fix: 'Edge function agora permite ACCEPTED quando há slots disponíveis (verificado via contagem real de assignments). Trigger recalc e sync atualizados para excluir WITHDRAWN da contagem ativa. Cleanup global de fretes ACCEPTED sem assignments reais.',
    files: [
      'supabase/functions/accept-freight-multiple/index.ts',
      'supabase/migrations/*_frt014_accept_withdrawn_fix.sql',
    ],
    rules: [
      'accept-freight-multiple NUNCA deve bloquear status ACCEPTED — deve verificar vagas via contagem real de assignments.',
      'TODA contagem de assignments ativos DEVE excluir CANCELLED, REJECTED e WITHDRAWN.',
      'O status WITHDRAWN é terminal e equivalente a CANCELLED para fins de contagem.',
      'Fretes multi-truck com vagas disponíveis devem SEMPRE ser aceitos, independente do status global do frete.',
    ],
    keywords: ['accept', 'ACCEPTED', 'WITHDRAWN', 'recalc', 'slots', 'multi-truck', '409', 'not available', 'capacity'],
    testCases: [
      'accept_freight_with_accepted_status_and_available_slots',
      'withdrawn_assignments_not_counted_as_active',
      'recalc_reverts_to_open_when_all_withdrawn',
      'multi_truck_freight_accepts_after_partial_withdrawal',
    ],
  },
  // ── FRT-015: Preflight check blocking ACCEPTED status on multi-truck freights ──
  {
    id: 'FRT-015',
    date: '2026-03-06',
    severity: 'CRITICAL',
    area: 'accept-freight',
    bug: 'Preflight check (line 190) required status === OPEN, blocking ACCEPTED multi-truck freights even though the first status gate (line 142) allowed them through.',
    rootCause: 'Contradição entre duas verificações de status na mesma função: a primeira permitia ACCEPTED, a segunda exigia OPEN. Fretes multi-truck com vagas ficavam impossíveis de aceitar após o primeiro motorista.',
    fix: 'Alterado preflight para aceitar OPEN e ACCEPTED via array acceptableStatuses.',
    files: ['supabase/functions/accept-freight-multiple/index.ts'],
    rules: [
      'AMBAS as verificações de status no accept-freight-multiple devem ser consistentes.',
      'O preflight check DEVE permitir status ACCEPTED para fretes multi-truck.',
      'A verificação real de vagas é feita pela contagem de assignments, NÃO pelo status do frete.',
    ],
    keywords: ['preflight', 'ACCEPTED', 'OPEN', 'status check', '409', 'multi-truck', 'accept'],
    testCases: [
      'accept_second_truck_on_accepted_freight',
      'preflight_allows_accepted_status',
      'status_checks_are_consistent',
    ],
  },
  // ── FRT-015b: "Disponíveis" counter not updating after accepting freight ──
  {
    id: 'FRT-015b',
    date: '2026-03-06',
    severity: 'HIGH',
    area: 'marketplace-feed',
    bug: 'After accepting a freight, the "Disponíveis" counter kept showing old count because SmartFreightMatcher had its own internal state that was never refreshed after acceptance.',
    rootCause: 'SmartFreightMatcher.handleFreightAction called onFreightAction and returned immediately without refetching its own internal compatibleFreights list. The freight:accepted event was only handled by DriverDashboard, not by SmartFreightMatcher.',
    fix: 'Added freight:accepted event listener in SmartFreightMatcher to trigger fetchCompatibleFreights after 1s delay. Also added delayed refetch in handleFreightAction after calling onFreightAction for accept actions.',
    files: ['src/components/SmartFreightMatcher.tsx'],
    rules: [
      'SmartFreightMatcher MUST refetch its internal list after any accept/withdraw action.',
      'The freight:accepted event MUST be listened to by SmartFreightMatcher, not just DriverDashboard.',
      'Counter updates require the SOURCE component to re-query, not just the parent.',
    ],
    keywords: ['Disponíveis', 'counter', 'SmartFreightMatcher', 'refetch', 'freight:accepted', 'stale count'],
    testCases: [
      'available_count_decreases_after_accept',
      'smart_matcher_refetches_on_freight_accepted_event',
    ],
  },
  // ── FRT-016: Double accept-freight-multiple call resets assignment to OPEN ──
  {
    id: 'FRT-016',
    date: '2026-03-06',
    severity: 'CRITICAL',
    area: 'accept-freight',
    bug: 'After FreightCard successfully accepted a freight, DriverDashboard.handleFreightAction called accept-freight-multiple AGAIN, causing a race condition that reset the assignment status from ACCEPTED to OPEN.',
    rootCause: 'FreightCard calls accept-freight-multiple directly, then calls onAction("accept"). DriverDashboard.handleFreightAction treated "accept" as a request to accept (calling the edge function again) instead of a notification that acceptance was already done.',
    fix: 'Changed handleFreightAction to treat action="accept" as "already accepted — just refresh data". No second edge function call.',
    files: ['src/pages/DriverDashboard.tsx'],
    rules: [
      'FreightCard owns the accept-freight-multiple call. DriverDashboard MUST NOT call it again.',
      'onAction("accept") means "acceptance complete, refresh data" — NOT "please accept".',
      'Assignment status OPEN is NEVER valid — it should always be ACCEPTED on creation.',
    ],
    keywords: ['double call', 'OPEN assignment', 'handleFreightAction', 'race condition', 'accept'],
    testCases: [
      'accept_creates_assignment_with_accepted_status',
      'driver_dashboard_does_not_call_edge_function_on_accept_action',
    ],
  },
  // ── FRT-017: Proposal RLS blocks drivers without vehicles ──
  {
    id: 'FRT-017',
    date: '2026-03-06',
    severity: 'CRITICAL',
    area: 'freight-proposals',
    bug: 'Drivers without registered vehicles could not send counter-proposals. RLS INSERT policy on freight_proposals required EXISTS(vehicles) check.',
    rootCause: 'The INSERT policy required the driver to have a vehicle registered OR a company vehicle assignment OR carrier role. Drivers in onboarding or without vehicles were silently blocked with error 42501.',
    fix: 'Removed vehicle requirement from freight_proposals INSERT policy. Vehicle check belongs at freight acceptance (accept-freight-multiple), not at proposal stage.',
    files: ['supabase/migrations/frt017_fix_proposal_rls_remove_vehicle_requirement.sql'],
    rules: [
      'freight_proposals INSERT policy MUST NOT require vehicle ownership.',
      'Vehicle checks belong at acceptance time, not proposal time.',
      'A driver with role driver/affiliated_driver/carrier can always PROPOSE.',
    ],
    keywords: ['42501', 'RLS', 'freight_proposals', 'vehicle', 'contraproposta', 'proposal'],
    testCases: [
      'driver_without_vehicle_can_send_proposal',
      'driver_without_vehicle_can_send_counter_proposal',
    ],
  },

  // ── FRT-018: GPS permission denied error (OS-PLUG-GLOC-0003) crashing app ──
  {
    id: 'FRT-018',
    date: '2026-03-06',
    severity: 'CRITICAL',
    area: 'gps-tracking',
    bug: 'Capacitor Geolocation plugin threw unhandled error OS-PLUG-GLOC-0003 ("Location permission request was denied") that propagated to console.error and crashed monitoring. Error appeared multiple times on driver dashboard.',
    rootCause: 'requestPermissionSafe() did not catch the specific OS-PLUG-GLOC-0003 error code from Capacitor. The error was thrown as a native exception and not caught by the generic try/catch because it was structured as {message, code} JSON string.',
    fix: 'requestPermissionSafe() now catches OS-PLUG-GLOC-0003 specifically and returns false gracefully. GPSPermissionDeniedDialog added to guide user to device settings. UnifiedTrackingControl shows dialog when permission is denied.',
    files: [
      'src/utils/location.ts',
      'src/components/GPSPermissionDeniedDialog.tsx',
      'src/components/UnifiedTrackingControl.tsx',
    ],
    rules: [
      'requestPermissionSafe() MUST catch OS-PLUG-GLOC-0003 and return false — NEVER throw.',
      'Permission denied MUST show a dialog guiding user to device settings, not just a toast.',
      'All Capacitor Geolocation errors with structured {message, code} format MUST be parsed before handling.',
    ],
    keywords: ['OS-PLUG-GLOC-0003', 'permission denied', 'GPS', 'Capacitor', 'geolocation', 'crash', 'unhandled'],
    testCases: [
      'permission_denied_returns_false_not_throw',
      'permission_denied_shows_settings_dialog',
      'os_plug_gloc_0003_is_caught_gracefully',
    ],
    runtimeGuard: 'gps-permission-denied-must-not-throw',
  },

  // ── FRT-019: App não detecta GPS desativado fora do app durante frete ativo ──
  {
    id: 'FRT-019',
    date: '2026-03-06',
    severity: 'CRITICAL',
    area: 'gps-tracking',
    bug: 'Quando o motorista desativava a localização do dispositivo nas configurações do Android (fora do app), o app continuava mostrando "Rastreamento Ativo" sem detectar a perda de GPS. Nenhum incidente era registrado e nenhuma notificação era enviada.',
    rootCause: 'Não existia mecanismo de polling periódico que verificasse o estado real do GPS do dispositivo durante o rastreamento ativo. O watchPosition do Capacitor simplesmente parava de emitir posições sem disparar erro explícito. O estado isTracking permanecia true indefinidamente.',
    fix: 'Criado hook useGPSWatchdog (src/hooks/useGPSWatchdog.ts) que faz polling a cada 10s via checkPermissionSafe() + getCurrentPositionSafe(). Após 2-3 falhas consecutivas: (1) marca gpsLost=true, (2) registra incident_logs com última posição, (3) salva última localização em profiles e driver_current_locations, (4) envia notificação persistente via send-notification, (5) para foreground service, (6) exibe alerta crítico na UI. Quando GPS é restaurado, reinicia tracking automaticamente.',
    files: [
      'src/hooks/useGPSWatchdog.ts',
      'src/components/UnifiedTrackingControl.tsx',
    ],
    rules: [
      'SEMPRE usar useGPSWatchdog quando rastreamento está ativo com frete ativo.',
      'GPS desativado DEVE registrar incident_logs com última posição conhecida.',
      'GPS desativado DEVE enviar notificação persistente ao motorista via edge function.',
      'GPS desativado DEVE salvar última localização em profiles E driver_current_locations.',
      'GPS restaurado DEVE reiniciar rastreamento automaticamente sem intervenção do motorista.',
      'Polling de saúde do GPS DEVE ocorrer a cada 10s durante rastreamento ativo.',
    ],
    keywords: ['GPS', 'desativado', 'watchdog', 'polling', 'localização', 'desligado', 'fora do app', 'rastreamento ativo', 'incident', 'notificação'],
    testCases: [
      'gps_disabled_detected_within_30s',
      'gps_disabled_logs_incident_with_last_position',
      'gps_disabled_sends_notification_to_driver',
      'gps_disabled_saves_last_location_to_profiles',
      'gps_restored_auto_restarts_tracking',
      'gps_watchdog_only_runs_during_active_freight',
    ],
    runtimeGuard: 'gps-watchdog-must-detect-disabled-location',
  },

  // ── FRT-020: OS-PLUG-GLOC-0007 error triggers monitor bot false alarm ──
  {
    id: 'FRT-020',
    date: '2026-03-06',
    severity: 'HIGH',
    area: 'gps-tracking',
    bug: 'Capacitor native bridge logged OS-PLUG-GLOC-0007 ("Location services are not enabled") directly to console.error via logFromNative, bypassing app error handling. This triggered the Telegram Monitor Bot with false alarms even though the app handled the error correctly.',
    rootCause: 'The console.error interceptors in supabase/client.ts and usePanelErrorTelegramReporter.ts did not filter Capacitor GPS native status errors (OS-PLUG-GLOC-*). Only WAKE_LOCK and ForegroundService errors were suppressed.',
    fix: 'Added OS-PLUG-GLOC, "Location services are not enabled", and "location permission" patterns to both console.error interceptors. supabase/client.ts now downgrades these to console.warn. usePanelErrorTelegramReporter.ts IGNORED_PATTERNS now includes these patterns to prevent Telegram alerts.',
    files: [
      'src/integrations/supabase/client.ts',
      'src/hooks/usePanelErrorTelegramReporter.ts',
    ],
    rules: [
      'ALL Capacitor Geolocation native errors (OS-PLUG-GLOC-*) MUST be suppressed from console.error interceptors.',
      'Native GPS status errors MUST be downgraded to console.warn, NEVER trigger monitor bot.',
      'New Capacitor plugin error codes MUST be added to suppression lists when discovered.',
    ],
    keywords: ['OS-PLUG-GLOC-0007', 'Location services', 'console.error', 'logFromNative', 'monitor bot', 'false alarm', 'Telegram'],
    testCases: [
      'gloc_0007_does_not_trigger_telegram_alert',
      'gloc_0007_downgraded_to_console_warn',
      'native_gps_errors_suppressed_in_all_interceptors',
    ],
    runtimeGuard: 'native-gps-errors-must-not-trigger-alerts',
  },

  // ── FRT-021: Withdrawn driver can navigate to freight via notifications and attempt status update ──
  {
    id: 'FRT-021',
    date: '2026-03-06',
    severity: 'HIGH',
    area: 'notifications',
    bug: 'Driver who withdrew from a freight could still navigate to FreightDetails via notification click and attempt to update the freight status, causing "Não foi possível atualizar o status" error.',
    rootCause: 'NotificationCenter.handleNotificationClick only checked if the freight was CANCELLED, but did not verify the driver\'s assignment status (WITHDRAWN/CANCELLED) before allowing navigation.',
    fix: 'Added freight_assignments status check in handleNotificationClick. If the driver\'s assignment is WITHDRAWN or CANCELLED, navigation is blocked and a toast message informs the driver they no longer have a link to that freight.',
    files: [
      'src/components/NotificationCenter.tsx',
    ],
    rules: [
      'Notification navigation to freight details MUST verify the driver\'s assignment status before redirecting.',
      'Drivers with WITHDRAWN or CANCELLED assignments MUST be blocked from freight details navigation.',
      'Any freight-related notification action MUST validate the user\'s current relationship with the freight.',
    ],
    keywords: ['notification', 'withdrawn', 'cancelled', 'assignment', 'navigate', 'status update', 'freight_assignments'],
    testCases: [
      'withdrawn_driver_cannot_navigate_to_freight_via_notification',
      'cancelled_assignment_blocks_notification_navigation',
      'active_driver_can_still_navigate_via_notification',
    ],
    runtimeGuard: 'withdrawn-driver-must-not-access-freight-details',
  },

  // ── FRT-022: Freight appears in both Available and Ongoing tabs simultaneously ──
  {
    id: 'FRT-022',
    date: '2026-03-06',
    severity: 'CRITICAL',
    area: 'marketplace-feed',
    bug: 'Multi-truck freights (accepted_trucks < required_trucks) remained in the Available tab even after the driver accepted and had an active assignment, causing the same freight to appear in both Available and Ongoing tabs.',
    rootCause: 'get_authoritative_feed RPC returns all OPEN freights with available slots. fetchAvailableFreights did not cross-reference freight_assignments to exclude freights where the current driver already has an active assignment.',
    fix: 'Added freight_assignments and direct freight (driver_id) queries in fetchAvailableFreights to build an exclusion set. Freights where the driver has any active assignment (OPEN/ACCEPTED/LOADING/LOADED/IN_TRANSIT/DELIVERED_PENDING_CONFIRMATION) are filtered out before rendering in the Available tab.',
    files: [
      'src/pages/DriverDashboard.tsx',
    ],
    rules: [
      'fetchAvailableFreights MUST exclude freights where the driver has an active assignment.',
      'A freight MUST NEVER appear simultaneously in Available and Ongoing tabs for the same driver.',
      'Any change to the feed RPC or marketplace filters MUST preserve the assignment exclusion logic.',
    ],
    keywords: ['available', 'ongoing', 'duplicate', 'multi-truck', 'assignment', 'marketplace', 'feed', 'tabs'],
    testCases: [
      'accepted_freight_not_shown_in_available_tab',
      'multi_truck_freight_hidden_from_available_after_driver_accepts',
      'withdrawn_freight_reappears_in_available_tab',
    ],
    runtimeGuard: 'available-feed-must-exclude-driver-active-assignments',
  },

  // ── BUG #023 — RPC usava nome de coluna inexistente (driver_profile_id em stop_events) ──
  {
    id: 'FRT-023',
    date: '2026-03-06',
    severity: 'CRITICAL',
    area: 'freight-withdrawal',
    bug: 'RPC process_freight_withdrawal retornava 409 "column driver_profile_id does not exist" ao tentar desistir de frete.',
    rootCause: 'A RPC referenciava "driver_profile_id" na tabela stop_events, mas a coluna real é "driver_id". Erro de mismatch entre o nome usado na RPC e o esquema real da tabela.',
    fix: 'RPC recriada via CREATE OR REPLACE com DELETE FROM stop_events usando driver_id (nome correto). NOTIFY pgrst reload schema para limpar cache do PostgREST.',
    files: [
      'supabase/migrations/*_process_freight_withdrawal.sql',
      'supabase/functions/withdraw-freight/index.ts',
    ],
    rules: [
      'RPCs que fazem DELETE/UPDATE em tabelas DEVEM usar os nomes de coluna exatos do esquema atual.',
      'Antes de referenciar uma coluna em RPC, VERIFICAR via information_schema.columns se o nome existe.',
      'Após qualquer CREATE OR REPLACE de RPC, SEMPRE executar NOTIFY pgrst, reload schema.',
      'Tabelas de tracking (stop_events, driver_trip_progress) usam "driver_id", NÃO "driver_profile_id".',
    ],
    keywords: ['driver_profile_id', 'driver_id', 'stop_events', 'column does not exist', 'RPC', 'schema mismatch', '409'],
    testCases: [
      'withdrawal_rpc_uses_correct_column_names_for_stop_events',
      'withdrawal_rpc_cleans_all_trip_data_without_column_errors',
      'schema_column_names_match_rpc_references',
    ],
    runtimeGuard: 'rpc-column-names-must-match-table-schema',
  },

  // ── FRT-024: RLS dynamic_credit_limits missing INSERT/UPDATE policies ──
  {
    id: 'FRT-024',
    date: '2026-03-07',
    severity: 'CRITICAL',
    area: 'rls-policies',
    bug: 'Edge function ou hook de crédito dinâmico retornava 42501 ao tentar INSERT/UPDATE em dynamic_credit_limits. Motorista não conseguia recalcular crédito.',
    rootCause: 'Tabela dynamic_credit_limits tinha RLS habilitado mas sem políticas de INSERT ou UPDATE para role authenticated. SELECT existia mas INSERT/UPDATE não.',
    fix: 'Migração adicionando políticas SELECT, INSERT e UPDATE com escopo profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()).',
    files: [
      'supabase/migrations/20260307130330_*.sql',
    ],
    rules: [
      'Toda tabela com RLS DEVE ter políticas explícitas para TODAS as operações necessárias (SELECT, INSERT, UPDATE, DELETE).',
      'Ao criar tabela com RLS, NUNCA esquecer de adicionar políticas — RLS sem políticas = acesso negado para tudo.',
      'Políticas de INSERT/UPDATE devem usar get_my_profile_id() ou subconsulta a profiles com auth.uid().',
    ],
    keywords: ['42501', 'RLS', 'dynamic_credit_limits', 'INSERT', 'UPDATE', 'policy missing', 'crédito dinâmico'],
    testCases: [
      'driver_can_insert_dynamic_credit_limit',
      'driver_can_update_own_dynamic_credit_limit',
      'driver_cannot_update_other_user_credit_limit',
    ],
  },

  // ── FRT-025: Duplicate key on freight_proposals (23505) ──
  {
    id: 'FRT-025',
    date: '2026-03-07',
    severity: 'HIGH',
    area: 'freight-proposals',
    bug: 'Enviar proposta duas vezes (double-click ou re-envio) causava erro 23505 "duplicate key value violates unique constraint" com toast de erro genérico assustando o usuário.',
    rootCause: 'Modais de proposta (ProposalModal, FlexibleProposalModal, ServiceProposalModal) não tratavam erro 23505 especificamente. O catch genérico mostrava toast de erro crítico.',
    fix: 'Tratamento específico de error.code === "23505" nos 3 modais com toast amigável "Proposta já enviada" e fechamento do modal.',
    files: [
      'src/components/ProposalModal.tsx',
      'src/components/FlexibleProposalModal.tsx',
      'src/components/ServiceProposalModal.tsx',
    ],
    rules: [
      'TODA operação de INSERT com unique constraint DEVE tratar erro 23505 com mensagem amigável.',
      'Erro 23505 NUNCA deve mostrar toast de erro genérico — sempre usar mensagem contextual (ex: "Proposta já enviada", "Avaliação já registrada").',
      'Considerar desabilitar botão após primeiro clique para prevenir double-submit.',
    ],
    keywords: ['23505', 'duplicate key', 'unique constraint', 'proposta', 'double click', 'ProposalModal', 'toast'],
    testCases: [
      'duplicate_proposal_shows_friendly_message',
      'duplicate_proposal_closes_modal',
      'duplicate_proposal_does_not_show_critical_error',
    ],
  },

  // ── FRT-026: SafeAuthModal production black screen (createPortal failure) ──
  {
    id: 'FRT-026',
    date: '2026-03-04',
    severity: 'CRITICAL',
    area: 'auth-modal',
    bug: 'Botão "Cadastrar-se" na Landing page causava tela preta em produção. Modal de autenticação não renderizava — overlay aparecia mas conteúdo ficava vazio.',
    rootCause: 'Dialog/Portal do Radix falhava silenciosamente em produção. useEffect notificava mount ANTES do DOM ser pintado. Overlay ficava preso sem conteúdo visível. Timeouts muito agressivos para conexões lentas.',
    fix: 'Criado SafeAuthModal com 3 níveis de fallback: (1) Radix Dialog normal, (2) Radix FallbackAuthModal, (3) InlineFallbackModal sem Portal/Dialog. Em produção, usa inline diretamente. Verificação DOM REAL com data-attribute após 2 RAFs. Timeouts tolerantes (1.5s, 3s, 5s). Detecção de conexão lenta.',
    files: [
      'src/components/SafeAuthModal.tsx',
      'src/components/AuthModal.tsx',
      'src/pages/Landing.tsx',
    ],
    rules: [
      'NUNCA usar createPortal para modais críticos em produção — Radix Dialog/Portal pode falhar silenciosamente.',
      'SafeAuthModal DEVE ter fallback inline (sem Portal) que funciona mesmo quando Radix falha.',
      'Em produção (IS_PRODUCTION_DOMAIN), SEMPRE usar inline fallback imediatamente — não esperar timeout.',
      'Verificação de renderização DEVE usar data-attributes no DOM real, não estado React.',
      'Overlay/backdrop NUNCA deve ficar travado — implementar cleanup em todos os caminhos de erro.',
    ],
    keywords: ['tela preta', 'black screen', 'createPortal', 'SafeAuthModal', 'Radix', 'Dialog', 'Portal', 'cadastrar', 'produção', 'overlay'],
    testCases: [
      'auth_modal_renders_in_production_without_portal',
      'auth_modal_fallback_activates_on_slow_connection',
      'overlay_never_stays_stuck_without_content',
      'inline_fallback_renders_same_auth_form',
    ],
  },

  // ── FRT-027: guest_requests overly permissive SELECT policy ──
  {
    id: 'FRT-027',
    date: '2026-03-04',
    severity: 'CRITICAL',
    area: 'rls-policies',
    bug: 'Qualquer usuário autenticado conseguia ler TODOS os guest_requests, expondo telefone, nome e dados de contato de prospects.',
    rootCause: 'Política guest_requests_select_auth permitia SELECT para qualquer authenticated sem filtro de ownership ou role. Políticas redundantes sobrepostas usando role "public" (que inclui anon).',
    fix: 'DROP da política permissiva. Recriadas políticas limpas: anon INSERT com validação de campos, authenticated INSERT com validação, anon SELECT deny explícito. Mantida política existente de admin/assigned provider para SELECT.',
    files: [
      'supabase/migrations/20260304023828_*.sql',
    ],
    rules: [
      'NUNCA criar política SELECT sem filtro de ownership ou role para tabelas com dados de contato.',
      'Políticas de SELECT para dados sensíveis DEVEM restringir a owner, admin ou provider atribuído.',
      'Ao usar role "public" em políticas, lembrar que inclui "anon" — preferir "authenticated" ou "anon" explicitamente.',
      'Auditar políticas sobrepostas antes de criar novas — remover redundâncias.',
    ],
    keywords: ['guest_requests', 'SELECT', 'permissive', 'contato', 'telefone', 'RLS', 'exposição', 'authenticated'],
    testCases: [
      'random_authenticated_user_cannot_read_guest_requests',
      'admin_can_read_guest_requests',
      'assigned_provider_can_read_own_guest_requests',
      'anon_cannot_select_guest_requests',
    ],
  },

  // ── FRT-028: get_my_profile_id_for_pii missing hardening ──
  {
    id: 'FRT-028',
    date: '2026-03-06',
    severity: 'HIGH',
    area: 'security-functions',
    bug: 'Função get_my_profile_id_for_pii() não tinha search_path fixo, não verificava auth.uid() NULL, e era executável por anon.',
    rootCause: 'Função SECURITY DEFINER sem SET search_path = public era vulnerável a search_path hijacking. Sem verificação explícita de auth.uid() NULL, retornava NULL silenciosamente para chamadas não-autenticadas. EXECUTE não estava revogado de PUBLIC/anon.',
    fix: 'CREATE OR REPLACE com: SET search_path = public, verificação explícita de auth.uid() IS NULL com RAISE EXCEPTION, REVOKE EXECUTE de PUBLIC e anon, GRANT apenas para authenticated.',
    files: [
      'supabase/migrations/20260306195742_*.sql',
    ],
    rules: [
      'TODA função SECURITY DEFINER DEVE ter SET search_path = public.',
      'Funções que usam auth.uid() DEVEM verificar NULL explicitamente e levantar exceção.',
      'REVOKE EXECUTE FROM PUBLIC e anon para funções que acessam dados sensíveis.',
      'GRANT EXECUTE apenas para roles que realmente precisam (authenticated, service_role).',
    ],
    keywords: ['get_my_profile_id_for_pii', 'search_path', 'REVOKE', 'SECURITY DEFINER', 'anon', 'hardening'],
    testCases: [
      'pii_function_has_search_path_set',
      'pii_function_rejects_unauthenticated_calls',
      'anon_cannot_execute_pii_function',
    ],
  },

  // ── FRT-029: update_updated_at_column missing search_path ──
  {
    id: 'FRT-029',
    date: '2026-03-06',
    severity: 'MEDIUM',
    area: 'security-functions',
    bug: 'Trigger function update_updated_at_column() não tinha SET search_path, vulnerável a search_path hijacking.',
    rootCause: 'Função de trigger usada em dezenas de tabelas não tinha search_path fixo. Embora seja uma função simples (NEW.updated_at = now()), sem search_path fixo um atacante com permissão CREATE SCHEMA poderia interceptar a resolução de now().',
    fix: 'CREATE OR REPLACE com SET search_path = public.',
    files: [
      'supabase/migrations/20260306181601_*.sql',
    ],
    rules: [
      'TODA função de trigger DEVE ter SET search_path = public, mesmo as simples.',
      'Ao criar/alterar funções, SEMPRE incluir search_path — não é opcional.',
    ],
    keywords: ['update_updated_at_column', 'search_path', 'trigger', 'hijacking'],
    testCases: [
      'updated_at_trigger_has_search_path',
    ],
  },

  // ── FRT-030: recalc_freight_accepted_trucks not reverting to OPEN with 0 assignments ──
  {
    id: 'FRT-030',
    date: '2026-03-06',
    severity: 'CRITICAL',
    area: 'freight-trigger-interference',
    bug: 'Quando todos os motoristas desistiam de um frete, recalc_freight_accepted_trucks mantinha status ACCEPTED em vez de reverter para OPEN. Frete ficava "fantasma" — ACCEPTED sem nenhum assignment ativo.',
    rootCause: 'Trigger não tratava o caso de actual_count = 0 quando o frete já estava ACCEPTED. A lógica só cobria "fully booked" e "partially filled", ignorando "empty after all withdrew".',
    fix: 'Adicionado bloco explícito: ELSIF COALESCE(actual_count, 0) = 0 THEN new_status = OPEN para fretes em ACCEPTED/OPEN/IN_NEGOTIATION. Também excluído WITHDRAWN da contagem de assignments ativos.',
    files: [
      'supabase/migrations/20260306124423_*.sql',
    ],
    rules: [
      'recalc_freight_accepted_trucks DEVE tratar explicitamente o caso de 0 assignments ativos → OPEN.',
      'Contagem de assignments ativos DEVE excluir CANCELLED, REJECTED e WITHDRAWN.',
      'Ao corrigir triggers, testar com: 0 assignments, 1 assignment, N assignments, todos WITHDRAWN.',
    ],
    keywords: ['recalc', 'accepted_trucks', '0 assignments', 'ACCEPTED', 'OPEN', 'fantasma', 'revert', 'WITHDRAWN'],
    testCases: [
      'recalc_reverts_to_open_when_zero_active_assignments',
      'recalc_excludes_withdrawn_from_count',
      'freight_not_stuck_accepted_after_all_withdrawals',
    ],
  },

  // ── FRT-031: OPEN assignments not auto-fixed to ACCEPTED ──
  {
    id: 'FRT-031',
    date: '2026-03-06',
    severity: 'HIGH',
    area: 'freight-data-integrity',
    bug: 'Assignments criados com status OPEN não eram automaticamente corrigidos para ACCEPTED, causando inconsistências em cadeia (FRT-006, FRT-008, FRT-010, FRT-016).',
    rootCause: 'accept-freight-multiple criava assignments com status OPEN ao invés de ACCEPTED. Migração de data fix necessária para corrigir assignments existentes.',
    fix: 'Migração de correção: UPDATE freight_assignments SET status = ACCEPTED WHERE status = OPEN AND created_at > now() - interval 7 days. Também corrigiu freights correspondentes com driver_id, accepted_trucks e drivers_assigned.',
    files: [
      'supabase/migrations/20260306175538_*.sql',
    ],
    rules: [
      'Assignments DEVEM ser criados com status ACCEPTED, NUNCA OPEN.',
      'Data fix migrations devem ser criadas quando inconsistências são detectadas.',
      'Ao corrigir assignments, SEMPRE sincronizar freights correspondentes (driver_id, accepted_trucks, drivers_assigned).',
    ],
    keywords: ['OPEN assignment', 'ACCEPTED', 'data fix', 'migration', 'inconsistência', 'sync'],
    testCases: [
      'new_assignments_created_with_accepted_status',
      'no_open_assignments_exist_after_migration',
    ],
  },

  // ── FRT-032: Fiscal certificate status 'certificate_uploaded' not recognized ──
  {
    id: 'FRT-032',
    date: '2026-03-05',
    severity: 'HIGH',
    area: 'fiscal-module',
    bug: 'Após upload de certificado digital via Edge Function, o status ficava como "certificate_uploaded" mas FiscalTab.tsx não reconhecia esse status, mostrando "Configure seu emissor fiscal" mesmo com certificado válido.',
    rootCause: 'FiscalTab.tsx verificava apenas status === "ACTIVE" e sefaz_status === "validated". Edge Function definia status "certificate_uploaded" após upload bem-sucedido, que não era reconhecido pela UI.',
    fix: 'Adicionado "certificate_uploaded" à lista de status que indicam certificado presente. Também incluído case-insensitive check para "active"/"ACTIVE".',
    files: [
      'src/components/fiscal/tabs/FiscalTab.tsx',
      'src/components/fiscal/tabs/FiscalIssuerSetup.tsx',
    ],
    rules: [
      'TODA verificação de status fiscal DEVE incluir todos os status possíveis: ACTIVE, active, certificate_uploaded.',
      'Ao adicionar novos status em Edge Functions, ATUALIZAR IMEDIATAMENTE os checks na UI.',
      'Status checks devem ser case-insensitive ou normalizados para evitar mismatches.',
    ],
    keywords: ['certificate_uploaded', 'fiscal', 'certificado', 'status', 'FiscalTab', 'emissor', 'hasCertificate'],
    testCases: [
      'certificate_uploaded_status_recognized_as_valid',
      'fiscal_tab_shows_correct_state_after_upload',
    ],
  },

  // ── FRT-033: SubscriptionContext infinite loop from user object reference ──
  {
    id: 'FRT-033',
    date: '2026-03-05',
    severity: 'CRITICAL',
    area: 'subscription-context',
    bug: 'SubscriptionContext causava loop infinito de re-renders e queries ao Supabase. App ficava extremamente lento e eventualmente travava.',
    rootCause: 'useEffect dependia do objeto user completo. Supabase Auth recria o objeto user a cada tick/revalidação mesmo quando os dados são idênticos. Isso causava re-execução contínua do useEffect, que fazia novas queries, que atualizavam state, causando mais re-renders.',
    fix: 'Usar useRef para armazenar user?.id e comparar. useEffect só executa quando user?.id realmente muda, não quando o objeto é recriado.',
    files: [
      'src/contexts/SubscriptionContext.tsx',
    ],
    rules: [
      'NUNCA usar o objeto user do Supabase Auth como dependência de useEffect — usar user?.id.',
      'Objetos que são recriados frequentemente (auth state, query results) DEVEM ser comparados por valor, não referência.',
      'useRef para IDs estáveis + comparação explícita evita loops de re-render.',
    ],
    keywords: ['infinite loop', 'useEffect', 'user', 'SubscriptionContext', 'rerender', 're-render', 'travando', 'lento'],
    testCases: [
      'subscription_context_does_not_requery_on_same_user_id',
      'subscription_context_updates_on_user_change',
      'no_infinite_loop_on_auth_state_change',
    ],
  },

  // ── FRT-034: processar-cadastro-motorista missing rate limiting and validation ──
  {
    id: 'FRT-034',
    date: '2026-03-04',
    severity: 'HIGH',
    area: 'edge-function-security',
    bug: 'Edge function processar-cadastro-motorista não tinha rate limiting nem validação de input com Zod. Qualquer requisição com token era processada sem limites.',
    rootCause: 'Função original foi criada sem camadas de segurança defensiva. Sem rate limiting, um atacante poderia fazer brute-force de tokens de convite. Sem Zod validation, inputs malformados poderiam causar erros inesperados.',
    fix: 'Adicionado rate limiting por IP (3/min), Zod schema validation para todos os campos de input, CORS headers padronizados, mensagens de erro genéricas (sem detalhes internos), validação de formato UUID para token.',
    files: [
      'supabase/functions/processar-cadastro-motorista/index.ts',
    ],
    rules: [
      'TODA Edge Function DEVE ter rate limiting por IP.',
      'TODA Edge Function DEVE validar input com Zod schema.',
      'Mensagens de erro NUNCA devem expor detalhes internos (stack trace, nomes de tabela, etc).',
      'Tokens/IDs de input DEVEM ser validados como UUID antes de queries ao banco.',
    ],
    keywords: ['processar-cadastro-motorista', 'rate limiting', 'Zod', 'validation', 'brute force', 'token'],
    testCases: [
      'rate_limited_after_3_requests_per_minute',
      'invalid_token_format_rejected_before_db_query',
      'error_messages_do_not_expose_internals',
    ],
  },

  // ── FRT-035: delete-user-account getUser() → getClaims() migration ──
  {
    id: 'FRT-035',
    date: '2026-03-04',
    severity: 'HIGH',
    area: 'edge-function-security',
    bug: 'Edge function delete-user-account usava getUser() com service_role key para validar auth, o que era incompatível com signing-keys e menos seguro.',
    rootCause: 'getUser() com service_role faz uma query ao banco auth.users — mais lento e bypassa validação JWT. Deveria usar getClaims() com anon key que valida o JWT localmente via signing keys.',
    fix: 'Migrado para getClaims() com anon key. CORS headers atualizados para compatibilidade com plataforma.',
    files: [
      'supabase/functions/delete-user-account/index.ts',
    ],
    rules: [
      'Edge Functions DEVEM usar getClaims() ou getUser() com anon key para validar auth — NUNCA service_role para auth validation.',
      'getClaims() é preferível: valida JWT localmente, mais rápido, compatível com signing-keys.',
      'service_role DEVE ser usado apenas para operações administrativas APÓS a autenticação ser confirmada.',
    ],
    keywords: ['getUser', 'getClaims', 'service_role', 'anon key', 'signing-keys', 'delete-user-account', 'JWT'],
    testCases: [
      'auth_validated_via_claims_not_service_role',
      'unauthenticated_request_rejected_with_401',
    ],
  },

  // ── FRT-036: toast.error for 23505 duplicate triggers monitor bot false alarm ──
  {
    id: 'FRT-036',
    date: '2026-03-07',
    severity: 'HIGH',
    area: 'error-monitoring',
    bug: 'Erro 23505 (proposta/atribuição duplicada) usava toast.error que era interceptado pelo usePanelErrorTelegramReporter, disparando alerta falso no Monitor Bot do Telegram. Mensagem "Você já enviou uma proposta para este serviço" aparecia como erro crítico.',
    rootCause: 'ServiceProposalModal, FlexibleProposalModal, ProposalModal e ShareFreightToDriver usavam toast.error ou variant "destructive" para erros 23505. O interceptor de toast.error no usePanelErrorTelegramReporter captura QUALQUER toast.error e envia ao Telegram como erro real.',
    fix: 'Trocado toast.error por toast.info (com id único para dedup) em todos os 4 componentes. ProposalModal: removido variant "destructive". Erro 23505 é validação esperada, não erro de sistema.',
    files: [
      'src/components/ServiceProposalModal.tsx',
      'src/components/FlexibleProposalModal.tsx',
      'src/components/ProposalModal.tsx',
      'src/components/ShareFreightToDriver.tsx',
    ],
    rules: [
      'Erro 23505 (duplicate key) NUNCA deve usar toast.error — SEMPRE toast.info ou toast() sem variant destructive.',
      'toast.error é interceptado pelo Monitor Bot — usar APENAS para erros reais de sistema.',
      'Erros de validação esperados (duplicata, conflito) DEVEM usar toast.info com id único.',
      'Ao tratar 23505, adicionar id ao toast (ex: { id: "duplicate-proposal" }) para evitar toasts duplicados.',
    ],
    keywords: ['toast.error', 'toast.info', '23505', 'duplicate', 'monitor bot', 'Telegram', 'falso alarme', 'proposta', 'interceptor'],
    testCases: [
      'duplicate_proposal_uses_toast_info_not_error',
      'duplicate_proposal_does_not_trigger_telegram_alert',
      'toast_id_prevents_duplicate_notifications',
    ],
  },

  // ── FRT-037: Propostas pendentes invisíveis para o produtor ──
  {
    id: 'FRT-037',
    date: '2026-03-07',
    severity: 'CRITICAL',
    area: 'proposals',
    bug: 'Propostas de motoristas com status PENDING não apareciam na aba "Pendentes" do produtor. O produtor via "Nenhuma proposta pendente" mesmo com propostas existentes no banco.',
    rootCause: 'filterProposalsByStatus() e os contadores usavam canAcceptProposal() como gate para exibir propostas PENDING e COUNTER_PROPOSED. canAcceptProposal() retorna false quando freight.accepted_trucks >= required_trucks ou freight.status != OPEN, escondendo propostas válidas da UI.',
    fix: 'Removido canAcceptProposal() como filtro de exibição nas abas Pendentes e Contrapropostas. canAcceptProposal() agora é usado APENAS para desabilitar o botão de aceitar (disabled prop). Todas as propostas PENDING são sempre visíveis.',
    files: [
      'src/components/FreightProposalsManager.tsx',
    ],
    rules: [
      'canAcceptProposal() NUNCA deve ser usado como filtro de exibição em filterProposalsByStatus() — APENAS para desabilitar botões.',
      'Propostas PENDING e COUNTER_PROPOSED DEVEM sempre ser visíveis nas respectivas abas, independente do estado do frete.',
      'Contadores de propostas (pendingCount, counterProposedCount) DEVEM contar TODAS as propostas no status, sem filtro adicional.',
    ],
    keywords: ['canAcceptProposal', 'filterProposalsByStatus', 'pendingCount', 'PENDING', 'proposals', 'produtor', 'FreightProposalsManager', 'invisível'],
    testCases: [
      'pending_proposals_visible_even_when_freight_full',
      'counter_proposed_visible_when_freight_not_open',
      'accept_button_disabled_when_cannot_accept',
    ],
  },
  {
    id: 'FRT-038',
    date: '2026-03-07',
    severity: 'CRITICAL',
    area: 'proposals',
    bug: 'Motorista não conseguia re-enviar proposta de FRETE após cancelar a anterior. Erro 23505 (unique constraint violation) ao inserir nova proposta.',
    rootCause: 'Existia um UNIQUE constraint incondicional (freight_proposals_freight_id_driver_id_key) que impedia qualquer inserção duplicada de (freight_id, driver_id), mesmo quando a proposta anterior estava CANCELLED ou REJECTED. O partial index idx_unique_active_proposal já cobria o cenário correto.',
    fix: 'Removido o UNIQUE constraint freight_proposals_freight_id_driver_id_key via migração. O partial index idx_unique_active_proposal (WHERE status IN PENDING, ACCEPTED) já garante que só exista uma proposta ativa por par freight_id/driver_id. Frontend atualizado para verificar apenas status ativos (PENDING, ACCEPTED, COUNTER_PROPOSED) antes de inserir.',
    files: [
      'src/components/ServiceProposalModal.tsx',
      'supabase/migrations/20260307140331_c9b43e6f-2eef-4fa2-b28b-153ca8b1baf5.sql',
    ],
    rules: [
      'NUNCA usar UNIQUE constraint incondicional em freight_proposals(freight_id, driver_id) — usar PARTIAL INDEX com WHERE status IN (PENDING, ACCEPTED).',
      'Verificação de duplicata no frontend DEVE filtrar por status ativos (PENDING, ACCEPTED, COUNTER_PROPOSED), não por existência absoluta.',
      'Propostas CANCELLED e REJECTED NÃO devem bloquear re-envio.',
    ],
    keywords: ['unique constraint', '23505', 'freight_proposals', 're-enviar', 'cancelar', 'CANCELLED', 'partial index', 'duplicate'],
    testCases: [
      'driver_can_resubmit_proposal_after_cancel',
      'driver_cannot_have_two_pending_proposals_same_freight',
      'cancelled_proposal_does_not_block_new_insert',
    ],
  },
  {
    id: 'FRT-039',
    date: '2026-03-07',
    severity: 'HIGH',
    area: 'proposals',
    bug: 'AI confundia FRETES com SERVIÇOS ao diagnosticar e corrigir bugs de propostas. Adicionou código de propostas de serviço (service_request_proposals) quando o problema era com propostas de FRETE (freight_proposals).',
    rootCause: 'O componente de proposta de frete se chama ServiceProposalModal.tsx, causando confusão semântica. A edge function driver-proposals retorna ambos tipos, e a AI não distinguiu corretamente qual tabela estava envolvida.',
    fix: 'Esclarecido que ServiceProposalModal.tsx é usado para FRETES (insere em freight_proposals). A separação frete vs serviço é rigorosa: freight_proposals para fretes rurais, service_request_proposals para serviços urbanos.',
    files: [
      'src/components/ServiceProposalModal.tsx',
      'supabase/functions/driver-proposals/index.ts',
    ],
    rules: [
      'ServiceProposalModal.tsx é para FRETES — insere em freight_proposals. NUNCA confundir com service_request_proposals.',
      'Fretes rurais (CARGA) usam freight_proposals. Serviços urbanos (GUINCHO, MUDANCA, FRETE_MOTO, ENTREGA_PACOTES, TRANSPORTE_PET) usam service_request_proposals.',
      'NUNCA misturar propostas de frete com propostas de serviço nas mesmas abas ou contadores.',
      'A aba "Propostas Feitas" do motorista DEVE manter seções separadas: "Propostas de Frete" e "Propostas de Serviço".',
    ],
    keywords: ['ServiceProposalModal', 'freight_proposals', 'service_request_proposals', 'confusão', 'frete', 'serviço', 'separação'],
    testCases: [
      'service_proposal_modal_inserts_into_freight_proposals',
      'freight_and_service_proposals_rendered_separately',
      'service_types_never_in_freight_proposals_tab',
    ],
  },
  // ── FRT-040: Counter proposal card buttons stacking/overlapping on mobile ──
  {
    id: 'FRT-040',
    date: '2026-03-07',
    severity: 'HIGH',
    area: 'driver-dashboard-ui',
    bug: 'Card de contraproposta no DriverDashboard tinha botões (Aceitar/Negociar/Recusar) empilhados verticalmente e o botão Aceitar cobria os outros no mobile.',
    rootCause: 'Botões usavam grid-cols-1 sm:grid-cols-2 com sm:col-span-2 lg:col-span-1 no botão Aceitar, causando empilhamento no mobile e tamanho desproporcional no tablet. Classe gradient-primary aplicava color:white!important e estilos inconsistentes.',
    fix: 'Grid fixo grid-cols-3 gap-2 sem breakpoints. Removido gradient-primary e sm:col-span-2. Todos os botões com h-9 w-full text-xs font-medium rounded-xl justify-center. Ícones com shrink-0, texto com truncate.',
    files: [
      'src/pages/DriverDashboard.tsx',
    ],
    rules: [
      'Botões de ação em cards de proposta DEVEM usar grid-cols-3 fixo, NUNCA breakpoints responsivos que causam empilhamento.',
      'NUNCA usar gradient-primary em botões de ação — causa inconsistências de tamanho e cor.',
      'NUNCA usar col-span-2 em botões de ação de proposta — todos devem ter mesmo tamanho.',
      'Botões devem ter h-9, text-xs, truncate no label, e shrink-0 nos ícones.',
    ],
    keywords: ['grid-cols-3', 'gradient-primary', 'col-span-2', 'empilhamento', 'botões', 'contraproposta', 'DriverDashboard', 'mobile', 'overflow-hidden'],
    testCases: [
      'counter_proposal_buttons_side_by_side_on_mobile',
      'accept_button_same_size_as_others',
      'no_gradient_primary_on_action_buttons',
    ],
  },

  // ── FRT-041: XCircle import missing crashes DriverDashboard ──
  {
    id: 'FRT-041',
    date: '2026-03-07',
    severity: 'CRITICAL',
    area: 'driver-dashboard-ui',
    bug: 'DriverDashboard crashava com "XCircle is not defined" ao adicionar ícone XCircle nos botões de contraproposta sem importar o ícone.',
    rootCause: 'Ao refatorar os botões de contraproposta (FRT-040), o ícone XCircle foi adicionado ao JSX mas não foi incluído no import de lucide-react. Build passava mas runtime falhava.',
    fix: 'Adicionado XCircle ao import existente de lucide-react na linha 28 do DriverDashboard.tsx.',
    files: [
      'src/pages/DriverDashboard.tsx',
    ],
    rules: [
      'Ao adicionar ícones Lucide no JSX, SEMPRE verificar se estão no import de lucide-react.',
      'Testar runtime após adicionar novos ícones — build pode não detectar referências faltantes em componentes grandes.',
      'NUNCA confiar que build success = runtime success para componentes com muitos imports.',
    ],
    keywords: ['XCircle', 'lucide-react', 'import', 'not defined', 'crash', 'DriverDashboard', 'ReferenceError'],
    testCases: [
      'all_lucide_icons_in_jsx_are_imported',
      'driver_dashboard_renders_without_reference_errors',
    ],
  },
  // ── FRT-042: Form validation toast.error triggers Monitor Bot false alarms ──
  {
    id: 'FRT-042',
    date: '2026-03-07',
    severity: 'HIGH',
    area: 'error-monitoring',
    bug: 'Validações de campo obrigatório em CompleteProfile e DriverPayoutModal usavam toast.error, disparando alertas CRITICAL falsos no Monitor Bot do Telegram.',
    rootCause: 'toast.error é interceptado pelo usePanelErrorTelegramReporter como erro real de sistema. Validações de formulário (campo vazio, CPF inválido, CNH vencida, selfie ausente) são comportamento esperado, não erros.',
    fix: 'Trocado toast.error por toast() (neutro) com id único para dedup em todas as validações de formulário: missing fields, invalid document, missing docs, CNH validation, missing selfie.',
    files: [
      'src/pages/CompleteProfile.tsx',
      'src/components/DriverPayoutModal.tsx',
    ],
    rules: [
      'Validações de formulário (campo obrigatório, formato inválido) DEVEM usar toast() ou toast.info — NUNCA toast.error.',
      'toast.error é RESERVADO para erros reais de sistema (falha de rede, erro de banco, crash).',
      'Sempre adicionar id ao toast de validação para evitar duplicatas (ex: { id: "missing-fields" }).',
      'Extensão do FRT-036: aplica-se a TODOS os formulários, não apenas propostas.',
    ],
    keywords: ['toast.error', 'toast', 'validação', 'campo obrigatório', 'CompleteProfile', 'DriverPayoutModal', 'monitor bot', 'falso alarme', 'preencha'],
    testCases: [
      'form_validation_uses_neutral_toast_not_error',
      'missing_field_toast_does_not_trigger_telegram',
      'system_errors_still_use_toast_error',
    ],
  },

  // ── FRT-044: ChunkLoadError on landing page crashes app for iPhone/Safari users ──
  {
    id: 'FRT-044',
    date: '2026-03-09',
    severity: 'CRITICAL',
    area: 'lazy-loading-chunk-recovery',
    bug: 'Usuários iPhone/Safari viam tela branca na página inicial (/) porque React.lazy() falhava ao carregar chunks JS após deploy. O ErrorBoundary capturava "Importing a module script failed" mas não recuperava automaticamente.',
    rootCause: 'Múltiplos arquivos (Landing.tsx, App.tsx, AdminPanelV2.tsx, FreightStatusTracker.tsx, FreightInProgressCard.tsx, ForumRoutes.tsx, AdminForumRoutes.tsx) usavam React.lazy() nativo ao invés de lazyWithRetry() que já existia no projeto. Após deploy, chunks antigos eram invalidados e Safari não conseguia carregar os novos por cache/CDN/ServiceWorker desatualizado.',
    fix: 'Substituído TODOS os React.lazy() por lazyWithRetry() em todos os arquivos. lazyWithRetry limpa caches, faz retry automático com delay e recarrega a página como último recurso. Adicionado auto-reload no ErrorBoundary para chunk errors com proteção anti-loop.',
    files: [
      'src/pages/Landing.tsx',
      'src/App.tsx',
      'src/pages/AdminPanelV2.tsx',
      'src/components/FreightStatusTracker.tsx',
      'src/components/FreightInProgressCard.tsx',
      'src/modules/forum/ForumRoutes.tsx',
      'src/modules/forum/admin/AdminForumRoutes.tsx',
      'src/components/ErrorBoundary.tsx',
      'src/lib/lazyWithRetry.ts',
    ],
    rules: [
      'NUNCA usar React.lazy() diretamente — SEMPRE usar lazyWithRetry() de @/lib/lazyWithRetry',
      'Todo import dinâmico DEVE ter mecanismo de retry e cache-busting',
      'ErrorBoundary DEVE tentar auto-reload uma vez para chunk errors antes de mostrar erro',
      'Página inicial (/) NUNCA pode ficar em tela branca — é a primeira impressão do usuário',
      'Testar após cada deploy em Safari/iPhone modo anônimo para validar chunks',
    ],
    keywords: ['lazy', 'chunk', 'import', 'module script failed', 'ChunkLoadError', 'Safari', 'iPhone', 'cache', 'deploy', 'tela branca', 'lazyWithRetry'],
    testCases: [
      'all_lazy_imports_use_lazyWithRetry_not_native_lazy',
      'chunk_error_triggers_auto_reload_once',
      'landing_page_loads_after_deploy_on_safari',
      'error_boundary_shows_recovery_ui_for_chunk_errors',
    ],
    runtimeGuard: 'lazy-imports-must-use-lazyWithRetry',
  },

  // ── FRT-045: Form validation toasts reported as critical errors by Monitor Bot ──
  {
    id: 'FRT-045',
    date: '2026-03-09',
    severity: 'MEDIUM',
    area: 'monitoring-false-positives',
    bug: 'Validações de formulário (senha fraca, selfie ausente) eram reportadas ao Telegram como erros críticos porque Auth.tsx usava toast.error() e useFormState.ts usava variant destructive para mensagens de validação.',
    rootCause: 'toast.error() e variant destructive são interceptados pelo usePanelErrorTelegramReporter como erros do sistema. Validações de formulário não são erros — são feedback esperado ao usuário.',
    fix: 'Trocado toast.error() por toast() neutro em Auth.tsx, removido variant destructive em useFormState.ts, adicionados padrões de validação ao IGNORED_PATTERNS do reporter.',
    files: [
      'src/pages/Auth.tsx',
      'src/hooks/useFormState.ts',
      'src/hooks/usePanelErrorTelegramReporter.ts',
    ],
    rules: [
      'NUNCA usar toast.error() ou variant destructive para validação de formulário (regra FRT-042)',
      'Mensagens de validação DEVEM usar toast() neutro com id único',
      'IGNORED_PATTERNS do reporter DEVE incluir padrões de validação comuns',
      'toast.error() é EXCLUSIVO para falhas críticas de sistema ou rede',
    ],
    keywords: ['toast.error', 'destructive', 'validação', 'monitor bot', 'falso positivo', 'form validation'],
    testCases: [
      'signup_password_validation_does_not_trigger_telegram_alert',
      'missing_selfie_validation_does_not_trigger_telegram_alert',
      'form_validation_uses_neutral_toast_not_destructive',
    ],
    runtimeGuard: 'validation-toasts-must-be-neutral',
  },

  // ── FRT-046: selfieUpload.ts stored signed URLs in DB instead of relative paths ──
  {
    id: 'FRT-046',
    date: '2026-03-10',
    severity: 'CRITICAL',
    area: 'selfie-upload-storage',
    bug: 'uploadSelfieWithInstrumentation() retornava signed URL (temporária, expira) como valor principal. CompleteProfile.tsx e AffiliatedDriverSignup.tsx salvavam essa URL no banco em selfie_url, document_photo_url, etc. Após expiração, selfies/documentos desapareciam.',
    rootCause: 'selfieUpload.ts retornava signedUrl como valor principal para salvar no banco. AffiliatedDriverSignup.uploadDocument() gerava signed URLs de 24h e salvava no banco. O padrão correto (usado por authUploadHelper.ts) é salvar relative paths e resolver via StorageImage/useSignedImageUrl.',
    fix: 'selfieUpload.ts agora retorna filePath (relative path) como valor principal. AffiliatedDriverSignup.uploadDocument() retorna relative path sem gerar signed URL. CompleteProfile.tsx usa result.filePath. Validação de payload (blob não-nulo, size > 0, MIME) adicionada antes do upload.',
    files: [
      'src/utils/selfieUpload.ts',
      'src/pages/CompleteProfile.tsx',
      'src/pages/AffiliatedDriverSignup.tsx',
    ],
    rules: [
      'NUNCA salvar signed URLs no banco de dados — SEMPRE salvar relative paths (ex: identity-selfies/selfies/userId/file.jpg).',
      'Signed URLs são EXCLUSIVAMENTE para preview imediato na UI.',
      'O padrão oficial é: upload → retornar relative path → salvar no banco → StorageImage/useSignedImageUrl resolve em tempo de renderização.',
      'Validar blob (existe, size > 0, MIME type válido) ANTES de iniciar qualquer upload.',
    ],
    keywords: ['signed URL', 'signedUrl', 'relative path', 'filePath', 'selfie_url', 'expirada', 'desapareceu', 'selfieUpload', 'uploadDocument'],
    testCases: [
      'selfie_upload_returns_relative_path_not_signed_url',
      'db_stores_relative_path_format',
      'storage_image_resolves_relative_path_to_signed_url',
      'legacy_signed_urls_still_render_correctly',
      'empty_blob_upload_blocked_with_error',
    ],
  },

  // ── FRT-047: SecurityCompleteProfile discarded upload results ──
  {
    id: 'FRT-047',
    date: '2026-03-10',
    severity: 'CRITICAL',
    area: 'selfie-upload-persistence',
    bug: 'SecurityCompleteProfile.tsx usava console.log como callback de onUploadComplete para selfie, documento, CNH e comprovante de endereço. Os uploads completavam com sucesso mas o resultado era descartado — nunca salvo no perfil.',
    rootCause: 'Callback onUploadComplete era (url) => console.log("Selfie uploaded:", url) em todos os 4 DocumentUpload components. Nenhum update no banco era feito.',
    fix: 'Callbacks agora fazem supabase.from("profiles").update({ campo: url }).eq("id", profile.id) para cada tipo de documento. Toast de sucesso/erro adicionado. calculateCompletion() chamado após sucesso.',
    files: [
      'src/components/SecurityCompleteProfile.tsx',
    ],
    rules: [
      'NUNCA usar console.log como callback de upload — SEMPRE persistir o resultado no banco.',
      'Todo onUploadComplete em DocumentUpload DEVE fazer update no profiles com o campo correto.',
      'Após salvar documento, SEMPRE recalcular completionPercentage.',
    ],
    keywords: ['SecurityCompleteProfile', 'onUploadComplete', 'console.log', 'descartado', 'não salva', 'selfie', 'documento', 'CNH'],
    testCases: [
      'selfie_upload_persisted_to_profiles_table',
      'document_upload_persisted_to_profiles_table',
      'cnh_upload_persisted_to_profiles_table',
      'address_proof_upload_persisted_to_profiles_table',
      'completion_percentage_updates_after_upload',
    ],
  },

  // ── FRT-048: CameraSelfie lacked production logging and payload validation ──
  {
    id: 'FRT-048',
    date: '2026-03-10',
    severity: 'HIGH',
    area: 'selfie-capture-diagnostics',
    bug: 'CameraSelfie.tsx só logava em DEV mode (import.meta.env.DEV). Em produção, falhas no iPhone eram impossíveis de diagnosticar. Confirm button habilitava com fallbackPreviewUrl mesmo se blob/file não existisse (race condition).',
    rootCause: 'Logs de captura condicionados a import.meta.env.DEV. hasPreview usava apenas fallbackPreviewUrl para habilitar botão de confirmar, sem verificar se blob/file real existia. Confirm() não validava blob antes de chamar onCapture.',
    fix: 'Logs de captura e confirmação sempre ativos (não DEV-only). hasValidImage computed verifica blob.size > 0 ou file.size > 0. Confirm button desabilitado quando !hasValidImage. Confirm() valida blob antes de enviar e loga sourceBranch, size, type, platform.',
    files: [
      'src/components/CameraSelfie.tsx',
    ],
    rules: [
      'Logs de diagnóstico de captura de selfie DEVEM estar sempre ativos (não DEV-only) para debug em produção.',
      'Botão de confirmar DEVE ser desabilitado quando hasValidImage é false (blob/file nulo ou size === 0).',
      'Confirm() DEVE validar blob antes de chamar onCapture — NUNCA enviar null/undefined/empty.',
      'Logs DEVEM incluir: sourceBranch, size, type, platform (Capacitor.getPlatform()).',
    ],
    keywords: ['CameraSelfie', 'hasValidImage', 'confirm', 'blob', 'production logging', 'diagnóstico', 'iPhone', 'iOS'],
    testCases: [
      'confirm_blocked_when_no_valid_image',
      'confirm_logs_source_branch_and_size',
      'native_capture_logs_platform_and_mime',
      'fallback_file_converted_to_blob_before_upload',
    ],
  },

  // ── FRT-049: Duplicate selfie submit on rapid taps ──
  {
    id: 'FRT-049',
    date: '2026-03-10',
    severity: 'HIGH',
    area: 'selfie-capture-ux',
    bug: 'Toques rápidos no botão "Confirmar" da selfie podiam disparar múltiplos uploads simultâneos, causando duplicação de arquivos no storage e race conditions no estado.',
    rootCause: 'Confirm() não verificava if (confirming) return antes de setar setConfirming(true). O botão era desabilitado via disabled={confirming} mas React state updates são assíncronas — múltiplos cliques antes do re-render passavam.',
    fix: 'Adicionado if (confirming) return como primeira linha de confirm(). confirming adicionado ao array de dependências do useCallback. Botões de confirmar usam disabled={confirming || !hasValidImage}.',
    files: [
      'src/components/CameraSelfie.tsx',
    ],
    rules: [
      'SEMPRE verificar flag de loading/confirming como primeira linha de handlers de submit — ANTES de setar o estado.',
      'Botões de confirm/upload DEVEM usar disabled={isProcessing || !hasValidData} para dupla proteção (UI + lógica).',
      'Retry após erro DEVE resetar flag corretamente via finally block.',
    ],
    keywords: ['duplicate submit', 'confirming', 'rapid tap', 'múltiplos uploads', 'race condition', 'selfie', 'CameraSelfie'],
    testCases: [
      'rapid_taps_produce_single_upload',
      'confirm_ignored_while_confirming_true',
      'retry_works_after_failed_upload',
      'button_disabled_during_upload',
    ],
  },

  // ── FRT-050: CompleteProfile persisted temporary signed URL instead of relative path ──
  {
    id: 'FRT-050',
    date: '2026-03-10',
    severity: 'CRITICAL',
    area: 'selfie-upload-persistence',
    bug: 'No fluxo CompleteProfile, após upload da selfie, o estado era atualizado com result.signedUrl (temporário) e esse valor era salvo em profiles.selfie_url, causando expiração e perda de visualização futura.',
    rootCause: 'Callback de onCapture persistia signedUrl no documentUrls.selfie, enquanto a persistência correta exige filePath relativo. O preview imediato e a persistência estavam acoplados no mesmo campo.',
    fix: 'CompleteProfile agora salva apenas result.filePath no estado/persistência e mantém preview imediato com result.signedUrl em estado separado. Render usa useSignedImageUrl para resolver paths relativos e mantém compatibilidade com URLs legadas http/https.',
    files: [
      'src/pages/CompleteProfile.tsx',
      'src/hooks/useSignedImageUrl.ts',
    ],
    rules: [
      'SEMPRE persistir paths relativos no banco; nunca signed URLs temporárias.',
      'Separar preview imediato (signed URL) da persistência (filePath).',
      'Render de documentos deve suportar ambos: legado http/https e novo path relativo.',
    ],
    keywords: ['CompleteProfile', 'signedUrl', 'filePath', 'selfie_url', 'relative path', 'legacy URL', 'useSignedImageUrl'],
    testCases: [
      'complete_profile_persists_relative_path_not_signed_url',
      'complete_profile_shows_immediate_preview_after_capture',
      'legacy_signed_url_still_renders_in_complete_profile',
      'relative_path_renders_via_useSignedImageUrl',
    ],
  },

  // ── FRT-051: /awaiting-approval route missing + stale status in resolvePostAuthRoute ──
  {
    id: 'FRT-051',
    date: '2026-03-10',
    severity: 'CRITICAL',
    area: 'post-auth-routing',
    bug: 'resolvePostAuthRoute retornava "/awaiting-approval" para MOTORISTA não-aprovado, mas essa rota NUNCA foi definida no App.tsx. Resultado: tela branca/404. Além disso, CompleteProfile passava profile.status LOCAL (pré-aprovação) para resolvePostAuthRoute, ignorando a atualização feita pelo AutomaticApprovalService no banco.',
    rootCause: '1) Rota /awaiting-approval nunca registrada no router. 2) profile.status local não reflete o status atualizado pelo auto-approval no DB. 3) Toast dizia "Você já pode acessar" mesmo quando aprovação falhou.',
    fix: 'Criado src/pages/AwaitingApproval.tsx com tela dedicada + rota em App.tsx. CompleteProfile agora usa freshStatus (baseado em approvalResult) ao chamar resolvePostAuthRoute. Toast corrigido para "Seus documentos estão em análise".',
    files: [
      'src/pages/AwaitingApproval.tsx',
      'src/App.tsx',
      'src/pages/CompleteProfile.tsx',
    ],
    rules: [
      'Toda rota retornada por resolvePostAuthRoute DEVE existir no router do App.tsx.',
      'Após auto-approval, usar o resultado da aprovação (approved/not) para decidir o status, NÃO o profile local.',
      'Toast de status deve refletir a realidade: se não aprovado, NÃO dizer "você já pode acessar".',
    ],
    keywords: ['awaiting-approval', 'resolvePostAuthRoute', 'route missing', 'stale status', 'CompleteProfile', 'auto-approval', 'toast misleading'],
    testCases: [
      'motorista_not_approved_sees_awaiting_approval_page',
      'produtor_auto_approved_goes_to_dashboard',
      'awaiting_approval_route_exists_in_router',
      'fresh_status_used_after_auto_approval',
    ],
  },

  // ── FRT-052: DocumentUpload sem opção câmera/galeria ──
  {
    id: 'FRT-052',
    date: '2026-03-10',
    severity: 'HIGH',
    area: 'document-upload',
    bug: 'DocumentUpload.tsx usava um único <input type="file"> sem capture attribute, impedindo que o usuário escolhesse entre abrir a câmera ou selecionar da galeria no mobile.',
    rootCause: 'Input de arquivo genérico sem botões separados para câmera (capture="environment") e galeria (sem capture). Em iOS/Android, o comportamento padrão varia por dispositivo.',
    fix: 'Substituído por dois botões: "Abrir Câmera" (input com capture="environment") e "Galeria" (input sem capture). Ambos usam refs separadas.',
    files: [
      'src/components/DocumentUpload.tsx',
    ],
    rules: [
      'Upload de documentos DEVE sempre oferecer opção explícita de câmera E galeria.',
      'Input com capture="environment" para câmera traseira, input sem capture para galeria.',
      'Nunca usar um único input genérico para upload de documentos em mobile.',
    ],
    keywords: ['DocumentUpload', 'capture', 'camera', 'galeria', 'gallery', 'mobile', 'file input'],
    testCases: [
      'document_upload_shows_camera_and_gallery_buttons',
      'camera_button_opens_camera_on_mobile',
      'gallery_button_opens_file_picker',
    ],
  },

  // ── FRT-053: Signup step reset loop — useEffect resets signupStep on every searchParams change ──
  {
    id: 'FRT-053',
    date: '2026-03-10',
    severity: 'HIGH',
    area: 'auth-signup-flow',
    bug: 'Ao selecionar tipo de cadastro e clicar "Continuar", a tela piscava e voltava para a seleção de tipo. O usuário precisava selecionar duas vezes.',
    rootCause: 'useEffect em Auth.tsx com dependência [searchParams] executava setSignupStep("role-selection") em TODA re-execução, não apenas na montagem inicial. Qualquer re-render que tocasse searchParams resetava o step do wizard.',
    fix: 'Adicionado initialSyncDoneRef para garantir que setSignupStep("role-selection") só execute na PRIMEIRA execução do effect. Re-execuções subsequentes apenas sincronizam activeTab e role, sem resetar o step.',
    files: [
      'src/pages/Auth.tsx',
    ],
    rules: [
      'useEffect com setSignupStep/setCurrentStep em wizards deve usar ref guard para evitar resets em re-execuções.',
      'searchParams do React Router pode gerar nova referência em re-renders — nunca confiar em estabilidade referencial.',
      'Wizard steps NUNCA devem ser resetados por side-effects de URL — apenas por ação explícita do usuário (botão "Voltar").',
    ],
    keywords: ['signupStep', 'role-selection', 'useEffect', 'searchParams', 'wizard reset', 'flash', 'Auth.tsx', 'double selection'],
    testCases: [
      'signup_step_does_not_reset_after_continue',
      'role_selection_persists_through_rerender',
      'driver_type_step_accessible_without_flash',
    ],
  },

  // ── FRT-054: City picker flicker + false warning after valid selection in guest/service flows ──
  {
    id: 'FRT-054',
    date: '2026-03-11',
    severity: 'CRITICAL',
    area: 'city-selection-validation',
    bug: 'Campo de Cidade/CEP no fluxo de solicitação (incluindo sem cadastro e Transporte de Pet) piscava a lista e mantinha aviso "Selecione uma cidade da lista" mesmo após seleção válida.',
    rootCause: 'AddressLocationInput re-disparava searchCities após seleção programática (setSearchTerm), reabria dropdown e oscilava entre loading/empty. Em paralelo, faltava EXECUTE para role anon em search_cities, gerando erro 42501 em fluxos públicos.',
    fix: 'Bloqueada nova busca quando o input já corresponde à seleção validada (value.id + display igual), dropdown só abre com resultados reais, erro de busca agora limpa dropdown, e adicionada permissão EXECUTE para anon em public.search_cities. SmartLocationManager também passou a persistir base_city_id para manter validação consistente.',
    files: [
      'src/components/AddressLocationInput.tsx',
      'src/components/SmartLocationManager.tsx',
      'supabase/migrations/*_grant_search_cities_anon.sql',
    ],
    rules: [
      'Autocomplete de cidade NÃO deve reabrir dropdown após seleção confirmada por ID.',
      'Fluxos públicos (sem cadastro) que dependem de RPC DEVEM ter GRANT EXECUTE para role anon quando aplicável.',
      'Campos de cidade validados DEVEM persistir city_id junto com city/state em toda tela que salva localização.',
    ],
    keywords: ['AddressLocationInput', 'search_cities', '42501', 'permission denied', 'cidade', 'flicker', 'dropdown', 'anon', 'city_id'],
    testCases: [
      'guest_pet_transport_city_select_stays_stable_after_click',
      'selected_city_with_id_does_not_show_select_from_list_warning',
      'anon_can_execute_search_cities_rpc_without_42501',
      'smart_location_manager_saves_base_city_id',
    ],
  },

  // ── FRT-056: iOS/Capacitor selfie uploaded but step validation still said "Por favor, envie: Selfie" ──
  {
    id: 'FRT-056',
    date: '2026-03-11',
    severity: 'CRITICAL',
    area: 'complete-profile-selfie-race',
    bug: 'No fluxo /complete-profile (principalmente iOS/Capacitor), usuários capturavam selfie com sucesso mas ao clicar em Continuar recebiam "Por favor, envie: Selfie" e perdiam o cadastro em andamento.',
    rootCause: 'Race condition entre setState assíncrono dos documentos e clique imediato em Continuar, com leitura de estado stale em handleSaveAndContinue. Em paralelo, hidratação assíncrona de profiles_secure podia sobrescrever documentos recém-capturados com valores vazios.',
    fix: 'CompleteProfile passou a usar snapshot em ref (documentUrlsRef) para validação/finalização, merge defensivo na hidratação (nunca sobrescrever valor local já preenchido com vazio do backend) e persistência incremental de selfie/documentos no perfil assim que cada upload termina.',
    files: [
      'src/pages/CompleteProfile.tsx',
      'src/components/CameraSelfie.tsx',
    ],
    rules: [
      'Fluxos críticos de upload NÃO devem depender apenas de setState para validação imediata no próximo clique.',
      'Hidratações assíncronas de backend devem preservar valores locais já preenchidos pelo usuário.',
      'Após upload concluído, persistir documento de forma incremental para evitar perda de progresso em mobile/webview.',
    ],
    keywords: ['complete-profile', 'selfie', 'iOS', 'Capacitor', 'race condition', 'stale state', 'documentUrlsRef', 'upload incremental'],
    testCases: [
      'ios_selfie_capture_then_immediate_continue_does_not_fail_validation',
      'late_secure_profile_fetch_does_not_clear_recent_uploaded_selfie',
      'document_fields_persist_incrementally_after_each_upload',
    ],
  },

  // ── FRT-057: Native camera capture needed strict user-gesture calls and immediate state commitment ──
  {
    id: 'FRT-057',
    date: '2026-03-11',
    severity: 'CRITICAL',
    area: 'native-camera-capture-registration',
    bug: 'Em iOS/Android (Capacitor), usuários conseguiam avançar no cadastro sem que selfie/documento fossem efetivamente comprometidos no estado final, gerando toasts repetidos de documento faltante e perda de cadastro.',
    rootCause: 'Parte das capturas dependia de fluxo indireto (input/file click proxy ou confirmação manual adicional), aumentando risco de perda de contexto de gesto do usuário e abandono antes do commit definitivo da selfie.',
    fix: 'Padronizada captura nativa por chamada direta de Camera.getPhoto no clique do botão em DocumentUpload/DocumentUploadLocal e envio imediato da selfie no CameraSelfie nativo (sem etapa extra de confirmação), com conversão robusta dataUrl→Blob e tratamento de cancelamento.',
    files: [
      'src/components/CameraSelfie.tsx',
      'src/components/DocumentUpload.tsx',
      'src/components/DocumentUploadLocal.tsx',
      'src/utils/imageDataUrl.ts',
      'codemagic.yaml',
      'codemagic-testflight.yaml',
    ],
    rules: [
      'Em ambiente Capacitor, captura de câmera DEVE ser iniciada diretamente no handler de clique do usuário.',
      'Selfie de cadastro em fluxo nativo DEVE comprometer estado/upload imediatamente após retorno da câmera.',
      'Uploads de documentos devem oferecer rota estável para câmera e galeria em iOS e Android.',
    ],
    keywords: ['FRT-057', 'Camera.getPhoto', 'Capacitor', 'iOS', 'Android', 'selfie', 'documento', 'cadastro', 'gesture'],
    testCases: [
      'ios_complete_profile_selfie_native_capture_commits_without_extra_confirm',
      'android_complete_profile_document_camera_upload_updates_state',
      'affiliated_signup_document_capture_native_camera_and_gallery_work',
    ],
  },

  // ── FRT-058: Camera upload errors silently swallowed by overly broad cancel detection ──
  {
    id: 'FRT-058',
    date: '2026-03-11',
    severity: 'CRITICAL',
    area: 'onboarding/camera',
    bug: 'Selfie e documento apareciam como não enviados mesmo após captura nativa no iOS. Validação bloqueava cadastro com "Por favor, envie: Selfie".',
    rootCause: 'Três causas: (1) Cancel detection usava includes("cancel") engolindo erros reais. (2) DocumentUpload sem currentFile perdia estado visual entre steps. (3) dataUrlToBlob podia lançar exceção não capturada.',
    fix: 'Cancel detection refinada para mensagens exatas do Capacitor. currentFile prop passado a todos DocumentUpload. dataUrlToBlob em try/catch individual.',
    files: ['src/components/CameraSelfie.tsx', 'src/components/DocumentUpload.tsx', 'src/components/DocumentUploadLocal.tsx', 'src/pages/CompleteProfile.tsx'],
    rules: [
      'Cancel detection DEVE verificar mensagens exatas, NUNCA includes("cancel") genérico.',
      'DocumentUpload DEVE receber currentFile quando valor já existe no estado pai.',
      'dataUrlToBlob DEVE estar em try/catch individual com toast específico.',
    ],
    keywords: ['FRT-058', 'cancel', 'selfie', 'currentFile', 'dataUrlToBlob', 'DocumentUpload', 'iOS', 'cadastro'],
    testCases: [
      'ios_selfie_capture_native_updates_documentUrls',
      'document_upload_shows_uploaded_state_between_steps',
      'native_camera_error_not_silently_swallowed',
    ],
  },

  // ── FRT-059: "Abrir Câmera" no web mobile acionava galeria por clique programático em input capture ──
  {
    id: 'FRT-059',
    date: '2026-03-11',
    severity: 'CRITICAL',
    area: 'document-upload-camera-trigger',
    bug: 'Nos fluxos de cadastro em web mobile, tocar em "Abrir Câmera" podia abrir a galeria em vez da câmera para documentos.',
    rootCause: 'DocumentUpload/DocumentUploadLocal acionavam input[capture] via ref.click() programático. Em iOS Safari/WebView, esse padrão pode perder o contexto de gesto direto e cair no seletor de galeria.',
    fix: 'No web, o botão "Abrir Câmera" agora usa input file dedicado com capture="environment" vinculado por htmlFor/label (gesture direto). No nativo (iOS/Android), mantém Camera.getPhoto com source Camera para captura direta.',
    files: [
      'src/components/DocumentUpload.tsx',
      'src/components/DocumentUploadLocal.tsx',
    ],
    rules: [
      'Para web mobile, inputs com capture NÃO devem ser disparados por ref.click() programático quando o objetivo é forçar câmera.',
      'Usar interação direta do usuário (label/htmlFor) para preservar gesture context no iOS.',
      'Em iOS/Android nativo, captura de documento deve usar Camera.getPhoto({ source: CameraSource.Camera }).',
    ],
    keywords: ['FRT-059', 'Abrir Câmera', 'iOS', 'Safari', 'WebView', 'capture', 'ref.click', 'galeria', 'cadastro'],
    testCases: [
      'web_mobile_document_camera_button_uses_direct_input_gesture',
      'ios_native_document_camera_still_uses_capacitor_camera_source_camera',
      'affiliated_signup_document_camera_button_does_not_fall_back_to_gallery_unintentionally',
    ],
  },

  // ── FRT-060: Hidden overlay input caused unstable camera behavior in some mobile browsers ──
  {
    id: 'FRT-060',
    date: '2026-03-11',
    severity: 'CRITICAL',
    area: 'document-upload-mobile-web-camera-ux',
    bug: 'Mesmo após separar câmera/galeria, alguns dispositivos móveis ainda abriam a galeria ao tocar em "Abrir Câmera" em uploads de documento.',
    rootCause: 'O atributo capture em input file é apenas uma preferência e possui suporte inconsistente entre navegadores móveis; em alguns cenários ele mantém fluxo de galeria/chooser.',
    fix: 'Para web mobile, o fluxo "Abrir Câmera" foi migrado para getUserMedia com stream ao vivo + captura em canvas no clique do usuário. O botão "Galeria" permanece separado para seleção de arquivos.',
    files: [
      'src/hooks/useWebDocumentCamera.ts',
      'src/components/DocumentUpload.tsx',
      'src/components/DocumentUploadLocal.tsx',
      'src/hooks/useRegressionShield.ts',
    ],
    rules: [
      'Em web mobile, quando for obrigatório abrir câmera em vez de galeria, usar getUserMedia diretamente no handler de clique.',
      'capture="environment" pode ser mantido apenas como fallback, nunca como garantia de comportamento.',
      'Fluxos de onboarding devem manter botões explícitos e separados para Câmera e Galeria.',
    ],
    keywords: ['FRT-060', 'getUserMedia', 'camera', 'mobile web', 'ios', 'android', 'upload documento'],
    testCases: [
      'complete_profile_document_camera_uses_getusermedia_stream_capture',
      'affiliated_signup_document_camera_uses_getusermedia_stream_capture',
      'document_gallery_button_still_opens_file_picker',
    ],
  },

  // ── FRT-061: Mobile web era tratado como nativo e disparava fallback web da câmera para galeria ──
  {
    id: 'FRT-061',
    date: '2026-03-11',
    severity: 'CRITICAL',
    area: 'document-upload-platform-detection',
    bug: 'No cadastro, "Abrir Câmera" de documento ainda podia abrir a galeria em Android/iOS quando executado no navegador móvel.',
    rootCause: 'DocumentUpload/DocumentUploadLocal tratavam platform "ios/android" como nativo mesmo fora do container Capacitor, acionando Camera.getPhoto web fallback em vez do fluxo getUserMedia dedicado.',
    fix: 'Detecção nativa restrita a Capacitor.isNativePlatform(). Em web mobile, o botão "Abrir Câmera" permanece no fluxo getUserMedia; em app nativo, segue CameraSource.Camera.',
    files: [
      'src/components/DocumentUpload.tsx',
      'src/components/DocumentUploadLocal.tsx',
      'src/hooks/useRegressionShield.ts',
    ],
    rules: [
      'Nunca inferir ambiente nativo apenas por platform string; exigir Capacitor.isNativePlatform().',
      'Fluxo de câmera de documento em web mobile deve permanecer em getUserMedia quando não houver container nativo.',
      'Em iOS/Android nativo, usar Camera.getPhoto({ source: CameraSource.Camera }) para captura direta.',
    ],
    keywords: ['FRT-061', 'isNativePlatform', 'getPlatform', 'mobile web', 'camera', 'galeria'],
    testCases: [
      'mobile_web_complete_profile_document_camera_does_not_call_capacitor_camera_plugin',
      'native_android_document_camera_uses_capcamera_source_camera',
      'native_ios_document_camera_uses_capcamera_source_camera',
    ],
  },

  // ── FRT-062: Android piscava e não iniciava por configuração insegura de boot nativo ──
  // ⚠️ REGRESSÃO REINCIDENTE: Este bug voltou a ocorrer em 2026-03-12 porque server.url 
  // foi reintroduzido sem guard de env. Agora há validação automatizada (preflight script).
  {
    id: 'FRT-062',
    date: '2026-03-12',
    severity: 'CRITICAL',
    area: 'native-app-bootstrap/android',
    bug: 'App Android fecha imediatamente ao abrir (Play Store). Tela pisca e fecha sem mostrar login.',
    rootCause: 'Bootstrap nativo ainda podia acionar fluxos web de recovery (reload/cache cleanup) em alguns caminhos e a validação de release não bloqueava cenários inseguros no nível do Gradle/assets gerados.',
    fix: [
      '1. capacitor.config.ts: server block condicional exclusivo para CAPACITOR_LIVE_RELOAD=true',
      '2. URL de live reload sanitizada sem query/hash/path',
      '3. main.tsx: installAutoRecoveryHandlers/ensureFreshPreviewBuild executam apenas em web',
      '4. pwaRecovery/lazyWithRetry/ErrorBoundary/GlobalErrorBoundary/securityAutoHealService: sem auto-reload em nativo',
      '5. scripts/validate-native-release.mjs: valida capacitor.config.ts + android/app/src/main/assets/capacitor.config.json + assets synced',
      '6. android/app/build.gradle: assembleRelease/bundleRelease bloqueados se validateNativeRelease falhar',
      '7. package.json/docs checklist: fluxo obrigatório de sync + preflight antes de publicar',
      '8. FRT-062 atualizado com regra executável anti-regressão',
    ].join('\n'),
    files: [
      'capacitor.config.ts',
      'src/main.tsx',
      'src/utils/pwaRecovery.ts',
      'src/lib/lazyWithRetry.ts',
      'src/components/ErrorBoundary.tsx',
      'src/components/GlobalErrorBoundary.tsx',
      'src/services/securityAutoHealService.ts',
      'scripts/validate-native-release.mjs',
      'android/app/build.gradle',
      'package.json',
      'docs/RELEASE_CHECKLIST.md',
      'src/hooks/useRegressionShield.ts',
    ],
    rules: [
      'Build nativa de produção NUNCA pode conter server.url ativo (nem em capacitor.config.ts nem no capacitor.config.json gerado).',
      'Qualquer rotina de PWA/preview/chunk auto-recovery com reload automático deve ser WEB-ONLY; em nativo usar fallback local sem reload em loop.',
      'assembleRelease/bundleRelease DEVEM depender de validação bloqueadora (Gradle task validateNativeRelease).',
      'Release Android só é válida se mobile:sync:android:release concluir sem falhas e o preflight validar assets sincronizados.',
      'Se preflight/Gradle validator falhar, release é BLOQUEADA e o AAB não pode ser publicado.',
      'Falha de boot nativo (tela piscando/blank/close) é P0: rollback imediato e bloqueio de nova submissão até correção validada.',
    ],
    keywords: ['FRT-062', 'android', 'pisca tela', 'app não abre', 'capacitor', 'webview', 'bundle', 'cadastro', 'server.url', 'CAPACITOR_LIVE_RELOAD', 'preflight', 'gradle gate', 'reload loop'],
    testCases: [
      'native_android_release_starts_without_remote_server_url',
      'native_android_after_build_and_sync_loads_local_dist_bundle',
      'native_chunk_error_does_not_trigger_auto_reload_loop',
      'android_assets_capacitor_config_json_has_no_server_url',
      'preflight_script_blocks_release_if_android_assets_missing',
      'gradle_blocks_assemble_release_when_validate_native_release_fails',
      'main_tsx_skips_preview_cleanup_and_recovery_handlers_on_native_platform',
    ],
  },

  // ── FRT-063: AAB gerado sem assets web (dist/) — app abre e fecha imediatamente ──
  // ⚠️ REGRESSÃO REINCIDENTE (2x): Build Android empacotou apenas código nativo sem frontend.
  {
    id: 'FRT-063',
    date: '2026-03-13',
    severity: 'CRITICAL' as Severity,
    area: 'Android/Build/Capacitor',
    bug: 'AAB gerado com ~9 MB (normal ~12 MB). App abre, WebView tenta carregar index.html que não existe nos assets, app fecha imediatamente. Não aparece FATAL no logcat porque não é crash nativo — é WebView sem conteúdo.',
    rootCause: [
      '1. `npx cap sync android` não foi executado antes de gerar o AAB no Android Studio.',
      '2. A pasta android/app/src/main/assets/public/ ficou vazia (gitignored por design do Capacitor).',
      '3. Sem index.html, o WebView não tem o que renderizar e o app fecha.',
      '4. Não havia validação bloqueante no Gradle para verificar presença de index.html.',
    ].join('\n'),
    fix: [
      '1. scripts/validate-native-release.mjs: adicionada verificação explícita de public/index.html',
      '2. android/app/build.gradle: nova task validateWebAssetsExist bloqueia assembleRelease/bundleRelease se index.html ausente',
      '3. docs/RELEASE_CHECKLIST.md: adicionada verificação de tamanho do AAB (≥ 11 MB) e presença de index.html',
      '4. Fluxo obrigatório: npm run build → npx cap sync android → Android Studio Generate AAB',
    ].join('\n'),
    files: [
      'scripts/validate-native-release.mjs',
      'android/app/build.gradle',
      'docs/RELEASE_CHECKLIST.md',
    ],
    rules: [
      'NUNCA gerar AAB sem antes executar `npm run mobile:sync:android:release`.',
      'Se o AAB tiver menos de 11 MB, o dist/ NÃO entrou no build — NÃO publique.',
      'android/app/src/main/assets/public/index.html DEVE existir antes do AAB.',
      'Gradle DEVE bloquear assembleRelease/bundleRelease se index.html não existir.',
      'A pasta android/app/src/main/assets/public é gitignored — SEMPRE regenerada por cap sync.',
    ],
    keywords: ['FRT-063', 'android', 'AAB', 'tamanho', '9mb', '12mb', 'dist', 'index.html', 'assets', 'cap sync', 'abre e fecha', 'webview vazio', 'build sem frontend'],
    testCases: [
      'aab_size_must_be_at_least_11mb',
      'android_assets_public_index_html_must_exist_before_release',
      'gradle_blocks_release_if_index_html_missing',
      'preflight_script_checks_index_html_presence',
      'cap_sync_copies_dist_to_android_assets',
    ],
  },

  // ── FRT-064: Popup de download do app exibido dentro do app já instalado ──
  // ⚠️ O modal "Baixe agora" aparecia em Capacitor nativo e PWA standalone.
  {
    id: 'FRT-064',
    date: '2026-03-13',
    severity: 'HIGH' as Severity,
    area: 'Mobile/Capacitor',
    bug: 'Popup de download do app aparecia dentro do próprio app instalado (nativo e PWA standalone).',
    rootCause: 'Detecção baseada apenas em User-Agent, que é idêntico no browser mobile e no container Capacitor/PWA.',
    fix: 'Gate de ambiente em MobileAppDownloadPopup: bloqueia exibição se Capacitor.isNativePlatform(), window.Capacitor, protocol capacitor:, hostname localhost sem porta (Android nativo), ou display-mode standalone/navigator.standalone.',
    files: ['src/components/MobileAppDownloadPopup.tsx'],
    rules: [
      'Popup de download de app NUNCA aparece em ambiente nativo Capacitor.',
      'Popup de download de app NUNCA aparece em PWA standalone.',
      'Popup de download de app SÓ aparece em navegador mobile convencional (aba).',
    ],
    keywords: ['FRT-064', 'popup', 'download', 'app', 'capacitor', 'nativo', 'standalone', 'pwa', 'MobileAppDownloadPopup', 'baixe agora'],
    testCases: [
      'native_android_does_not_show_download_popup',
      'native_ios_does_not_show_download_popup',
      'pwa_standalone_does_not_show_download_popup',
      'mobile_browser_shows_download_popup_after_delay',
      'desktop_does_not_show_download_popup',
    ],
  },

  // ── FRT-065: ClassNotFoundException ao usar applicationId diferente do pacote Java ──
  // ⚠️ Google Play rejeitou o app: "com.agriroute.connect.MainActivity" não encontrada.
  {
    id: 'FRT-065',
    date: '2026-03-13',
    severity: 'CRITICAL' as Severity,
    area: 'Android/Manifest',
    bug: 'ClassNotFoundException: MainActivity não encontrada ao usar namespace/applicationId diferente do pacote Java real.',
    rootCause: 'android:name=".MainActivity" resolve relativo ao namespace configurado no build.gradle. Quando o namespace muda para com.agriroute.connect, o Android procura com.agriroute.connect.MainActivity, mas a classe está compilada em app.lovable.f2dbc20153194f90a3cc8dd215bbebba.MainActivity.',
    fix: 'Usar nome fully-qualified (app.lovable.f2dbc20153194f90a3cc8dd215bbebba.MainActivity) no AndroidManifest.xml em vez de nome relativo (.MainActivity).',
    files: ['android/app/src/main/AndroidManifest.xml'],
    rules: [
      'AndroidManifest DEVE usar nomes fully-qualified para Activity, Service e Receiver.',
      'NUNCA usar android:name relativo (.NomeClasse) quando namespace/applicationId pode diferir do pacote Java.',
    ],
    keywords: ['FRT-065', 'ClassNotFoundException', 'MainActivity', 'AndroidManifest', 'namespace', 'applicationId', 'fully-qualified', 'Google Play', 'rejeitado'],
    testCases: [
      'app_boots_with_namespace_com_agriroute_connect',
      'app_boots_with_default_lovable_namespace',
      'manifest_activity_name_is_fully_qualified',
    ],
  },

  // ── FRT-066: Localização NÃO deve bloquear cadastro quando APK desatualizado ──
  {
    id: 'FRT-066',
    date: '2026-03-13',
    severity: 'HIGH' as Severity,
    area: 'onboarding/location-permission',
    bug: 'Cadastro ficava bloqueado quando permissão de localização falhava no Android com APK desatualizado (Missing permissions in AndroidManifest).',
    rootCause: 'O APK instalado localmente não foi reconstruído após npx cap sync. Capacitor bridge reportava "Missing the following permissions in AndroidManifest.xml" via console.error, que era interceptado pelo usePanelErrorTelegramReporter e enviado como alerta crítico. O getStepRequirements incluía "localizacao" como requisito obrigatório do step 3, bloqueando o cadastro.',
    fix: 'Localização removida dos requisitos obrigatórios de cadastro (registration-policy.ts). Será solicitada após cadastro no dashboard. Erros de "Missing permissions" e "AndroidManifest" adicionados ao IGNORED_PATTERNS do reporter. console.error em capacitorPermissions.ts downgraded para console.warn.',
    files: [
      'src/lib/registration-policy.ts',
      'src/components/LocationPermission.tsx',
      'src/hooks/usePanelErrorTelegramReporter.ts',
      'src/integrations/supabase/client.ts',
      'src/utils/capacitorPermissions.ts',
    ],
    rules: [
      'Localização NUNCA deve bloquear o cadastro — é um requisito soft, solicitado após registro.',
      'Erros de "Missing permissions in AndroidManifest" são problemas de build (APK desatualizado), NÃO bugs de código.',
      'console.error em catches de permissão Capacitor DEVE ser console.warn para evitar alertas falsos.',
      'IGNORED_PATTERNS deve incluir "Missing the following permissions" e "AndroidManifest".',
    ],
    keywords: ['FRT-066', 'localização', 'cadastro', 'bloqueado', 'AndroidManifest', 'Missing permissions', 'APK desatualizado', 'registration', 'onboarding', 'location'],
    testCases: [
      'registration_completes_without_location_permission',
      'location_failure_shows_soft_toast_not_error',
      'missing_permissions_error_not_sent_to_telegram',
      'capacitor_permission_errors_use_console_warn',
    ],
  },

  // ── FRT-067: build.gradle DEVE ler signing.properties para configuração local ──
  {
    id: 'FRT-067',
    date: '2026-03-13',
    severity: 'CRITICAL' as Severity,
    area: 'Android/Build',
    bug: 'build.gradle era sobrescrito após git pull, perdendo namespace (com.agriroute.connect), applicationId e signingConfigs de produção. AAB gerado com pacote genérico app.lovable... e sem assinatura.',
    rootCause: 'Configurações de produção eram editadas diretamente no build.gradle versionado, que era resetado a cada git pull ou npx cap sync.',
    fix: 'build.gradle agora lê signing.properties (não commitado) para namespace, applicationId, versionCode, versionName e signingConfigs. Se o arquivo não existir, usa configuração genérica do Lovable para desenvolvimento. Task validateSigningProperties bloqueia builds de release sem signing.properties.',
    files: [
      'android/app/build.gradle',
      'android/app/signing.properties.example',
      'android/.gitignore',
    ],
    rules: [
      'NUNCA hardcodar senhas ou credenciais de keystore em arquivos versionados.',
      'build.gradle DEVE usar signing.properties para configuração de produção.',
      'signing.properties DEVE estar no .gitignore.',
      'signing.properties.example DEVE ser commitado como template.',
      'Task validateSigningProperties DEVE bloquear bundleRelease sem signing.properties.',
    ],
    keywords: ['FRT-067', 'signing', 'build.gradle', 'keystore', 'namespace', 'applicationId', 'sobrescrito', 'git pull', 'assinatura', 'signing.properties'],
    testCases: [
      'build_release_fails_without_signing_properties',
      'build_release_uses_production_namespace_with_signing_properties',
      'git_pull_does_not_overwrite_signing_properties',
      'signing_properties_not_committed_to_repo',
    ],
    runtimeGuard: 'build-gradle-must-use-signing-properties' as RuntimeGuardKey,
  },

  // ── FRT-068: SplashScreen plugin ausente no Android gerava erro crítico e alerta falso ──
  {
    id: 'FRT-068',
    date: '2026-03-13',
    severity: 'HIGH' as Severity,
    area: 'Mobile/Capacitor/Splash',
    bug: 'Em Android nativo, a ocultação da splash podia disparar "SplashScreen plugin is not implemented on android" e ser reportada como erro crítico no monitor.',
    rootCause: 'Build nativo dessincronizado/sem plugin disponível no runtime + fluxo de hide tratando indisponibilidade do plugin como erro ruidoso (console/reporter).',
    fix: 'useSplashScreen passou a validar contexto nativo e disponibilidade do plugin antes de chamar SplashScreen.hide, com fallback seguro não-bloqueante. usePanelErrorTelegramReporter passou a ignorar assinaturas de erro de splash/plugin para evitar alerta falso.',
    files: [
      'src/hooks/useSplashScreen.ts',
      'src/hooks/usePanelErrorTelegramReporter.ts',
    ],
    rules: [
      'Falha de hide da SplashScreen por plugin ausente NUNCA deve bloquear boot do app.',
      'Erros conhecidos de plugin ausente em runtime nativo DEVEM ser downgraded para warn e tratados como ruído operacional.',
      'Monitor de erros NÃO deve enviar Telegram para assinatura "SplashScreen plugin is not implemented on android".',
    ],
    keywords: ['FRT-068', 'splashscreen', 'plugin is not implemented on android', 'erro ao ocultar splash', 'capacitor', 'android', 'telegram', 'false positive'],
    testCases: [
      'native_android_without_splash_plugin_does_not_block_boot',
      'splash_hide_fallback_marks_app_ready',
      'splash_plugin_not_implemented_not_sent_to_telegram',
      'console_error_splash_signature_is_ignored_by_reporter',
    ],
  },

  // ── FRT-069: Upload afiliado usava MIME/extensão hardcoded (image/jpeg + .jpg) para todos os arquivos ──
  {
    id: 'FRT-069',
    date: '2026-03-13',
    severity: 'HIGH' as Severity,
    area: 'Onboarding/Upload/AffiliatedDriver',
    bug: 'uploadDocument no AffiliatedDriverSignup.tsx forçava contentType image/jpeg e extensão .jpg para todos os blobs, incluindo PDFs e PNGs.',
    rootCause: 'Helper uploadDocument usava const ext = "jpg" e contentType "image/jpeg" hardcoded, ignorando blob.type real.',
    fix: 'uploadDocument agora lê blob.type para determinar MIME real e usa mapa de extensões (jpg/png/webp/pdf). Fallback seguro para image/jpeg apenas quando blob.type está vazio.',
    files: [
      'src/pages/AffiliatedDriverSignup.tsx',
    ],
    rules: [
      'NUNCA hardcodar contentType ou extensão de arquivo — usar blob.type como fonte primária.',
      'Upload de documentos deve preservar o formato original (PDF permanece PDF, PNG permanece PNG).',
    ],
    keywords: ['FRT-069', 'upload', 'mime', 'contentType', 'hardcode', 'jpg', 'pdf', 'affiliated', 'extensão'],
    testCases: [
      'upload_pdf_preserves_pdf_extension_and_mime',
      'upload_png_preserves_png_extension_and_mime',
      'upload_without_blob_type_falls_back_to_jpeg',
    ],
  },

  // ── FRT-070: Cadastro afiliado finalizava com sucesso mesmo quando uploads falhavam ──
  {
    id: 'FRT-070',
    date: '2026-03-13',
    severity: 'CRITICAL' as Severity,
    area: 'Onboarding/Upload/AffiliatedDriver',
    bug: 'AffiliatedDriverSignup permitia finalizar cadastro e notificar transportadora como "cadastro completo" mesmo quando 1 ou mais uploads de documentos falhavam silenciosamente.',
    rootCause: 'uploadDocument retornava string vazia em caso de falha, mas handleSubmit não verificava se todos os 4 uploads (selfie + 3 docs) retornaram URLs válidas antes de persistir e notificar.',
    fix: 'Após Promise.all dos uploads, verificar que todos os 4 retornaram URLs não-vazias. Se algum falhou, exibir toast com lista dos documentos falhados e bloquear finalização. Payload de notificação agora reflete contagem real.',
    files: [
      'src/pages/AffiliatedDriverSignup.tsx',
    ],
    rules: [
      'NUNCA finalizar cadastro se upload obrigatório falhou — bloquear e informar quais documentos falharam.',
      'Payload de notificação (has_complete_profile, documents_count) DEVE refletir estado real dos uploads, não valores hardcoded.',
      'Todo fluxo de cadastro que requer documentos DEVE validar sucesso de upload antes de persistir no banco.',
    ],
    keywords: ['FRT-070', 'upload', 'falha', 'silenciosa', 'cadastro completo', 'false positive', 'notification', 'affiliated', 'bloqueio'],
    testCases: [
      'signup_blocked_when_selfie_upload_fails',
      'signup_blocked_when_document_upload_fails',
      'notification_documents_count_matches_actual_uploads',
      'toast_lists_specific_failed_documents',
    ],
  },

  // ── FRT-071: Build publicado sem capacitor.plugins.json / assets nativos ──
  {
    id: 'FRT-071',
    date: '2026-03-13',
    severity: 'CRITICAL' as Severity,
    area: 'Android/iOS/NativeBuild',
    bug: 'App da Play Store abria splash e fechava imediatamente. WebView não encontrava index.html nos assets nativos. Erro "SplashScreen plugin is not implemented" nos logs de produção.',
    rootCause: 'O AAB foi publicado sem rodar `npx cap sync android`, resultando em ausência de: (1) android/app/src/main/assets/public/index.html (frontend), (2) capacitor.plugins.json (registro de plugins nativos), (3) capacitor.config.json. O tamanho do AAB caiu de ~12MB para ~9MB, confirmando ausência de assets.',
    fix: 'Preflight v3 (validate-native-release.mjs) agora valida presença de capacitor.plugins.json e verifica se plugins críticos (Camera, Geolocation, SplashScreen) estão registrados. build.gradle bloqueia bundleRelease se plugins.json estiver ausente. Verificação de tamanho do AAB (< 11MB = bloqueado).',
    files: [
      'scripts/validate-native-release.mjs',
      'android/app/build.gradle',
      'capacitor.config.ts',
    ],
    rules: [
      'NUNCA gerar AAB sem rodar `npm run build && npx cap sync android` — o frontend e plugins não serão empacotados.',
      'capacitor.plugins.json DEVE existir em android/app/src/main/assets/ e conter Camera, Geolocation, SplashScreen.',
      'AAB com tamanho < 11MB é indicador imediato de assets ausentes — bloquear publicação.',
      'O fluxo oficial é: `npm run mobile:sync:android:release` que faz build + sync + preflight automaticamente.',
      'A pasta android/app/src/main/assets/ é gitignored por design — deve ser gerada localmente antes de cada build.',
    ],
    keywords: ['FRT-071', 'splash', 'fecha', 'crash boot', 'index.html', 'capacitor.plugins.json', 'assets', 'AAB', '9MB', 'plugin not implemented', 'cap sync'],
    testCases: [
      'preflight_blocks_when_plugins_json_missing',
      'preflight_blocks_when_index_html_missing',
      'preflight_validates_critical_plugins_registered',
      'gradle_blocks_release_without_plugins_json',
      'aab_size_below_11mb_triggers_error',
    ],
  },

  // ── FRT-072: Incompatibilidade de major entre plugin nativo e Capacitor core ──
  {
    id: 'FRT-072',
    date: '2026-03-13',
    severity: 'CRITICAL' as Severity,
    area: 'Android/iOS/NativePlugins',
    bug: 'App apresentava crash silencioso de boot ou comportamento instável de plugins nativos. @capawesome-team/capacitor-android-foreground-service@8.0.1 estava instalado com @capacitor/core@7.4.4.',
    rootCause: 'Plugins nativos do Capacitor exigem mesma major version do core. foreground-service v8 carrega bindings incompatíveis com o runtime do Capacitor 7, causando falha na inicialização do bridge nativo.',
    fix: 'Downgrade de foreground-service para ^7.0.0. Preflight v3 agora verifica automaticamente que todos os pacotes @capacitor/* e @capawesome-team/* compartilham a mesma major version do @capacitor/core. CI/Codemagic também bloqueado via env guard (isCI) para nunca usar live-reload em builds de produção.',
    files: [
      'package.json',
      'scripts/validate-native-release.mjs',
      'capacitor.config.ts',
    ],
    rules: [
      'TODOS os pacotes @capacitor/* DEVEM ter a mesma major version (ex: todos 7.x.x).',
      'Plugins de terceiros (@capawesome-team/*) DEVEM ter major compatível com @capacitor/core.',
      'Usar versões fixas (sem ^) para @capacitor/core, @capacitor/android, @capacitor/ios em produção.',
      'Preflight deve validar matriz de versões automaticamente antes de cada release.',
      'NUNCA atualizar @capacitor/core sem atualizar simultaneamente TODOS os plugins dependentes.',
    ],
    keywords: ['FRT-072', 'major version', 'incompatível', 'foreground-service', 'capawesome', 'capacitor 7', 'capacitor 8', 'plugin crash', 'bridge', 'mismatch'],
    testCases: [
      'preflight_detects_capacitor_major_mismatch',
      'preflight_detects_third_party_plugin_mismatch',
      'package_json_has_aligned_capacitor_versions',
      'ci_env_blocks_live_reload_in_production',
    ],
  },

  // ── FRT-073: Preflight não validava conteúdo do index.html nem presença de JS compilados ──
  {
    id: 'FRT-073',
    date: '2026-03-13',
    severity: 'HIGH' as Severity,
    area: 'Android/NativeBuild/Preflight',
    bug: 'App nativo abria tela branca e fechava imediatamente. O arquivo index.html existia em assets/ mas estava vazio ou corrupto (sem <div id="root">), ou o diretório assets/public/assets/ não continha arquivos .js compilados.',
    rootCause: 'validate-native-release.mjs verificava apenas a existência do index.html (existsSync), sem ler seu conteúdo. Também não verificava se o diretório de assets compilados (JS/CSS) continha arquivos reais. Builds com dist/ parcialmente gerado passavam no preflight.',
    fix: 'Preflight v3 agora: (1) lê o conteúdo do index.html e verifica presença de <div id="root">, (2) verifica que android/app/src/main/assets/public/assets/ existe E contém pelo menos 1 arquivo .js. Ambos bloqueiam o release se falharem.',
    files: [
      'scripts/validate-native-release.mjs',
    ],
    rules: [
      'Preflight DEVE validar o conteúdo do index.html, não apenas sua existência.',
      'index.html sem <div id="root"> indica build corrupto — BLOQUEAR release.',
      'Diretório assets/public/assets/ sem arquivos .js indica build incompleto — BLOQUEAR release.',
      'Validação de conteúdo deve rodar APÓS validação de existência para dar mensagens de erro mais específicas.',
    ],
    keywords: ['FRT-073', 'index.html', 'vazio', 'corrupto', 'div root', 'assets', 'js files', 'tela branca', 'white screen', 'preflight', 'content validation'],
    testCases: [
      'preflight_blocks_when_index_html_missing_root_div',
      'preflight_blocks_when_assets_dir_has_no_js_files',
      'preflight_blocks_when_assets_dir_missing',
      'preflight_passes_when_index_html_and_js_assets_valid',
    ],
    runtimeGuard: 'preflight-must-validate-index-html-content-and-assets' as RuntimeGuardKey,
  },
];
// ═══════════════════════════════════════════════════════════════
// RUNTIME GUARDS — Previnem regressão em tempo de execução
// ═══════════════════════════════════════════════════════════════

const BLOCKED_CANCEL_STATUSES = ['LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'];

const regressionGuards = {
  // FRT-001: Ownership must check assignment fallback
  assertOwnershipUsesAssignmentFallback(ctx: RuntimeGuardContext) {
    if (ctx.driverId === null && !ctx.assignmentExists) {
      return; // No owner found — will return 404 naturally
    }
    if (ctx.driverId === null && ctx.assignmentExists) {
      console.warn('[RegressionGuard FRT-001] driver_id is NULL but assignment exists — using fallback path');
    }
  },

  // FRT-002: No cancel after LOADED
  assertNoCancelAfterLoaded(ctx: RuntimeGuardContext) {
    if (ctx.freightStatus && BLOCKED_CANCEL_STATUSES.includes(ctx.freightStatus)) {
      throw new RegressionViolation(
        'FRT-002',
        'no-cancel-after-loaded',
        `Cancelamento bloqueado em status ${ctx.freightStatus}. Requer suporte/admin.`,
      );
    }
  },

  // FRT-003: Multitruck withdrawal must be incremental
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

  // FRT-004: Skip recalc must be set
  assertSkipRecalcEnabled(ctx: RuntimeGuardContext) {
    if (ctx.skipRecalcSet === false) {
      throw new RegressionViolation(
        'FRT-004',
        'skip-recalc-required-on-sensitive-updates',
        'Operação em freights sem SET app.skip_recalc = true. Trigger pode reverter status.',
      );
    }
  },

  // FRT-005: Freight/assignment state consistency
  assertFreightAssignmentConsistency(ctx: RuntimeGuardContext) {
    if (ctx.freightStatus === 'OPEN' && ctx.driverId === null && ctx.assignmentExists) {
      throw new RegressionViolation(
        'FRT-005',
        'freight-and-assignment-state-must-match',
        'Estado inconsistente: freight OPEN com driver_id NULL mas assignment ACCEPTED existe.',
      );
    }
  },

  // FRT-006/008/010: Assignment OPEN must be in ongoing statuses
  assertAssignmentOpenInOngoingStatuses(ctx: RuntimeGuardContext) {
    if (ctx.ongoingStatuses && !ctx.ongoingStatuses.includes('OPEN')) {
      throw new RegressionViolation(
        'FRT-006',
        'assignment-open-must-be-in-ongoing-statuses',
        'ASSIGNMENT_ONGOING_STATUSES não inclui "OPEN". Assignments criados por accept-freight-multiple ficarão invisíveis.',
      );
    }
  },

  // FRT-007: Already accepted must not show success toast
  assertAlreadyAcceptedNoSuccessToast(ctx: RuntimeGuardContext) {
    if (ctx.alreadyAccepted === true) {
      console.warn('[RegressionGuard FRT-007] already_accepted=true — NÃO mostrar toast de sucesso, usar toast.info');
    }
  },

  // FRT-014/015: Accept must allow ACCEPTED with slots
  assertAcceptAllowsAcceptedWithSlots(ctx: RuntimeGuardContext) {
    if (
      ctx.freightStatus === 'ACCEPTED' &&
      ctx.requiredTrucks !== undefined &&
      ctx.acceptedTrucks !== undefined &&
      ctx.acceptedTrucks < ctx.requiredTrucks
    ) {
      // This is valid — do not block
      console.info('[RegressionGuard FRT-014] ACCEPTED freight with available slots — accept MUST be allowed');
    }
  },

  // FRT-018: GPS permission denied must not throw
  assertGpsPermissionDeniedNoThrow() {
    // This is a design-time guard — requestPermissionSafe() must catch OS-PLUG-GLOC-0003
    console.info('[RegressionGuard FRT-018] GPS permission denied errors MUST return false, never throw');
  },

  // FRT-019: GPS watchdog must detect disabled location
  assertGpsWatchdogDetectsDisabled() {
    // Design-time guard — useGPSWatchdog must poll every 10s
    console.info('[RegressionGuard FRT-019] GPS watchdog MUST poll checkPermissionSafe() every 10s during active freight');
  },

  // FRT-020: Native GPS errors must not trigger alerts
  assertNativeGpsErrorsSuppressed() {
    // Design-time guard — OS-PLUG-GLOC-* must be in IGNORED_PATTERNS
    console.info('[RegressionGuard FRT-020] OS-PLUG-GLOC-* errors MUST be in IGNORED_PATTERNS and downgraded to warn');
  },

  // FRT-021: Withdrawn driver must not access freight details
  assertWithdrawnDriverBlocked(ctx: RuntimeGuardContext) {
    if (ctx.assignmentStatus === 'WITHDRAWN' || ctx.assignmentStatus === 'CANCELLED') {
      throw new RegressionViolation(
        'FRT-021',
        'withdrawn-driver-must-not-access-freight-details',
        `Motorista com assignment ${ctx.assignmentStatus} não pode acessar detalhes do frete.`,
      );
    }
  },

  // FRT-022: Available feed must exclude driver active assignments
  assertAvailableFeedExcludesActiveAssignments(ctx: RuntimeGuardContext) {
    if (ctx.freightIdsInAvailable && ctx.driverActiveFreightIds) {
      const overlap = ctx.freightIdsInAvailable.filter(id => ctx.driverActiveFreightIds!.includes(id));
      if (overlap.length > 0) {
        throw new RegressionViolation(
          'FRT-022',
          'available-feed-must-exclude-driver-active-assignments',
          `Fretes ${overlap.join(', ')} aparecem em Disponíveis mas motorista tem assignment ativo neles.`,
        );
      }
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
    case 'assignment-open-must-be-in-ongoing-statuses':
      regressionGuards.assertAssignmentOpenInOngoingStatuses(context);
      return;
    case 'already-accepted-must-not-show-success-toast':
      regressionGuards.assertAlreadyAcceptedNoSuccessToast(context);
      return;
    case 'accept-must-allow-accepted-with-slots':
      regressionGuards.assertAcceptAllowsAcceptedWithSlots(context);
      return;
    case 'gps-permission-denied-must-not-throw':
      regressionGuards.assertGpsPermissionDeniedNoThrow();
      return;
    case 'gps-watchdog-must-detect-disabled-location':
      regressionGuards.assertGpsWatchdogDetectsDisabled();
      return;
    case 'native-gps-errors-must-not-trigger-alerts':
      regressionGuards.assertNativeGpsErrorsSuppressed();
      return;
    case 'withdrawn-driver-must-not-access-freight-details':
      regressionGuards.assertWithdrawnDriverBlocked(context);
      return;
    case 'available-feed-must-exclude-driver-active-assignments':
      regressionGuards.assertAvailableFeedExcludesActiveAssignments(context);
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

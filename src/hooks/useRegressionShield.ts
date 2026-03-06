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
  | 'rpc-column-names-must-match-table-schema';

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

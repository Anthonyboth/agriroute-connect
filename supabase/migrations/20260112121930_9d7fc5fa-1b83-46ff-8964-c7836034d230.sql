-- =====================================================
-- CORREÇÃO DE SEGURANÇA COMPLETA - AgriRoute (v4)
-- =====================================================

-- 1. Criar função helper para verificar service_role
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role',
    false
  )
$$;

-- 2. Criar função helper para verificar admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::app_role
  )
$$;

-- =====================================================
-- PARTE 1: TABELAS DE SISTEMA/LOGS
-- =====================================================

-- audit_logs
DROP POLICY IF EXISTS "audit_logs_service_insert" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_admin_select" ON public.audit_logs;
CREATE POLICY "audit_logs_service_insert" ON public.audit_logs
FOR INSERT WITH CHECK (is_service_role() OR is_admin());
CREATE POLICY "audit_logs_admin_select" ON public.audit_logs
FOR SELECT USING (is_admin() OR user_id = auth.uid());

-- auditoria_eventos
DROP POLICY IF EXISTS "auditoria_eventos_service_insert" ON public.auditoria_eventos;
DROP POLICY IF EXISTS "auditoria_eventos_admin_select" ON public.auditoria_eventos;
CREATE POLICY "auditoria_eventos_service_insert" ON public.auditoria_eventos
FOR INSERT WITH CHECK (is_service_role() OR is_admin());
CREATE POLICY "auditoria_eventos_admin_select" ON public.auditoria_eventos
FOR SELECT USING (is_admin());

-- financial_audit_logs
DROP POLICY IF EXISTS "financial_audit_logs_service_insert" ON public.financial_audit_logs;
DROP POLICY IF EXISTS "financial_audit_logs_admin_select" ON public.financial_audit_logs;
CREATE POLICY "financial_audit_logs_service_insert" ON public.financial_audit_logs
FOR INSERT WITH CHECK (is_service_role() OR is_admin());
CREATE POLICY "financial_audit_logs_admin_select" ON public.financial_audit_logs
FOR SELECT USING (is_admin() OR user_id = auth.uid());

-- security_audit_log
DROP POLICY IF EXISTS "security_audit_log_service_insert" ON public.security_audit_log;
DROP POLICY IF EXISTS "security_audit_log_admin_select" ON public.security_audit_log;
CREATE POLICY "security_audit_log_service_insert" ON public.security_audit_log
FOR INSERT WITH CHECK (is_service_role() OR is_admin());
CREATE POLICY "security_audit_log_admin_select" ON public.security_audit_log
FOR SELECT USING (is_admin() OR user_id = auth.uid());

-- incident_logs
DROP POLICY IF EXISTS "incident_logs_service_insert" ON public.incident_logs;
DROP POLICY IF EXISTS "incident_logs_admin_select" ON public.incident_logs;
CREATE POLICY "incident_logs_service_insert" ON public.incident_logs
FOR INSERT WITH CHECK (is_service_role() OR is_admin());
CREATE POLICY "incident_logs_admin_select" ON public.incident_logs
FOR SELECT USING (is_admin() OR user_id = auth.uid());

-- fiscalizacao_logs
DROP POLICY IF EXISTS "fiscalizacao_logs_service_insert" ON public.fiscalizacao_logs;
DROP POLICY IF EXISTS "fiscalizacao_logs_admin_select" ON public.fiscalizacao_logs;
CREATE POLICY "fiscalizacao_logs_service_insert" ON public.fiscalizacao_logs
FOR INSERT WITH CHECK (is_service_role() OR is_admin());
CREATE POLICY "fiscalizacao_logs_admin_select" ON public.fiscalizacao_logs
FOR SELECT USING (is_admin());

-- inspection_access_logs
DROP POLICY IF EXISTS "inspection_access_logs_service_insert" ON public.inspection_access_logs;
DROP POLICY IF EXISTS "inspection_access_logs_admin_select" ON public.inspection_access_logs;
CREATE POLICY "inspection_access_logs_service_insert" ON public.inspection_access_logs
FOR INSERT WITH CHECK (true);
CREATE POLICY "inspection_access_logs_admin_select" ON public.inspection_access_logs
FOR SELECT USING (is_admin());

-- freight_events
DROP POLICY IF EXISTS "freight_events_service_insert" ON public.freight_events;
DROP POLICY IF EXISTS "freight_events_owner_select" ON public.freight_events;
CREATE POLICY "freight_events_service_insert" ON public.freight_events
FOR INSERT WITH CHECK (is_service_role() OR is_admin());
CREATE POLICY "freight_events_owner_select" ON public.freight_events
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.freights f WHERE f.id = freight_id AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid()))
  OR is_admin()
);

-- freight_eta_history
DROP POLICY IF EXISTS "freight_eta_history_service_insert" ON public.freight_eta_history;
DROP POLICY IF EXISTS "freight_eta_history_owner_select" ON public.freight_eta_history;
CREATE POLICY "freight_eta_history_service_insert" ON public.freight_eta_history
FOR INSERT WITH CHECK (is_service_role() OR is_admin());
CREATE POLICY "freight_eta_history_owner_select" ON public.freight_eta_history
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.freights f WHERE f.id = freight_id AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid()))
  OR is_admin()
);

-- freight_delay_alerts
DROP POLICY IF EXISTS "freight_delay_alerts_service_insert" ON public.freight_delay_alerts;
DROP POLICY IF EXISTS "freight_delay_alerts_owner_select" ON public.freight_delay_alerts;
CREATE POLICY "freight_delay_alerts_service_insert" ON public.freight_delay_alerts
FOR INSERT WITH CHECK (is_service_role() OR is_admin());
CREATE POLICY "freight_delay_alerts_owner_select" ON public.freight_delay_alerts
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.freights f WHERE f.id = freight_id AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid()))
  OR is_admin()
);

-- freight_alerts
DROP POLICY IF EXISTS "freight_alerts_service_insert" ON public.freight_alerts;
DROP POLICY IF EXISTS "freight_alerts_owner_select" ON public.freight_alerts;
CREATE POLICY "freight_alerts_service_insert" ON public.freight_alerts
FOR INSERT WITH CHECK (is_service_role() OR is_admin());
CREATE POLICY "freight_alerts_owner_select" ON public.freight_alerts
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.freights f WHERE f.id = freight_id AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid()))
  OR is_admin()
);

-- driver_location_history
DROP POLICY IF EXISTS "driver_location_history_service_insert" ON public.driver_location_history;
DROP POLICY IF EXISTS "driver_location_history_owner_select" ON public.driver_location_history;
CREATE POLICY "driver_location_history_service_insert" ON public.driver_location_history
FOR INSERT WITH CHECK (driver_profile_id = auth.uid() OR is_service_role());
CREATE POLICY "driver_location_history_owner_select" ON public.driver_location_history
FOR SELECT USING (
  driver_profile_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.freights f WHERE f.id = freight_id AND f.producer_id = auth.uid())
  OR is_admin()
);

-- driver_badges
DROP POLICY IF EXISTS "driver_badges_service_insert" ON public.driver_badges;
DROP POLICY IF EXISTS "driver_badges_owner_select" ON public.driver_badges;
CREATE POLICY "driver_badges_service_insert" ON public.driver_badges
FOR INSERT WITH CHECK (is_service_role() OR is_admin());
CREATE POLICY "driver_badges_owner_select" ON public.driver_badges
FOR SELECT USING (driver_id = auth.uid() OR is_admin());

-- proposal_reminders
DROP POLICY IF EXISTS "proposal_reminders_service_insert" ON public.proposal_reminders;
DROP POLICY IF EXISTS "proposal_reminders_service_update" ON public.proposal_reminders;
CREATE POLICY "proposal_reminders_service_insert" ON public.proposal_reminders
FOR INSERT WITH CHECK (is_service_role() OR is_admin());
CREATE POLICY "proposal_reminders_service_update" ON public.proposal_reminders
FOR UPDATE USING (is_service_role() OR is_admin());

-- security_alerts
DROP POLICY IF EXISTS "security_alerts_service_insert" ON public.security_alerts;
DROP POLICY IF EXISTS "security_alerts_admin_select" ON public.security_alerts;
CREATE POLICY "security_alerts_service_insert" ON public.security_alerts
FOR INSERT WITH CHECK (is_service_role() OR is_admin());
CREATE POLICY "security_alerts_admin_select" ON public.security_alerts
FOR SELECT USING (is_admin());

-- =====================================================
-- PARTE 2: TABELAS DE CONFIGURAÇÃO
-- =====================================================

DROP POLICY IF EXISTS "admin_password_reset_limits_admin_manage" ON public.admin_password_reset_limits;
CREATE POLICY "admin_password_reset_limits_admin_manage" ON public.admin_password_reset_limits
FOR ALL USING (is_admin() OR is_service_role()) WITH CHECK (is_admin() OR is_service_role());

DROP POLICY IF EXISTS "antt_rates_public_select" ON public.antt_rates;
DROP POLICY IF EXISTS "antt_rates_admin_manage" ON public.antt_rates;
DROP POLICY IF EXISTS "antt_rates_authenticated_select" ON public.antt_rates;
CREATE POLICY "antt_rates_authenticated_select" ON public.antt_rates
FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "antt_rates_admin_manage" ON public.antt_rates
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "antt_recalculation_history_admin_manage" ON public.antt_recalculation_history;
CREATE POLICY "antt_recalculation_history_admin_manage" ON public.antt_recalculation_history
FOR ALL USING (is_admin() OR is_service_role()) WITH CHECK (is_admin() OR is_service_role());

DROP POLICY IF EXISTS "driver_levels_service_insert" ON public.driver_levels;
DROP POLICY IF EXISTS "driver_levels_service_manage" ON public.driver_levels;
DROP POLICY IF EXISTS "driver_levels_owner_select" ON public.driver_levels;
DROP POLICY IF EXISTS "driver_levels_service_update" ON public.driver_levels;
CREATE POLICY "driver_levels_service_manage" ON public.driver_levels
FOR INSERT WITH CHECK (is_service_role() OR is_admin());
CREATE POLICY "driver_levels_owner_select" ON public.driver_levels
FOR SELECT USING (driver_id = auth.uid() OR is_admin());
CREATE POLICY "driver_levels_service_update" ON public.driver_levels
FOR UPDATE USING (is_service_role() OR is_admin());

-- =====================================================
-- PARTE 3: TABELAS DE USUÁRIO
-- =====================================================

DROP POLICY IF EXISTS "api_rate_limits_service_manage" ON public.api_rate_limits;
DROP POLICY IF EXISTS "api_rate_limits_owner_select" ON public.api_rate_limits;
CREATE POLICY "api_rate_limits_service_manage" ON public.api_rate_limits
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "api_rate_limits_owner_select" ON public.api_rate_limits
FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "driver_notification_limits_service_manage" ON public.driver_notification_limits;
DROP POLICY IF EXISTS "driver_notification_limits_owner_select" ON public.driver_notification_limits;
CREATE POLICY "driver_notification_limits_service_manage" ON public.driver_notification_limits
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "driver_notification_limits_owner_select" ON public.driver_notification_limits
FOR SELECT USING (driver_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "provider_notification_limits_service_manage" ON public.provider_notification_limits;
DROP POLICY IF EXISTS "provider_notification_limits_owner_select" ON public.provider_notification_limits;
CREATE POLICY "provider_notification_limits_service_manage" ON public.provider_notification_limits
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "provider_notification_limits_owner_select" ON public.provider_notification_limits
FOR SELECT USING (provider_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "driver_stripe_accounts_service_manage" ON public.driver_stripe_accounts;
DROP POLICY IF EXISTS "driver_stripe_accounts_owner_select" ON public.driver_stripe_accounts;
CREATE POLICY "driver_stripe_accounts_service_manage" ON public.driver_stripe_accounts
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "driver_stripe_accounts_owner_select" ON public.driver_stripe_accounts
FOR SELECT USING (driver_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "balance_transactions_service_manage" ON public.balance_transactions;
DROP POLICY IF EXISTS "balance_transactions_owner_select" ON public.balance_transactions;
CREATE POLICY "balance_transactions_service_manage" ON public.balance_transactions
FOR INSERT WITH CHECK (is_service_role());
CREATE POLICY "balance_transactions_owner_select" ON public.balance_transactions
FOR SELECT USING (provider_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "service_provider_balances_service_manage" ON public.service_provider_balances;
DROP POLICY IF EXISTS "service_provider_balances_owner_select" ON public.service_provider_balances;
CREATE POLICY "service_provider_balances_service_manage" ON public.service_provider_balances
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "service_provider_balances_owner_select" ON public.service_provider_balances
FOR SELECT USING (provider_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "subscribers_service_manage" ON public.subscribers;
DROP POLICY IF EXISTS "subscribers_owner_select" ON public.subscribers;
CREATE POLICY "subscribers_service_manage" ON public.subscribers
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "subscribers_owner_select" ON public.subscribers
FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "payments_service_update" ON public.payments;
DROP POLICY IF EXISTS "payments_owner_select" ON public.payments;
CREATE POLICY "payments_service_update" ON public.payments
FOR UPDATE USING (is_service_role() OR is_admin());
CREATE POLICY "payments_owner_select" ON public.payments
FOR SELECT USING (producer_id = auth.uid() OR driver_id = auth.uid() OR is_admin());

-- =====================================================
-- PARTE 4: TABELAS DE MATCH/CHAT
-- =====================================================

DROP POLICY IF EXISTS "freight_matches_service_manage" ON public.freight_matches;
DROP POLICY IF EXISTS "freight_matches_service_insert" ON public.freight_matches;
DROP POLICY IF EXISTS "freight_matches_participant_select" ON public.freight_matches;
DROP POLICY IF EXISTS "freight_matches_service_update" ON public.freight_matches;
CREATE POLICY "freight_matches_service_insert" ON public.freight_matches
FOR INSERT WITH CHECK (is_service_role() OR driver_id = auth.uid());
CREATE POLICY "freight_matches_participant_select" ON public.freight_matches
FOR SELECT USING (
  driver_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.freights f WHERE f.id = freight_id AND f.producer_id = auth.uid())
  OR is_admin()
);
CREATE POLICY "freight_matches_service_update" ON public.freight_matches
FOR UPDATE USING (is_service_role() OR is_admin());

DROP POLICY IF EXISTS "freight_chat_participants_service_manage" ON public.freight_chat_participants;
DROP POLICY IF EXISTS "freight_chat_participants_member_select" ON public.freight_chat_participants;
CREATE POLICY "freight_chat_participants_service_manage" ON public.freight_chat_participants
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "freight_chat_participants_member_select" ON public.freight_chat_participants
FOR SELECT USING (participant_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "freight_assignments_service_manage" ON public.freight_assignments;
DROP POLICY IF EXISTS "freight_assignments_service_insert" ON public.freight_assignments;
DROP POLICY IF EXISTS "freight_assignments_participant_select" ON public.freight_assignments;
DROP POLICY IF EXISTS "freight_assignments_service_update" ON public.freight_assignments;
CREATE POLICY "freight_assignments_service_insert" ON public.freight_assignments
FOR INSERT WITH CHECK (is_service_role());
CREATE POLICY "freight_assignments_participant_select" ON public.freight_assignments
FOR SELECT USING (
  driver_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.freights f WHERE f.id = freight_id AND f.producer_id = auth.uid())
  OR is_admin()
);
CREATE POLICY "freight_assignments_service_update" ON public.freight_assignments
FOR UPDATE USING (is_service_role() OR is_admin());

DROP POLICY IF EXISTS "service_matches_service_manage" ON public.service_matches;
DROP POLICY IF EXISTS "service_matches_service_insert" ON public.service_matches;
DROP POLICY IF EXISTS "service_matches_participant_select" ON public.service_matches;
DROP POLICY IF EXISTS "service_matches_service_update" ON public.service_matches;
CREATE POLICY "service_matches_service_insert" ON public.service_matches
FOR INSERT WITH CHECK (is_service_role() OR provider_id = auth.uid());
CREATE POLICY "service_matches_participant_select" ON public.service_matches
FOR SELECT USING (
  provider_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = service_request_id AND sr.client_id = auth.uid())
  OR is_admin()
);
CREATE POLICY "service_matches_service_update" ON public.service_matches
FOR UPDATE USING (is_service_role() OR is_admin());

DROP POLICY IF EXISTS "location_chat_log_service_manage" ON public.location_chat_log;
DROP POLICY IF EXISTS "location_chat_log_service_insert" ON public.location_chat_log;
DROP POLICY IF EXISTS "location_chat_log_participant_select" ON public.location_chat_log;
CREATE POLICY "location_chat_log_service_insert" ON public.location_chat_log
FOR INSERT WITH CHECK (is_service_role() OR driver_profile_id = auth.uid());
CREATE POLICY "location_chat_log_participant_select" ON public.location_chat_log
FOR SELECT USING (driver_profile_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "telegram_message_queue_service_manage" ON public.telegram_message_queue;
DROP POLICY IF EXISTS "telegram_message_queue_admin_select" ON public.telegram_message_queue;
CREATE POLICY "telegram_message_queue_service_manage" ON public.telegram_message_queue
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "telegram_message_queue_admin_select" ON public.telegram_message_queue
FOR SELECT USING (is_admin());

-- =====================================================
-- PARTE 5: TABELAS DE GUEST/PROSPECT
-- =====================================================

DROP POLICY IF EXISTS "guest_requests_public_insert" ON public.guest_requests;
DROP POLICY IF EXISTS "guest_requests_service_manage" ON public.guest_requests;
DROP POLICY IF EXISTS "guest_requests_service_update" ON public.guest_requests;
DROP POLICY IF EXISTS "guest_requests_admin_select" ON public.guest_requests;
CREATE POLICY "guest_requests_public_insert" ON public.guest_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "guest_requests_service_update" ON public.guest_requests FOR UPDATE USING (is_service_role() OR is_admin());
CREATE POLICY "guest_requests_admin_select" ON public.guest_requests FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "prospect_users_public_insert" ON public.prospect_users;
DROP POLICY IF EXISTS "prospect_users_service_manage" ON public.prospect_users;
DROP POLICY IF EXISTS "prospect_users_service_update" ON public.prospect_users;
DROP POLICY IF EXISTS "prospect_users_admin_select" ON public.prospect_users;
CREATE POLICY "prospect_users_public_insert" ON public.prospect_users FOR INSERT WITH CHECK (true);
CREATE POLICY "prospect_users_service_update" ON public.prospect_users FOR UPDATE USING (is_service_role() OR is_admin());
CREATE POLICY "prospect_users_admin_select" ON public.prospect_users FOR SELECT USING (is_admin());

-- =====================================================
-- PARTE 6: CORREÇÃO DA TABELA PROFILES
-- =====================================================

DROP POLICY IF EXISTS "profiles_service_role_all" ON public.profiles;

-- =====================================================
-- PARTE 7: CORREÇÃO DA VIEW SECURITY DEFINER
-- =====================================================

ALTER VIEW public.inspection_qr_public SET (security_invoker = true);

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON FUNCTION public.is_service_role() IS 'Verifica se a requisição atual é de um service_role (backend)';
COMMENT ON FUNCTION public.is_admin() IS 'Verifica se o usuário atual tem role de admin';
-- =====================================================
-- CORREÇÃO DE SEGURANÇA - PARTE 2 (Limpar políticas antigas)
-- =====================================================

-- admin_password_reset_limits - remover política antiga
DROP POLICY IF EXISTS "System manages reset limits" ON public.admin_password_reset_limits;

-- antt_rates - remover políticas antigas
DROP POLICY IF EXISTS "Service role can manage ANTT rates" ON public.antt_rates;

-- antt_recalculation_history - remover política antiga
DROP POLICY IF EXISTS "System can insert recalculation history" ON public.antt_recalculation_history;

-- api_rate_limits - remover política antiga
DROP POLICY IF EXISTS "System can manage rate limits" ON public.api_rate_limits;

-- audit_logs - remover política antiga
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- auditoria_eventos - remover política antiga
DROP POLICY IF EXISTS "auditoria_eventos_insert_system" ON public.auditoria_eventos;

-- balance_transactions - remover política antiga
DROP POLICY IF EXISTS "Sistema pode gerenciar transações" ON public.balance_transactions;

-- driver_badges - remover políticas antigas
DROP POLICY IF EXISTS "System inserts driver badges" ON public.driver_badges;

-- driver_levels - remover políticas antigas
DROP POLICY IF EXISTS "System manages driver levels" ON public.driver_levels;

-- driver_location_history - remover política antiga
DROP POLICY IF EXISTS "System can insert location history" ON public.driver_location_history;

-- driver_notification_limits - remover política antiga
DROP POLICY IF EXISTS "System can manage notification limits" ON public.driver_notification_limits;

-- driver_stripe_accounts - remover política antiga
DROP POLICY IF EXISTS "System can manage stripe accounts" ON public.driver_stripe_accounts;

-- financial_audit_logs - remover política antiga
DROP POLICY IF EXISTS "System can insert audit logs" ON public.financial_audit_logs;

-- fiscalizacao_logs - remover política antiga
DROP POLICY IF EXISTS "fiscalizacao_logs_insert_system" ON public.fiscalizacao_logs;

-- freight_alerts - remover política antiga
DROP POLICY IF EXISTS "System creates alerts" ON public.freight_alerts;

-- freight_assignments - remover política antiga
DROP POLICY IF EXISTS "System can create assignments" ON public.freight_assignments;

-- freight_chat_participants - remover política antiga
DROP POLICY IF EXISTS "Sistema gerencia participantes" ON public.freight_chat_participants;

-- freight_delay_alerts - remover política antiga
DROP POLICY IF EXISTS "Sistema pode inserir alertas" ON public.freight_delay_alerts;

-- freight_eta_history - remover política antiga
DROP POLICY IF EXISTS "System inserts ETA history" ON public.freight_eta_history;

-- freight_events - remover política antiga
DROP POLICY IF EXISTS "System inserts events" ON public.freight_events;

-- freight_matches - remover política antiga
DROP POLICY IF EXISTS "System can manage freight matches" ON public.freight_matches;

-- freight_payment_deadlines - remover política antiga
DROP POLICY IF EXISTS "System can manage payment deadlines" ON public.freight_payment_deadlines;
CREATE POLICY "freight_payment_deadlines_admin_select" ON public.freight_payment_deadlines
FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "freight_payment_deadlines_admin_manage" ON public.freight_payment_deadlines
FOR ALL USING (is_admin() OR is_service_role()) WITH CHECK (is_admin() OR is_service_role());

-- guest_requests - remover políticas antigas
DROP POLICY IF EXISTS "Public can create guest requests" ON public.guest_requests;
DROP POLICY IF EXISTS "System can manage guest requests" ON public.guest_requests;

-- incident_logs - remover política antiga
DROP POLICY IF EXISTS "System can create incidents" ON public.incident_logs;

-- inspection_access_logs - remover política antiga
DROP POLICY IF EXISTS "Log inspection access" ON public.inspection_access_logs;

-- location_chat_log - remover política antiga
DROP POLICY IF EXISTS "System can manage location chat log" ON public.location_chat_log;

-- payments - remover política antiga
DROP POLICY IF EXISTS "System can update payments" ON public.payments;

-- proposal_reminders - remover política antiga
DROP POLICY IF EXISTS "System can insert reminders" ON public.proposal_reminders;

-- prospect_users - remover políticas antigas
DROP POLICY IF EXISTS "Service role can insert prospect users" ON public.prospect_users;
DROP POLICY IF EXISTS "Service role can update prospect users" ON public.prospect_users;

-- provider_notification_limits - remover política antiga
DROP POLICY IF EXISTS "System can manage provider notification limits" ON public.provider_notification_limits;

-- security_alerts - remover política antiga
DROP POLICY IF EXISTS "System creates security alerts" ON public.security_alerts;

-- security_audit_log - remover política antiga
DROP POLICY IF EXISTS "System can create audit logs" ON public.security_audit_log;

-- service_matches - remover política antiga
DROP POLICY IF EXISTS "System can manage service matches" ON public.service_matches;

-- service_payments - criar políticas seguras
DROP POLICY IF EXISTS "Sistema pode gerenciar pagamentos" ON public.service_payments;
CREATE POLICY "service_payments_service_manage" ON public.service_payments
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());
CREATE POLICY "service_payments_owner_select" ON public.service_payments
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = service_request_id AND (sr.client_id = auth.uid() OR sr.provider_id = auth.uid()))
  OR is_admin()
);

-- service_provider_balances - remover política antiga
DROP POLICY IF EXISTS "Sistema pode gerenciar saldos" ON public.service_provider_balances;

-- subscribers - remover políticas antigas
DROP POLICY IF EXISTS "insert_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscribers;

-- subscription_fees - criar políticas seguras
DROP POLICY IF EXISTS "System can insert subscription fees" ON public.subscription_fees;
CREATE POLICY "subscription_fees_admin_manage" ON public.subscription_fees
FOR ALL USING (is_admin() OR is_service_role()) WITH CHECK (is_admin() OR is_service_role());
CREATE POLICY "subscription_fees_authenticated_select" ON public.subscription_fees
FOR SELECT USING (auth.uid() IS NOT NULL);

-- telegram_message_queue - remover políticas antigas
DROP POLICY IF EXISTS "Service role can insert telegram messages" ON public.telegram_message_queue;
DROP POLICY IF EXISTS "Service role can update telegram messages" ON public.telegram_message_queue;

-- =====================================================
-- PERFORMANCE: Índices para acelerar funções RLS
-- =====================================================

-- 1. freights.drivers_assigned (GIN) - usado por is_freight_participant
-- para verificar se profile_id está no array de motoristas
CREATE INDEX IF NOT EXISTS idx_freights_drivers_assigned_gin
ON public.freights USING GIN (drivers_assigned);

-- 2. freights: índice composto para is_freight_participant
-- Cobre queries por status + producer_id e status + driver_id simultaneamente
CREATE INDEX IF NOT EXISTS idx_freights_status_producer_driver
ON public.freights USING btree (status, producer_id, driver_id);

-- 3. balance_transactions: índice por provider_id (falta total!)
CREATE INDEX IF NOT EXISTS idx_balance_transactions_provider
ON public.balance_transactions USING btree (provider_id);

-- 4. balance_transactions: índice por status para filtros comuns
CREATE INDEX IF NOT EXISTS idx_balance_transactions_status
ON public.balance_transactions USING btree (status);

-- 5. freight_payments: índices para payer/receiver lookups
CREATE INDEX IF NOT EXISTS idx_freight_payments_freight
ON public.freight_payments USING btree (freight_id);

CREATE INDEX IF NOT EXISTS idx_freight_payments_payer
ON public.freight_payments USING btree (payer_id);

CREATE INDEX IF NOT EXISTS idx_freight_payments_receiver
ON public.freight_payments USING btree (receiver_id);

-- 6. transport_companies: índice por profile_id (usado por is_affiliated_driver)
CREATE INDEX IF NOT EXISTS idx_transport_companies_profile
ON public.transport_companies USING btree (profile_id);

-- 7. profiles: índice por user_id (usado por TODAS as funções RLS que resolvem auth.uid())
CREATE INDEX IF NOT EXISTS idx_profiles_user_id
ON public.profiles USING btree (user_id);

-- 8. driver_location_history: índice composto driver+freight para RLS
CREATE INDEX IF NOT EXISTS idx_location_history_driver_freight
ON public.driver_location_history USING btree (driver_profile_id, freight_id);

-- 9. profiles_encrypted_data: garantir índice PK (já deve existir, mas confirmar)
-- Não precisa de índice adicional pois pii_select_own_strict usa id = get_my_profile_id_for_pii()

-- 10. service_requests: índice para is_service_participant (accepted + not completed/cancelled)
CREATE INDEX IF NOT EXISTS idx_service_requests_active_participants
ON public.service_requests USING btree (client_id, provider_id)
WHERE accepted_at IS NOT NULL AND completed_at IS NULL AND cancelled_at IS NULL;

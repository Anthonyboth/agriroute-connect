-- ============================================================
-- ÍNDICES DE PERFORMANCE PARA QUERIES PRINCIPAIS - AGRIROUTE
-- Versão final corrigida baseada no schema real
-- ============================================================

-- Índices para external_payments (pagamentos do produtor)
CREATE INDEX IF NOT EXISTS idx_external_payments_producer_status 
  ON external_payments(producer_id, status);

CREATE INDEX IF NOT EXISTS idx_external_payments_driver_status 
  ON external_payments(driver_id, status);

CREATE INDEX IF NOT EXISTS idx_external_payments_created_at 
  ON external_payments(created_at DESC);

-- Índices para freight_proposals (propostas de motoristas)
CREATE INDEX IF NOT EXISTS idx_freight_proposals_driver_status 
  ON freight_proposals(driver_id, status);

CREATE INDEX IF NOT EXISTS idx_freight_proposals_freight_status 
  ON freight_proposals(freight_id, status);

CREATE INDEX IF NOT EXISTS idx_freight_proposals_created_at 
  ON freight_proposals(created_at DESC);

-- Índices para freights (fretes)
CREATE INDEX IF NOT EXISTS idx_freights_producer_status 
  ON freights(producer_id, status);

CREATE INDEX IF NOT EXISTS idx_freights_driver_status 
  ON freights(driver_id, status);

CREATE INDEX IF NOT EXISTS idx_freights_status_created 
  ON freights(status, created_at DESC);

-- Índices para fiscal_issuers (emissores fiscais)
CREATE INDEX IF NOT EXISTS idx_fiscal_issuers_profile 
  ON fiscal_issuers(profile_id);

CREATE INDEX IF NOT EXISTS idx_fiscal_issuers_status 
  ON fiscal_issuers(status);

-- Índices para profiles (perfis de usuário)
CREATE INDEX IF NOT EXISTS idx_profiles_user_role 
  ON profiles(user_id, role);

CREATE INDEX IF NOT EXISTS idx_profiles_status 
  ON profiles(status);

-- Índices para notifications (notificações)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON notifications(user_id, read);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
  ON notifications(created_at DESC);

-- Índices para service_requests (serviços) - usando colunas reais
CREATE INDEX IF NOT EXISTS idx_service_requests_client_status 
  ON service_requests(client_id, status);

CREATE INDEX IF NOT EXISTS idx_service_requests_provider_status 
  ON service_requests(provider_id, status);
-- =====================================================
-- FASE 1: QUICK WINS - OTIMIZAÇÃO DE BANCO DE DADOS
-- =====================================================

-- 1. ÍNDICES NA TABELA NOTIFICATIONS
-- Melhora consultas de notificações não lidas por usuário
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
ON notifications (user_id, read) 
WHERE read = false;

-- Índice para ordenação por data
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON notifications (user_id, created_at DESC);

-- Índice composto para queries comuns
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_read 
ON notifications (user_id, type, read);

-- 2. REMOVER ÍNDICE DUPLICADO
-- idx_freights_id é redundante pois freights_pkey já cobre a coluna id
DROP INDEX IF EXISTS idx_freights_id;

-- 3. ÍNDICES ADICIONAIS PARA PERFORMANCE
-- Error logs - consultas por data e tipo
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at 
ON error_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_error_type 
ON error_logs (error_type, created_at DESC);

-- Audit logs - consultas por tabela e operação
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_timestamp 
ON audit_logs (table_name, timestamp DESC);

-- Freights - consultas frequentes
CREATE INDEX IF NOT EXISTS idx_freights_status_pickup 
ON freights (status, pickup_date) 
WHERE status NOT IN ('CANCELLED', 'DELIVERED', 'COMPLETED');

-- Driver location history - para cleanup queries (sem predicado NOW())
CREATE INDEX IF NOT EXISTS idx_driver_location_expires 
ON driver_location_history (expires_at);

-- 4. CONFIGURAR AUTOVACUUM AGRESSIVO PARA TABELAS DE LOG
ALTER TABLE error_logs SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE audit_logs SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- 5. ATUALIZAR ESTATÍSTICAS
ANALYZE notifications;
ANALYZE error_logs;
ANALYZE audit_logs;
ANALYZE freights;
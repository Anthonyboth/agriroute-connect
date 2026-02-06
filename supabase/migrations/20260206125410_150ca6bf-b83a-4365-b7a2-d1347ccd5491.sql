
-- =====================================================
-- Reduzir retenção de driver_location_history de 360 para 7 dias
-- Finding: driver_location_history_tracking
-- Razão: 360 dias é excessivo; 7 dias é suficiente para auditoria operacional
-- O trigger purge_freight_location_history já reduz para 24h após entrega
-- =====================================================

-- 1. Alterar o DEFAULT da coluna expires_at de 360 para 7 dias
ALTER TABLE public.driver_location_history 
ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '7 days');

-- 2. Atualizar registros existentes que têm retenção excessiva
-- Manter o expires_at do trigger de purge (24h pós-entrega) inalterado
UPDATE public.driver_location_history
SET expires_at = captured_at + INTERVAL '7 days'
WHERE expires_at > now() + INTERVAL '7 days';

-- 3. Documentar a mudança
COMMENT ON COLUMN public.driver_location_history.expires_at IS 
'Retenção máxima de 7 dias (reduzida de 360). Trigger purge_freight_location_history reduz para 24h após conclusão do frete.';

COMMENT ON TABLE public.driver_location_history IS 
'Histórico de localização GPS de motoristas. Retenção: 7 dias (default) ou 24h após frete concluído. Dados sensíveis protegidos por RLS com acesso restrito a 1 hora para terceiros em fretes ativos.';

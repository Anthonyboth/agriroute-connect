-- Corrigir tipo de dados das colunas de data na tabela freights
-- Isso resolve o erro PostgreSQL 42804 no RPC get_freights_for_driver
ALTER TABLE public.freights 
  ALTER COLUMN pickup_date TYPE TIMESTAMPTZ USING pickup_date::TIMESTAMPTZ,
  ALTER COLUMN delivery_date TYPE TIMESTAMPTZ USING delivery_date::TIMESTAMPTZ;

COMMENT ON COLUMN public.freights.pickup_date IS 'Data e hora de coleta (TIMESTAMPTZ para compatibilidade com RPC get_freights_for_driver)';
COMMENT ON COLUMN public.freights.delivery_date IS 'Data e hora de entrega (TIMESTAMPTZ para compatibilidade com RPC get_freights_for_driver)';
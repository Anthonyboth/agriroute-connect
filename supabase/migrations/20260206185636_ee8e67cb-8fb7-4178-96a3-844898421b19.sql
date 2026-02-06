-- Adicionar FKs faltantes na tabela external_payments
-- producer_id → profiles(id)
ALTER TABLE public.external_payments
  ADD CONSTRAINT external_payments_producer_id_fkey
  FOREIGN KEY (producer_id) REFERENCES public.profiles(id);

-- driver_id → profiles(id)
ALTER TABLE public.external_payments
  ADD CONSTRAINT external_payments_driver_id_fkey
  FOREIGN KEY (driver_id) REFERENCES public.profiles(id);
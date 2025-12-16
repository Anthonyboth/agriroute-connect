-- Permitir criação de fretes como convidado (sem cadastro)
-- Hoje o banco exige producer_id NOT NULL, mas a política/fluxo de guest usa producer_id = NULL.
ALTER TABLE public.freights
  ALTER COLUMN producer_id DROP NOT NULL;
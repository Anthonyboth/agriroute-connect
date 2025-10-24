-- Corrigir incompatibilidade de tipos entre freights e freight_assignments
-- freights.pickup_date e delivery_date são TIMESTAMPTZ
-- freight_assignments.pickup_date e delivery_date eram DATE
-- Isso causava erro: "invalid input syntax for type timestamp with time zone"

ALTER TABLE public.freight_assignments 
  ALTER COLUMN pickup_date TYPE TIMESTAMPTZ USING pickup_date::TIMESTAMPTZ,
  ALTER COLUMN delivery_date TYPE TIMESTAMPTZ USING delivery_date::TIMESTAMPTZ;

COMMENT ON COLUMN public.freight_assignments.pickup_date IS 'Data e hora de coleta (TIMESTAMPTZ alinhado com freights.pickup_date)';
COMMENT ON COLUMN public.freight_assignments.delivery_date IS 'Data e hora de entrega (TIMESTAMPTZ alinhado com freights.delivery_date)';
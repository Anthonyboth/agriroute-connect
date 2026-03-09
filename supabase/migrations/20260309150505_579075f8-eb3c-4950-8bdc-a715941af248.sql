
-- Limpar todos os fretes de teste e dados relacionados
TRUNCATE TABLE public.freights CASCADE;
TRUNCATE TABLE public.service_requests CASCADE;

-- Limpar tabelas de histórico/operação órfãs
TRUNCATE TABLE public.driver_trip_progress CASCADE;
TRUNCATE TABLE public.operation_history CASCADE;
TRUNCATE TABLE public.freight_assignment_history CASCADE;

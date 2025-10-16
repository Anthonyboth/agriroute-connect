-- Corrige ON CONFLICT em check_rate_limit criando índices únicos necessários
-- Índice único para (user_id, endpoint) em api_rate_limits
CREATE UNIQUE INDEX IF NOT EXISTS api_rate_limits_user_endpoint_key
ON public.api_rate_limits (user_id, endpoint);

-- Opcional e seguro: cria índice único equivalente em rate_limit_violations se a tabela existir
DO $$
BEGIN
  IF to_regclass('public.rate_limit_violations') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS rate_limit_violations_user_endpoint_key
    ON public.rate_limit_violations (user_id, endpoint);
  END IF;
END
$$;
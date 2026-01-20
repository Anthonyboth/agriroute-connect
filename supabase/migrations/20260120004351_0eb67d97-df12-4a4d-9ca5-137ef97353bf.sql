-- =========================================================
-- Tabela: service_request_matches
-- Matching espacial para service_requests (FRETE_MOTO, GUINCHO, MUDANCA, etc)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.service_request_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL,
  distance_m INTEGER NOT NULL DEFAULT 0,
  match_score NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unicidade (um match por service_request + driver)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'service_request_matches_unique_driver_request'
  ) THEN
    ALTER TABLE public.service_request_matches
      ADD CONSTRAINT service_request_matches_unique_driver_request
      UNIQUE (service_request_id, driver_id);
  END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_service_request_matches_driver_created
  ON public.service_request_matches (driver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_request_matches_request
  ON public.service_request_matches (service_request_id);

-- =========================================================
-- RLS para service_request_matches
-- =========================================================

ALTER TABLE public.service_request_matches ENABLE ROW LEVEL SECURITY;

-- Motorista pode ler seus próprios matches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'service_request_matches'
      AND policyname = 'Driver can read own service request matches'
  ) THEN
    CREATE POLICY "Driver can read own service request matches"
      ON public.service_request_matches
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = service_request_matches.driver_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Permitir INSERT/UPDATE/DELETE apenas via service role (Edge Functions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'service_request_matches'
      AND policyname = 'Service role full access to service_request_matches'
  ) THEN
    CREATE POLICY "Service role full access to service_request_matches"
      ON public.service_request_matches
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- =====================================================
-- A.2: Tabela de auditoria antifraude para fretes guest
-- =====================================================
CREATE TABLE IF NOT EXISTS public.guest_freight_security_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  freight_id UUID REFERENCES public.freights(id) ON DELETE SET NULL,
  ip TEXT NOT NULL,
  user_agent TEXT,
  fingerprint_hash TEXT NOT NULL,
  phone_hash TEXT,
  document_hash TEXT,
  result TEXT NOT NULL CHECK (result IN ('ALLOWED', 'BLOCKED', 'REVIEW')),
  reason_code TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para consulta rápida
CREATE INDEX idx_gfsl_fingerprint ON public.guest_freight_security_log(fingerprint_hash, created_at DESC);
CREATE INDEX idx_gfsl_phone ON public.guest_freight_security_log(phone_hash, created_at DESC) WHERE phone_hash IS NOT NULL;
CREATE INDEX idx_gfsl_document ON public.guest_freight_security_log(document_hash, created_at DESC) WHERE document_hash IS NOT NULL;
CREATE INDEX idx_gfsl_ip ON public.guest_freight_security_log(ip, created_at DESC);
CREATE INDEX idx_gfsl_result ON public.guest_freight_security_log(result) WHERE result IN ('BLOCKED', 'REVIEW');

-- RLS: apenas service_role e admins
ALTER TABLE public.guest_freight_security_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages guest freight logs"
ON public.guest_freight_security_log FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Admins view guest freight logs"
ON public.guest_freight_security_log FOR SELECT
TO authenticated
USING (is_admin());

-- =====================================================
-- B.1: Bloquear INSERT guest direto na tabela freights
-- Remover política que permitia guests inserirem direto
-- =====================================================
DROP POLICY IF EXISTS "guests_can_insert_freights" ON public.freights;

-- Criar política que SOMENTE service_role pode inserir fretes guest
CREATE POLICY "service_role_inserts_guest_freights"
ON public.freights FOR INSERT
TO service_role
WITH CHECK (
  is_guest_freight = true AND producer_id IS NULL
);

-- A política de produtores continua intacta (producer_insert_own_freights)

COMMENT ON TABLE public.guest_freight_security_log IS 
'Log antifraude para criação de fretes rurais por usuários não cadastrados. Armazena hashes de PII, nunca dados brutos.';

COMMENT ON POLICY "service_role_inserts_guest_freights" ON public.freights IS 
'Apenas Edge Functions (service_role) podem criar fretes guest. Bloqueia INSERT direto pelo client.';

-- =====================================================
-- MIGRATION: MAPA-GRADE SANITARY COMPLIANCE HARDENING
-- AgriRoute - Compliance Pecuário
-- =====================================================

-- 1. TIPOS ENUM PARA SEMÂNTICA JURÍDICA
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sanitary_compliance_status_enum') THEN
    CREATE TYPE sanitary_compliance_status_enum AS ENUM (
      'PENDING',
      'COMPLIANT',
      'NON_COMPLIANT',
      'EXPIRED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'livestock_species_enum') THEN
    CREATE TYPE livestock_species_enum AS ENUM (
      'bovinos',
      'suinos',
      'equinos',
      'caprinos',
      'ovinos',
      'aves',
      'outros'
    );
  END IF;
END $$;

-- 2. TABELA DE REGRAS INTERESTADUAIS
CREATE TABLE IF NOT EXISTS gta_interstate_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_uf CHAR(2) NOT NULL,
  destination_uf CHAR(2) NOT NULL,
  animal_species TEXT,
  allowed BOOLEAN DEFAULT TRUE,
  requires_additional_docs BOOLEAN DEFAULT FALSE,
  additional_docs_list TEXT[],
  notes TEXT,
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_until DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_interstate_rule UNIQUE(origin_uf, destination_uf, animal_species)
);

-- Índices para regras interestaduais
CREATE INDEX IF NOT EXISTS idx_interstate_rules_ufs 
ON gta_interstate_rules(origin_uf, destination_uf);

CREATE INDEX IF NOT EXISTS idx_interstate_rules_active 
ON gta_interstate_rules(is_active) WHERE is_active = TRUE;

-- RLS para regras interestaduais
ALTER TABLE gta_interstate_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica regras interestaduais" ON gta_interstate_rules;
CREATE POLICY "Leitura publica regras interestaduais" 
ON gta_interstate_rules FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Admins gerenciam regras interestaduais" ON gta_interstate_rules;
CREATE POLICY "Admins gerenciam regras interestaduais" 
ON gta_interstate_rules FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. FUNÇÃO DE BLOQUEIO DE TRANSPORTE SEM COMPLIANCE SANITÁRIO
CREATE OR REPLACE FUNCTION block_in_transit_without_sanitary_compliance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se é carga viva (bovinos, suínos, etc)
  IF NEW.cargo_type IN (
    'bovinos', 'suinos', 'equinos', 'caprinos', 
    'ovinos', 'aves', 'carga_viva', 'animais_vivos'
  ) OR NEW.service_type = 'TRANSPORTE_ANIMAIS' THEN
    -- Verificar se status está mudando para IN_TRANSIT, LOADED ou DEPARTED
    IF NEW.status IN ('IN_TRANSIT', 'LOADED', 'DEPARTED') AND 
       (OLD.status IS NULL OR OLD.status NOT IN ('IN_TRANSIT', 'LOADED', 'DEPARTED')) THEN
      -- Verificar compliance válido
      IF NOT EXISTS (
        SELECT 1 
        FROM livestock_freight_compliance lfc
        LEFT JOIN freight_sanitary_documents fsd ON fsd.id = lfc.gta_document_id
        WHERE lfc.freight_id = NEW.id
        AND lfc.compliance_status IN ('approved', 'COMPLIANT')
        AND (fsd.expiry_date IS NULL OR fsd.expiry_date > CURRENT_DATE)
      ) THEN
        RAISE EXCEPTION 'Bloqueio sanitário: conformidade não verificada ou documentação irregular';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger na tabela freights
DROP TRIGGER IF EXISTS trg_block_in_transit_without_sanitary ON freights;
CREATE TRIGGER trg_block_in_transit_without_sanitary
BEFORE UPDATE ON freights
FOR EACH ROW
EXECUTE FUNCTION block_in_transit_without_sanitary_compliance();

-- 4. FUNÇÃO DE EXPIRAÇÃO AUTOMÁTICA DE COMPLIANCE
CREATE OR REPLACE FUNCTION expire_livestock_compliance()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE livestock_freight_compliance lfc
  SET compliance_status = 'expired',
      updated_at = NOW()
  FROM freight_sanitary_documents fsd
  WHERE lfc.gta_document_id = fsd.id
  AND fsd.expiry_date < CURRENT_DATE
  AND lfc.compliance_status IN ('approved', 'pending', 'validating', 'COMPLIANT');
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Função wrapper para cron/edge function
CREATE OR REPLACE FUNCTION run_compliance_expiry_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired INTEGER;
BEGIN
  SELECT expire_livestock_compliance() INTO v_expired;
  
  RETURN jsonb_build_object(
    'success', true,
    'records_expired', v_expired,
    'executed_at', NOW()
  );
END;
$$;

-- 5. VIEW PÚBLICA PARA FISCALIZAÇÃO (SEM METADATA SENSÍVEL)
CREATE OR REPLACE VIEW inspection_qr_public AS
SELECT
  qr_code_hash,
  qr_code_data,
  expires_at,
  is_active,
  generated_at
FROM inspection_qr_codes
WHERE is_active = TRUE
AND expires_at > NOW();

-- Conceder acesso anônimo para fiscais
GRANT SELECT ON inspection_qr_public TO anon;
GRANT SELECT ON inspection_qr_public TO authenticated;

-- 6. SEED DE REGRAS INTERESTADUAIS INICIAIS
INSERT INTO gta_interstate_rules (origin_uf, destination_uf, animal_species, allowed, requires_additional_docs, notes)
VALUES
  ('SC', 'PR', 'bovinos', true, false, 'Zona livre de aftosa sem vacinação - trânsito normal'),
  ('SC', 'RS', 'bovinos', true, false, 'Zona livre de aftosa sem vacinação - trânsito normal'),
  ('PR', 'SC', 'bovinos', true, false, 'Zona livre de aftosa sem vacinação - trânsito normal'),
  ('RS', 'SC', 'bovinos', true, false, 'Zona livre de aftosa sem vacinação - trânsito normal'),
  ('MT', 'SP', 'bovinos', true, true, 'Controle rigoroso - zona com vacinação para zona livre'),
  ('MS', 'SP', 'bovinos', true, true, 'Controle rigoroso - zona com vacinação para zona livre'),
  ('GO', 'SP', 'bovinos', true, true, 'Controle rigoroso - documentação adicional exigida'),
  ('PA', 'AM', 'bovinos', true, true, 'Requer autorização prévia do órgão estadual'),
  ('TO', 'GO', 'bovinos', true, false, 'Trânsito normal entre zonas com vacinação'),
  ('MG', 'SP', 'bovinos', true, false, 'Trânsito normal - áreas limítrofes')
ON CONFLICT ON CONSTRAINT unique_interstate_rule DO NOTHING;

-- 7. FUNÇÃO DE VERIFICAÇÃO DE REGRAS INTERESTADUAIS
CREATE OR REPLACE FUNCTION check_interstate_transit_rules(
  p_origin_uf CHAR(2),
  p_destination_uf CHAR(2),
  p_species TEXT DEFAULT 'bovinos'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
BEGIN
  -- Buscar regra específica ou genérica
  SELECT * INTO v_rule
  FROM gta_interstate_rules
  WHERE origin_uf = UPPER(p_origin_uf)
  AND destination_uf = UPPER(p_destination_uf)
  AND is_active = TRUE
  AND (effective_until IS NULL OR effective_until >= CURRENT_DATE)
  AND (animal_species IS NULL OR animal_species = p_species)
  ORDER BY animal_species NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    -- Sem regra específica, permitir por padrão
    RETURN jsonb_build_object(
      'allowed', true,
      'requires_additional_docs', false,
      'notes', null,
      'rule_found', false
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_rule.allowed,
    'requires_additional_docs', v_rule.requires_additional_docs,
    'additional_docs_list', v_rule.additional_docs_list,
    'notes', v_rule.notes,
    'rule_found', true
  );
END;
$$;
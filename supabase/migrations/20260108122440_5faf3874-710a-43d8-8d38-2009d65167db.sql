
-- =====================================================
-- MÓDULO COMPLIANCE PECUÁRIO - INFRAESTRUTURA DE DADOS
-- =====================================================

-- 1. TABELA: Regras de GTA por Estado (Motor de Regras)
CREATE TABLE public.gta_state_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uf CHAR(2) NOT NULL UNIQUE,
  state_name TEXT NOT NULL,
  requires_gta BOOLEAN DEFAULT TRUE NOT NULL,
  gta_format TEXT NOT NULL CHECK (gta_format IN ('eletronica', 'mista', 'fisica')),
  max_validity_hours INTEGER DEFAULT 48 NOT NULL,
  issuing_agency_code TEXT NOT NULL,
  issuing_agency_name TEXT NOT NULL,
  issuing_agency_url TEXT,
  portal_url TEXT,
  additional_requirements JSONB DEFAULT '[]'::jsonb,
  special_notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. TABELA: Compliance de Frete de Carga Viva
CREATE TABLE public.livestock_freight_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  animal_species TEXT NOT NULL,
  animal_count INTEGER NOT NULL CHECK (animal_count > 0),
  animal_category TEXT,
  animal_breed TEXT,
  origin_property_code TEXT,
  origin_property_name TEXT,
  destination_property_code TEXT,
  destination_property_name TEXT,
  transport_purpose TEXT NOT NULL,
  compliance_status TEXT DEFAULT 'pending' NOT NULL CHECK (compliance_status IN ('pending', 'documents_required', 'validating', 'approved', 'blocked', 'expired')),
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  gta_document_id UUID REFERENCES public.freight_sanitary_documents(id),
  nfe_document_id UUID,
  compliance_checklist JSONB DEFAULT '{}'::jsonb,
  blocking_reasons JSONB DEFAULT '[]'::jsonb,
  fraud_indicators JSONB DEFAULT '[]'::jsonb,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id),
  blocked_at TIMESTAMPTZ,
  blocked_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(freight_id)
);

-- 3. TABELA: Validações OCR de GTA
CREATE TABLE public.gta_ocr_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sanitary_document_id UUID REFERENCES public.freight_sanitary_documents(id) ON DELETE CASCADE,
  livestock_compliance_id UUID REFERENCES public.livestock_freight_compliance(id) ON DELETE CASCADE,
  ocr_raw_text TEXT,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_score NUMERIC(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
  fraud_indicators JSONB DEFAULT '[]'::jsonb,
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  extraction_errors JSONB DEFAULT '[]'::jsonb,
  validated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  validated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. TABELA: Eventos de Auditoria de Compliance (Logs Imutáveis)
CREATE TABLE public.compliance_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID REFERENCES public.freights(id) ON DELETE SET NULL,
  livestock_compliance_id UUID REFERENCES public.livestock_freight_compliance(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL CHECK (event_category IN ('document', 'validation', 'status_change', 'blocking', 'approval', 'inspection', 'fraud_detection', 'system')),
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_state JSONB,
  new_state JSONB,
  actor_id UUID REFERENCES public.profiles(id),
  actor_role TEXT,
  actor_name TEXT,
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  gps_location JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. TABELA: QR Codes para Fiscalização
CREATE TABLE public.inspection_qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  livestock_compliance_id UUID REFERENCES public.livestock_freight_compliance(id) ON DELETE CASCADE,
  qr_code_hash TEXT NOT NULL UNIQUE,
  qr_code_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  access_count INTEGER DEFAULT 0 NOT NULL,
  last_accessed_at TIMESTAMPTZ,
  last_accessed_by_ip INET,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. TABELA: Rascunhos de GTA Assistido
CREATE TABLE public.gta_assisted_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID REFERENCES public.freights(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  origin_uf CHAR(2) NOT NULL,
  destination_uf CHAR(2) NOT NULL,
  animal_species TEXT NOT NULL,
  animal_count INTEGER NOT NULL,
  animal_category TEXT,
  transport_purpose TEXT NOT NULL,
  origin_property_data JSONB DEFAULT '{}'::jsonb,
  destination_property_data JSONB DEFAULT '{}'::jsonb,
  additional_data JSONB DEFAULT '{}'::jsonb,
  redirected_to_portal_at TIMESTAMPTZ,
  portal_url_used TEXT,
  gta_uploaded_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'redirected', 'uploaded', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX idx_gta_state_rules_uf ON public.gta_state_rules(uf);
CREATE INDEX idx_gta_state_rules_active ON public.gta_state_rules(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_livestock_compliance_freight ON public.livestock_freight_compliance(freight_id);
CREATE INDEX idx_livestock_compliance_status ON public.livestock_freight_compliance(compliance_status);
CREATE INDEX idx_livestock_compliance_risk ON public.livestock_freight_compliance(risk_score) WHERE risk_score > 30;

CREATE INDEX idx_gta_ocr_document ON public.gta_ocr_validations(sanitary_document_id);
CREATE INDEX idx_gta_ocr_compliance ON public.gta_ocr_validations(livestock_compliance_id);
CREATE INDEX idx_gta_ocr_confidence ON public.gta_ocr_validations(confidence_score);

CREATE INDEX idx_compliance_audit_freight ON public.compliance_audit_events(freight_id);
CREATE INDEX idx_compliance_audit_type ON public.compliance_audit_events(event_type);
CREATE INDEX idx_compliance_audit_category ON public.compliance_audit_events(event_category);
CREATE INDEX idx_compliance_audit_created ON public.compliance_audit_events(created_at DESC);
CREATE INDEX idx_compliance_audit_actor ON public.compliance_audit_events(actor_id);

CREATE INDEX idx_inspection_qr_freight ON public.inspection_qr_codes(freight_id);
CREATE INDEX idx_inspection_qr_hash ON public.inspection_qr_codes(qr_code_hash);
CREATE INDEX idx_inspection_qr_active ON public.inspection_qr_codes(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_inspection_qr_expires ON public.inspection_qr_codes(expires_at);

CREATE INDEX idx_gta_drafts_freight ON public.gta_assisted_drafts(freight_id);
CREATE INDEX idx_gta_drafts_user ON public.gta_assisted_drafts(user_id);
CREATE INDEX idx_gta_drafts_status ON public.gta_assisted_drafts(status);

-- =====================================================
-- HABILITAR RLS
-- =====================================================

ALTER TABLE public.gta_state_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livestock_freight_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gta_ocr_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gta_assisted_drafts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS RLS
-- =====================================================

-- gta_state_rules: Leitura pública (regras são públicas)
CREATE POLICY "Regras de estado são públicas para leitura"
  ON public.gta_state_rules FOR SELECT
  USING (TRUE);

-- livestock_freight_compliance: Acesso restrito aos envolvidos no frete
CREATE POLICY "Compliance visível para envolvidos no frete"
  ON public.livestock_freight_compliance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.freights f
      WHERE f.id = livestock_freight_compliance.freight_id
      AND (
        f.producer_id = auth.uid()
        OR f.driver_id = auth.uid()
      )
    )
  );

CREATE POLICY "Compliance criável por produtores"
  ON public.livestock_freight_compliance FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.freights f
      WHERE f.id = livestock_freight_compliance.freight_id
      AND f.producer_id = auth.uid()
    )
  );

CREATE POLICY "Compliance editável por produtores"
  ON public.livestock_freight_compliance FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.freights f
      WHERE f.id = livestock_freight_compliance.freight_id
      AND f.producer_id = auth.uid()
    )
  );

-- gta_ocr_validations: Acesso restrito
CREATE POLICY "OCR visível para envolvidos"
  ON public.gta_ocr_validations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.livestock_freight_compliance lfc
      JOIN public.freights f ON f.id = lfc.freight_id
      WHERE lfc.id = gta_ocr_validations.livestock_compliance_id
      AND (
        f.producer_id = auth.uid()
        OR f.driver_id = auth.uid()
      )
    )
  );

CREATE POLICY "OCR criável por usuários autenticados"
  ON public.gta_ocr_validations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- compliance_audit_events: Apenas leitura para envolvidos, insert para sistema
CREATE POLICY "Auditoria visível para envolvidos"
  ON public.compliance_audit_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.freights f
      WHERE f.id = compliance_audit_events.freight_id
      AND (
        f.producer_id = auth.uid()
        OR f.driver_id = auth.uid()
      )
    )
  );

CREATE POLICY "Auditoria criável por usuários autenticados"
  ON public.compliance_audit_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- inspection_qr_codes: Acesso restrito + leitura pública por hash
CREATE POLICY "QR visível para envolvidos"
  ON public.inspection_qr_codes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.freights f
      WHERE f.id = inspection_qr_codes.freight_id
      AND (
        f.producer_id = auth.uid()
        OR f.driver_id = auth.uid()
      )
    )
  );

CREATE POLICY "QR criável por envolvidos"
  ON public.inspection_qr_codes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.freights f
      WHERE f.id = inspection_qr_codes.freight_id
      AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
    )
  );

-- gta_assisted_drafts: Acesso do próprio usuário
CREATE POLICY "Rascunhos visíveis pelo criador"
  ON public.gta_assisted_drafts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Rascunhos criáveis pelo usuário"
  ON public.gta_assisted_drafts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Rascunhos editáveis pelo criador"
  ON public.gta_assisted_drafts FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Rascunhos deletáveis pelo criador"
  ON public.gta_assisted_drafts FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- TRIGGERS PARA UPDATED_AT
-- =====================================================

CREATE TRIGGER update_gta_state_rules_updated_at
  BEFORE UPDATE ON public.gta_state_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_livestock_compliance_updated_at
  BEFORE UPDATE ON public.livestock_freight_compliance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inspection_qr_updated_at
  BEFORE UPDATE ON public.inspection_qr_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gta_drafts_updated_at
  BEFORE UPDATE ON public.gta_assisted_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- SEED: REGRAS DE TODOS OS 27 ESTADOS BRASILEIROS
-- =====================================================

INSERT INTO public.gta_state_rules (uf, state_name, requires_gta, gta_format, max_validity_hours, issuing_agency_code, issuing_agency_name, issuing_agency_url, portal_url, special_notes) VALUES
('AC', 'Acre', TRUE, 'eletronica', 48, 'IDAF', 'Instituto de Defesa Agropecuária e Florestal do Acre', 'https://idaf.ac.gov.br', 'https://www.idaf.ac.gov.br/gta', NULL),
('AL', 'Alagoas', TRUE, 'eletronica', 48, 'ADEAL', 'Agência de Defesa e Inspeção Agropecuária de Alagoas', 'https://adeal.al.gov.br', 'https://www.adeal.al.gov.br/gta', NULL),
('AP', 'Amapá', TRUE, 'mista', 72, 'DIAGRO', 'Departamento de Inspeção e Defesa Agropecuária', 'https://diagro.ap.gov.br', 'https://www.diagro.ap.gov.br/gta', NULL),
('AM', 'Amazonas', TRUE, 'mista', 72, 'ADAF', 'Agência de Defesa Agropecuária e Florestal do Amazonas', 'https://adaf.am.gov.br', 'https://www.adaf.am.gov.br/gta', 'Exige controle sanitário adicional para trânsito fluvial'),
('BA', 'Bahia', TRUE, 'eletronica', 48, 'ADAB', 'Agência Estadual de Defesa Agropecuária da Bahia', 'https://adab.ba.gov.br', 'https://www.adab.ba.gov.br/gta', NULL),
('CE', 'Ceará', TRUE, 'eletronica', 48, 'ADAGRI', 'Agência de Defesa Agropecuária do Ceará', 'https://adagri.ce.gov.br', 'https://www.adagri.ce.gov.br/gta', NULL),
('DF', 'Distrito Federal', TRUE, 'eletronica', 48, 'SEAGRI-DF', 'Secretaria de Agricultura do DF', 'https://agricultura.df.gov.br', 'https://www.agricultura.df.gov.br/gta', NULL),
('ES', 'Espírito Santo', TRUE, 'eletronica', 48, 'IDAF-ES', 'Instituto de Defesa Agropecuária e Florestal do ES', 'https://idaf.es.gov.br', 'https://www.idaf.es.gov.br/gta', NULL),
('GO', 'Goiás', TRUE, 'eletronica', 48, 'AGRODEFESA', 'Agência Goiana de Defesa Agropecuária', 'https://agrodefesa.go.gov.br', 'https://www.agrodefesa.go.gov.br/gta', NULL),
('MA', 'Maranhão', TRUE, 'eletronica', 48, 'AGED', 'Agência Estadual de Defesa Agropecuária do Maranhão', 'https://aged.ma.gov.br', 'https://www.aged.ma.gov.br/gta', NULL),
('MT', 'Mato Grosso', TRUE, 'eletronica', 48, 'INDEA', 'Instituto de Defesa Agropecuária de Mato Grosso', 'https://indea.mt.gov.br', 'https://www.indea.mt.gov.br/gta', 'Maior rebanho bovino do Brasil - controle rigoroso'),
('MS', 'Mato Grosso do Sul', TRUE, 'eletronica', 48, 'IAGRO', 'Agência Estadual de Defesa Sanitária Animal e Vegetal', 'https://iagro.ms.gov.br', 'https://www.iagro.ms.gov.br/gta', NULL),
('MG', 'Minas Gerais', TRUE, 'eletronica', 72, 'IMA', 'Instituto Mineiro de Agropecuária', 'https://ima.mg.gov.br', 'https://www.ima.mg.gov.br/gta', NULL),
('PA', 'Pará', TRUE, 'mista', 48, 'ADEPARA', 'Agência de Defesa Agropecuária do Pará', 'https://adepara.pa.gov.br', 'https://www.adepara.pa.gov.br/gta', 'Exige conferência manual em barreiras sanitárias'),
('PB', 'Paraíba', TRUE, 'eletronica', 48, 'SEDAP', 'Secretaria de Desenvolvimento da Agropecuária e Pesca', 'https://sedap.pb.gov.br', 'https://www.sedap.pb.gov.br/gta', NULL),
('PR', 'Paraná', TRUE, 'eletronica', 48, 'ADAPAR', 'Agência de Defesa Agropecuária do Paraná', 'https://adapar.pr.gov.br', 'https://www.adapar.pr.gov.br/gta', NULL),
('PE', 'Pernambuco', TRUE, 'eletronica', 48, 'ADAGRO', 'Agência de Defesa e Fiscalização Agropecuária de PE', 'https://adagro.pe.gov.br', 'https://www.adagro.pe.gov.br/gta', NULL),
('PI', 'Piauí', TRUE, 'eletronica', 48, 'ADAPI', 'Agência de Defesa Agropecuária do Piauí', 'https://adapi.pi.gov.br', 'https://www.adapi.pi.gov.br/gta', NULL),
('RJ', 'Rio de Janeiro', TRUE, 'eletronica', 48, 'SEAPPA', 'Secretaria de Agricultura, Pecuária, Pesca e Abastecimento', 'https://agricultura.rj.gov.br', 'https://www.agricultura.rj.gov.br/gta', NULL),
('RN', 'Rio Grande do Norte', TRUE, 'eletronica', 48, 'IDIARN', 'Instituto de Defesa e Inspeção Agropecuária do RN', 'https://idiarn.rn.gov.br', 'https://www.idiarn.rn.gov.br/gta', NULL),
('RS', 'Rio Grande do Sul', TRUE, 'eletronica', 48, 'SEAPI', 'Secretaria da Agricultura, Pecuária e Irrigação', 'https://seapi.rs.gov.br', 'https://www.seapi.rs.gov.br/gta', 'Zona livre de febre aftosa sem vacinação'),
('RO', 'Rondônia', TRUE, 'eletronica', 48, 'IDARON', 'Agência de Defesa Sanitária Agrossilvopastoril de RO', 'https://idaron.ro.gov.br', 'https://www.idaron.ro.gov.br/gta', NULL),
('RR', 'Roraima', TRUE, 'mista', 72, 'ADERR', 'Agência de Defesa Agropecuária de Roraima', 'https://aderr.rr.gov.br', 'https://www.aderr.rr.gov.br/gta', NULL),
('SC', 'Santa Catarina', TRUE, 'eletronica', 48, 'CIDASC', 'Companhia Integrada de Desenvolvimento Agrícola de SC', 'https://cidasc.sc.gov.br', 'https://www.cidasc.sc.gov.br/gta', 'Zona livre de febre aftosa sem vacinação'),
('SP', 'São Paulo', TRUE, 'eletronica', 48, 'CDA', 'Coordenadoria de Defesa Agropecuária', 'https://defesaagropecuaria.sp.gov.br', 'https://www.defesaagropecuaria.sp.gov.br/gta', NULL),
('SE', 'Sergipe', TRUE, 'eletronica', 48, 'EMDAGRO', 'Empresa de Desenvolvimento Agropecuário de Sergipe', 'https://emdagro.se.gov.br', 'https://www.emdagro.se.gov.br/gta', NULL),
('TO', 'Tocantins', TRUE, 'eletronica', 48, 'ADAPEC', 'Agência de Defesa Agropecuária do Tocantins', 'https://adapec.to.gov.br', 'https://www.adapec.to.gov.br/gta', NULL);

-- =====================================================
-- FUNÇÃO: Registrar evento de auditoria
-- =====================================================

CREATE OR REPLACE FUNCTION public.log_compliance_event(
  p_freight_id UUID,
  p_livestock_compliance_id UUID,
  p_event_type TEXT,
  p_event_category TEXT,
  p_event_data JSONB DEFAULT '{}'::jsonb,
  p_previous_state JSONB DEFAULT NULL,
  p_new_state JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_actor_role TEXT;
  v_actor_name TEXT;
BEGIN
  -- Buscar role e nome do ator
  SELECT role::text, full_name INTO v_actor_role, v_actor_name
  FROM public.profiles
  WHERE id = auth.uid();

  INSERT INTO public.compliance_audit_events (
    freight_id,
    livestock_compliance_id,
    event_type,
    event_category,
    event_data,
    previous_state,
    new_state,
    actor_id,
    actor_role,
    actor_name
  ) VALUES (
    p_freight_id,
    p_livestock_compliance_id,
    p_event_type,
    p_event_category,
    p_event_data,
    p_previous_state,
    p_new_state,
    auth.uid(),
    v_actor_role,
    v_actor_name
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- =====================================================
-- FUNÇÃO: Verificar compliance de frete bovino
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_livestock_compliance(p_freight_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compliance RECORD;
  v_gta_doc RECORD;
  v_issues JSONB := '[]'::jsonb;
  v_status TEXT := 'approved';
  v_risk_score INTEGER := 0;
BEGIN
  -- Buscar compliance do frete
  SELECT * INTO v_compliance
  FROM public.livestock_freight_compliance
  WHERE freight_id = p_freight_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'not_found',
      'message', 'Compliance não encontrado para este frete'
    );
  END IF;

  -- Verificar se tem GTA
  IF v_compliance.gta_document_id IS NULL THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'type', 'missing_gta',
      'severity', 'blocking',
      'message', 'GTA não anexada'
    ));
    v_status := 'blocked';
    v_risk_score := v_risk_score + 50;
  ELSE
    -- Verificar documento GTA
    SELECT * INTO v_gta_doc
    FROM public.freight_sanitary_documents
    WHERE id = v_compliance.gta_document_id;

    IF v_gta_doc.is_valid = FALSE THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'type', 'invalid_gta',
        'severity', 'blocking',
        'message', 'GTA marcada como inválida'
      ));
      v_status := 'blocked';
      v_risk_score := v_risk_score + 40;
    END IF;

    IF v_gta_doc.expires_at IS NOT NULL AND v_gta_doc.expires_at < NOW() THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'type', 'expired_gta',
        'severity', 'blocking',
        'message', 'GTA vencida'
      ));
      v_status := 'blocked';
      v_risk_score := v_risk_score + 50;
    END IF;
  END IF;

  -- Verificar NF-e
  IF v_compliance.nfe_document_id IS NULL THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'type', 'missing_nfe',
      'severity', 'warning',
      'message', 'NF-e não anexada'
    ));
    IF v_status != 'blocked' THEN
      v_status := 'pending';
    END IF;
    v_risk_score := v_risk_score + 20;
  END IF;

  -- Atualizar compliance
  UPDATE public.livestock_freight_compliance
  SET 
    compliance_status = v_status,
    risk_score = LEAST(v_risk_score, 100),
    blocking_reasons = v_issues,
    updated_at = NOW()
  WHERE id = v_compliance.id;

  RETURN jsonb_build_object(
    'status', v_status,
    'risk_score', LEAST(v_risk_score, 100),
    'issues', v_issues,
    'compliance_id', v_compliance.id
  );
END;
$$;

-- =====================================================================
-- MOTOR FISCAL CT-e + ANTIFRAUDE - AGRIROUTE
-- Tabelas, índices, políticas RLS e funções SQL
-- =====================================================================

-- 1. TABELA: empresas_fiscais (Onboarding fiscal de empresas)
CREATE TABLE IF NOT EXISTS public.empresas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transport_company_id UUID REFERENCES public.transport_companies(id) ON DELETE CASCADE,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT NOT NULL,
  inscricao_estadual TEXT,
  uf TEXT NOT NULL,
  municipio TEXT NOT NULL,
  municipio_ibge TEXT NOT NULL,
  endereco_logradouro TEXT,
  endereco_numero TEXT,
  endereco_bairro TEXT,
  endereco_cep TEXT,
  rntrc TEXT,
  ambiente_fiscal TEXT DEFAULT 'homologacao' CHECK (ambiente_fiscal IN ('homologacao', 'producao')),
  onboarding_completo BOOLEAN DEFAULT FALSE,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT empresas_fiscais_cnpj_unique UNIQUE (cnpj)
);

-- 2. TABELA: ctes (CT-e modelo 57)
CREATE TABLE IF NOT EXISTS public.ctes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas_fiscais(id) ON DELETE CASCADE,
  frete_id UUID REFERENCES public.freights(id) ON DELETE CASCADE,
  referencia TEXT NOT NULL,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'processando', 'autorizado', 'cancelado', 'erro', 'rejeitado')),
  chave TEXT,
  numero TEXT,
  serie TEXT DEFAULT '1',
  modelo TEXT DEFAULT '57',
  ambiente TEXT DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao', 'producao')),
  xml_url TEXT,
  dacte_url TEXT,
  payload_envio JSONB NOT NULL,
  resposta_sefaz JSONB,
  mensagem_erro TEXT,
  tentativas INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  authorized_at TIMESTAMPTZ,
  CONSTRAINT ctes_referencia_unique UNIQUE (referencia)
);

-- 3. TABELA: auditoria_eventos (Motor antifraude)
CREATE TABLE IF NOT EXISTS public.auditoria_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas_fiscais(id) ON DELETE SET NULL,
  frete_id UUID REFERENCES public.freights(id) ON DELETE CASCADE,
  codigo_regra TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('rota_incoerente', 'cte_sem_mdfe', 'parada_suspeita', 'valor_anomalo', 'documento_invalido', 'emissao_proxima_abordagem', 'velocidade_anomala', 'desvio_rota')),
  severidade TEXT NOT NULL CHECK (severidade IN ('baixa', 'media', 'alta', 'critica')),
  descricao TEXT NOT NULL,
  evidencias JSONB,
  resolvido BOOLEAN DEFAULT FALSE,
  resolvido_por UUID REFERENCES public.profiles(id),
  resolvido_at TIMESTAMPTZ,
  notas_resolucao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA: fiscalizacao_logs (Auditoria de consultas PRF)
CREATE TABLE IF NOT EXISTS public.fiscalizacao_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placa TEXT NOT NULL,
  freight_id UUID REFERENCES public.freights(id),
  ip_address INET,
  user_agent TEXT,
  response_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_empresas_fiscais_transport_company ON public.empresas_fiscais(transport_company_id);
CREATE INDEX IF NOT EXISTS idx_empresas_fiscais_cnpj ON public.empresas_fiscais(cnpj);
CREATE INDEX IF NOT EXISTS idx_empresas_fiscais_uf ON public.empresas_fiscais(uf);

CREATE INDEX IF NOT EXISTS idx_ctes_empresa ON public.ctes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ctes_frete ON public.ctes(frete_id);
CREATE INDEX IF NOT EXISTS idx_ctes_status ON public.ctes(status);
CREATE INDEX IF NOT EXISTS idx_ctes_chave ON public.ctes(chave);
CREATE INDEX IF NOT EXISTS idx_ctes_referencia ON public.ctes(referencia);
CREATE INDEX IF NOT EXISTS idx_ctes_created_at ON public.ctes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_empresa ON public.auditoria_eventos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_frete ON public.auditoria_eventos(frete_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_tipo ON public.auditoria_eventos(tipo);
CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_severidade ON public.auditoria_eventos(severidade);
CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_created_at ON public.auditoria_eventos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_resolvido ON public.auditoria_eventos(resolvido) WHERE resolvido = FALSE;

CREATE INDEX IF NOT EXISTS idx_fiscalizacao_logs_placa ON public.fiscalizacao_logs(placa);
CREATE INDEX IF NOT EXISTS idx_fiscalizacao_logs_created_at ON public.fiscalizacao_logs(created_at DESC);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE public.empresas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ctes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscalizacao_logs ENABLE ROW LEVEL SECURITY;

-- Políticas empresas_fiscais (usando role TRANSPORTADORA)
CREATE POLICY "empresas_fiscais_select" ON public.empresas_fiscais
FOR SELECT USING (
  transport_company_id IN (
    SELECT id FROM public.transport_companies WHERE profile_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'TRANSPORTADORA'
  )
);

CREATE POLICY "empresas_fiscais_insert" ON public.empresas_fiscais
FOR INSERT WITH CHECK (
  transport_company_id IN (
    SELECT id FROM public.transport_companies WHERE profile_id = auth.uid()
  )
);

CREATE POLICY "empresas_fiscais_update" ON public.empresas_fiscais
FOR UPDATE USING (
  transport_company_id IN (
    SELECT id FROM public.transport_companies WHERE profile_id = auth.uid()
  )
);

-- Políticas ctes
CREATE POLICY "ctes_select" ON public.ctes
FOR SELECT USING (
  empresa_id IN (
    SELECT ef.id FROM public.empresas_fiscais ef
    JOIN public.transport_companies tc ON tc.id = ef.transport_company_id
    WHERE tc.profile_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'TRANSPORTADORA'
  )
);

CREATE POLICY "ctes_insert" ON public.ctes
FOR INSERT WITH CHECK (
  empresa_id IN (
    SELECT ef.id FROM public.empresas_fiscais ef
    JOIN public.transport_companies tc ON tc.id = ef.transport_company_id
    WHERE tc.profile_id = auth.uid()
  )
);

CREATE POLICY "ctes_update" ON public.ctes
FOR UPDATE USING (
  empresa_id IN (
    SELECT ef.id FROM public.empresas_fiscais ef
    JOIN public.transport_companies tc ON tc.id = ef.transport_company_id
    WHERE tc.profile_id = auth.uid()
  )
);

-- Políticas auditoria_eventos (transportadora + empresa owner)
CREATE POLICY "auditoria_eventos_select" ON public.auditoria_eventos
FOR SELECT USING (
  empresa_id IN (
    SELECT ef.id FROM public.empresas_fiscais ef
    JOIN public.transport_companies tc ON tc.id = ef.transport_company_id
    WHERE tc.profile_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'TRANSPORTADORA'
  )
);

CREATE POLICY "auditoria_eventos_insert_system" ON public.auditoria_eventos
FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "auditoria_eventos_update" ON public.auditoria_eventos
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'TRANSPORTADORA'
  )
  OR empresa_id IN (
    SELECT ef.id FROM public.empresas_fiscais ef
    JOIN public.transport_companies tc ON tc.id = ef.transport_company_id
    WHERE tc.profile_id = auth.uid()
  )
);

-- Políticas fiscalizacao_logs (somente transportadora lê, sistema insere)
CREATE POLICY "fiscalizacao_logs_select_transportadora" ON public.fiscalizacao_logs
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'TRANSPORTADORA')
);

CREATE POLICY "fiscalizacao_logs_insert_system" ON public.fiscalizacao_logs
FOR INSERT WITH CHECK (TRUE);

-- =====================================================================
-- FUNÇÕES SQL: MOTOR ANTIFRAUDE
-- =====================================================================

-- Função principal: Executar regras antifraude para um frete
CREATE OR REPLACE FUNCTION public.run_antifraud_rules(p_freight_id UUID)
RETURNS TABLE (
  alerts_created INTEGER,
  risk_score NUMERIC
) AS $$
DECLARE
  v_freight RECORD;
  v_cte RECORD;
  v_mdfe RECORD;
  v_empresa RECORD;
  v_alerts INTEGER := 0;
  v_risk NUMERIC := 0;
BEGIN
  -- Buscar frete
  SELECT * INTO v_freight FROM public.freights WHERE id = p_freight_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0::NUMERIC;
    RETURN;
  END IF;

  -- Buscar CT-e mais recente
  SELECT c.*, ef.id as empresa_fiscal_id 
  INTO v_cte 
  FROM public.ctes c
  JOIN public.empresas_fiscais ef ON ef.id = c.empresa_id
  WHERE c.frete_id = p_freight_id 
  ORDER BY c.created_at DESC LIMIT 1;

  -- Buscar MDF-e
  SELECT * INTO v_mdfe FROM public.mdfe_manifestos WHERE freight_id = p_freight_id LIMIT 1;

  -- =========================================
  -- REGRA AF001: CT-e sem MDF-e após 30 minutos
  -- =========================================
  IF v_cte IS NOT NULL 
     AND v_cte.status = 'autorizado' 
     AND v_cte.authorized_at IS NOT NULL
     AND v_mdfe IS NULL 
     AND v_cte.authorized_at < NOW() - INTERVAL '30 minutes' 
  THEN
    INSERT INTO public.auditoria_eventos (empresa_id, frete_id, codigo_regra, tipo, severidade, descricao, evidencias)
    VALUES (
      v_cte.empresa_fiscal_id, 
      p_freight_id, 
      'AF001',
      'cte_sem_mdfe', 
      'alta', 
      'CT-e autorizado há mais de 30 minutos sem MDF-e vinculado. Isso pode indicar viagem irregular.',
      jsonb_build_object(
        'cte_chave', v_cte.chave,
        'cte_authorized_at', v_cte.authorized_at,
        'minutos_sem_mdfe', EXTRACT(EPOCH FROM (NOW() - v_cte.authorized_at)) / 60
      )
    )
    ON CONFLICT DO NOTHING;
    v_alerts := v_alerts + 1;
    v_risk := v_risk + 25;
  END IF;

  -- =========================================
  -- REGRA AF002: Valor frete > 50% da carga
  -- =========================================
  IF v_freight.price IS NOT NULL 
     AND v_freight.cargo_value IS NOT NULL
     AND v_freight.cargo_value > 0
     AND (v_freight.price::NUMERIC / v_freight.cargo_value::NUMERIC) > 0.5
  THEN
    INSERT INTO public.auditoria_eventos (empresa_id, frete_id, codigo_regra, tipo, severidade, descricao, evidencias)
    VALUES (
      v_cte.empresa_fiscal_id, 
      p_freight_id, 
      'AF002',
      'valor_anomalo', 
      'media',
      'Valor do frete superior a 50% do valor da carga. Possível superfaturamento.',
      jsonb_build_object(
        'valor_frete', v_freight.price,
        'valor_carga', v_freight.cargo_value,
        'percentual', ROUND((v_freight.price::NUMERIC / v_freight.cargo_value::NUMERIC) * 100, 2)
      )
    )
    ON CONFLICT DO NOTHING;
    v_alerts := v_alerts + 1;
    v_risk := v_risk + 15;
  END IF;

  -- =========================================
  -- REGRA AF003: UF incoerente na rota
  -- =========================================
  IF v_freight.origin_state IS NOT NULL 
     AND v_freight.destination_state IS NOT NULL
     AND v_freight.origin_state != v_freight.destination_state
  THEN
    -- Verificar se há paradas em UFs fora da rota esperada
    IF EXISTS (
      SELECT 1 FROM public.freight_stops fs
      WHERE fs.freight_id = p_freight_id
      AND fs.location_state IS NOT NULL
      AND fs.location_state NOT IN (v_freight.origin_state, v_freight.destination_state)
      AND fs.stop_type = 'suspicious'
    ) THEN
      INSERT INTO public.auditoria_eventos (empresa_id, frete_id, codigo_regra, tipo, severidade, descricao, evidencias)
      VALUES (
        v_cte.empresa_fiscal_id, 
        p_freight_id, 
        'AF003',
        'rota_incoerente', 
        'alta',
        'Parada detectada em UF fora da rota origem-destino declarada.',
        jsonb_build_object(
          'origem_uf', v_freight.origin_state,
          'destino_uf', v_freight.destination_state
        )
      )
      ON CONFLICT DO NOTHING;
      v_alerts := v_alerts + 1;
      v_risk := v_risk + 30;
    END IF;
  END IF;

  -- =========================================
  -- REGRA AF004: Documento ausente/inválido
  -- =========================================
  IF v_freight.nfe_access_key IS NULL OR LENGTH(v_freight.nfe_access_key) != 44 THEN
    INSERT INTO public.auditoria_eventos (empresa_id, frete_id, codigo_regra, tipo, severidade, descricao, evidencias)
    VALUES (
      v_cte.empresa_fiscal_id, 
      p_freight_id, 
      'AF004',
      'documento_invalido', 
      'critica',
      'Chave de NF-e ausente ou inválida (deve ter 44 dígitos).',
      jsonb_build_object(
        'chave_informada', COALESCE(v_freight.nfe_access_key, 'NULL'),
        'tamanho', COALESCE(LENGTH(v_freight.nfe_access_key), 0)
      )
    )
    ON CONFLICT DO NOTHING;
    v_alerts := v_alerts + 1;
    v_risk := v_risk + 40;
  END IF;

  -- =========================================
  -- REGRA AF005: Emissão muito recente (< 1h antes de abordagem)
  -- =========================================
  IF v_cte IS NOT NULL 
     AND v_cte.authorized_at IS NOT NULL
     AND v_cte.authorized_at > NOW() - INTERVAL '1 hour'
  THEN
    INSERT INTO public.auditoria_eventos (empresa_id, frete_id, codigo_regra, tipo, severidade, descricao, evidencias)
    VALUES (
      v_cte.empresa_fiscal_id, 
      p_freight_id, 
      'AF005',
      'emissao_proxima_abordagem', 
      'media',
      'CT-e emitido há menos de 1 hora. Pode indicar emissão após início da viagem.',
      jsonb_build_object(
        'cte_authorized_at', v_cte.authorized_at,
        'minutos_desde_emissao', EXTRACT(EPOCH FROM (NOW() - v_cte.authorized_at)) / 60
      )
    )
    ON CONFLICT DO NOTHING;
    v_alerts := v_alerts + 1;
    v_risk := v_risk + 15;
  END IF;

  -- =========================================
  -- REGRA AF006: Parada suspeita não autorizada
  -- =========================================
  IF EXISTS (
    SELECT 1 FROM public.freight_stops
    WHERE freight_id = p_freight_id
    AND stop_type IN ('suspicious', 'critical')
    AND NOT authorized
  ) THEN
    INSERT INTO public.auditoria_eventos (empresa_id, frete_id, codigo_regra, tipo, severidade, descricao, evidencias)
    SELECT 
      v_cte.empresa_fiscal_id,
      p_freight_id,
      'AF006',
      'parada_suspeita',
      CASE WHEN fs.stop_type = 'critical' THEN 'critica' ELSE 'alta' END,
      'Parada suspeita detectada: ' || COALESCE(fs.location_address, 'local desconhecido'),
      jsonb_build_object(
        'stop_id', fs.id,
        'duration_minutes', fs.duration_minutes,
        'location', jsonb_build_object('lat', fs.lat, 'lng', fs.lng)
      )
    FROM public.freight_stops fs
    WHERE fs.freight_id = p_freight_id
    AND fs.stop_type IN ('suspicious', 'critical')
    AND NOT fs.authorized
    LIMIT 5
    ON CONFLICT DO NOTHING;
    v_alerts := v_alerts + 1;
    v_risk := v_risk + 35;
  END IF;

  -- Atualizar risk_score no frete
  UPDATE public.freights 
  SET risk_score = LEAST(v_risk, 100)
  WHERE id = p_freight_id;

  RETURN QUERY SELECT v_alerts, LEAST(v_risk, 100)::NUMERIC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função: Obter dados para fiscalização (endpoint PRF)
CREATE OR REPLACE FUNCTION public.get_fiscalizacao_data(p_placa TEXT)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_freight RECORD;
  v_cte RECORD;
  v_mdfe RECORD;
  v_alerts JSONB;
BEGIN
  -- Buscar frete ativo com esta placa
  SELECT f.* INTO v_freight
  FROM public.freights f
  WHERE f.vehicle_plate = UPPER(TRIM(p_placa))
  AND f.status IN ('accepted', 'in_transit', 'loading', 'unloading')
  ORDER BY f.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'found', false,
      'message', 'Nenhum frete ativo encontrado para esta placa'
    );
  END IF;

  -- Buscar CT-e
  SELECT * INTO v_cte
  FROM public.ctes
  WHERE frete_id = v_freight.id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Buscar MDF-e
  SELECT * INTO v_mdfe
  FROM public.mdfe_manifestos
  WHERE freight_id = v_freight.id
  AND status = 'autorizado'
  LIMIT 1;

  -- Buscar alertas ativos (sem dados sensíveis)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'tipo', ae.tipo,
      'severidade', ae.severidade,
      'descricao', ae.descricao
    )
  ), '[]'::jsonb) INTO v_alerts
  FROM public.auditoria_eventos ae
  WHERE ae.frete_id = v_freight.id
  AND ae.resolvido = FALSE;

  -- Montar resposta (SEM dados sensíveis)
  v_result := jsonb_build_object(
    'found', true,
    'placa', v_freight.vehicle_plate,
    'status_viagem', v_freight.status,
    'origem', jsonb_build_object(
      'cidade', v_freight.origin_city,
      'uf', v_freight.origin_state
    ),
    'destino', jsonb_build_object(
      'cidade', v_freight.destination_city,
      'uf', v_freight.destination_state
    ),
    'cte', CASE 
      WHEN v_cte IS NOT NULL THEN jsonb_build_object(
        'status', v_cte.status,
        'chave', v_cte.chave,
        'autorizado_em', v_cte.authorized_at
      )
      ELSE NULL
    END,
    'mdfe', CASE 
      WHEN v_mdfe IS NOT NULL THEN jsonb_build_object(
        'status', v_mdfe.status,
        'chave', v_mdfe.chave_acesso
      )
      ELSE NULL
    END,
    'risk_score', COALESCE(v_freight.risk_score, 0),
    'alertas', v_alerts,
    'motorista_nome', COALESCE(
      (SELECT p.full_name FROM public.profiles p WHERE p.id = v_freight.driver_id),
      'Não informado'
    ),
    'carga_tipo', v_freight.cargo_type
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função: Calcular KPIs de compliance por empresa
CREATE OR REPLACE FUNCTION public.get_compliance_kpis(p_empresa_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH stats AS (
    SELECT
      COUNT(DISTINCT f.id) as total_fretes,
      COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'autorizado') as ctes_autorizados,
      COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'autorizado') as mdfes_autorizados,
      COUNT(DISTINCT ae.id) as total_alertas,
      COUNT(DISTINCT ae.id) FILTER (WHERE ae.severidade = 'critica') as alertas_criticos,
      COUNT(DISTINCT ae.id) FILTER (WHERE ae.resolvido = TRUE) as alertas_resolvidos,
      AVG(EXTRACT(EPOCH FROM (m.authorized_at - c.authorized_at)) / 60) 
        FILTER (WHERE c.authorized_at IS NOT NULL AND m.authorized_at IS NOT NULL) as tempo_medio_cte_mdfe
    FROM public.freights f
    LEFT JOIN public.ctes c ON c.frete_id = f.id
    LEFT JOIN public.mdfe_manifestos m ON m.freight_id = f.id
    LEFT JOIN public.auditoria_eventos ae ON ae.frete_id = f.id
    WHERE (p_empresa_id IS NULL OR c.empresa_id = p_empresa_id)
    AND f.created_at > NOW() - INTERVAL '30 days'
  )
  SELECT jsonb_build_object(
    'total_fretes', COALESCE(total_fretes, 0),
    'ctes_autorizados', COALESCE(ctes_autorizados, 0),
    'mdfes_autorizados', COALESCE(mdfes_autorizados, 0),
    'taxa_compliance', CASE 
      WHEN total_fretes > 0 THEN ROUND((ctes_autorizados::NUMERIC / total_fretes) * 100, 1)
      ELSE 0
    END,
    'total_alertas', COALESCE(total_alertas, 0),
    'alertas_criticos', COALESCE(alertas_criticos, 0),
    'alertas_resolvidos', COALESCE(alertas_resolvidos, 0),
    'taxa_resolucao', CASE 
      WHEN total_alertas > 0 THEN ROUND((alertas_resolvidos::NUMERIC / total_alertas) * 100, 1)
      ELSE 100
    END,
    'tempo_medio_cte_mdfe_minutos', COALESCE(ROUND(tempo_medio_cte_mdfe::NUMERIC, 1), 0)
  ) INTO v_result
  FROM stats;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: Atualizar updated_at em empresas_fiscais
CREATE OR REPLACE FUNCTION public.update_empresas_fiscais_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_empresas_fiscais_updated_at ON public.empresas_fiscais;
CREATE TRIGGER trigger_empresas_fiscais_updated_at
  BEFORE UPDATE ON public.empresas_fiscais
  FOR EACH ROW
  EXECUTE FUNCTION public.update_empresas_fiscais_updated_at();

-- Trigger: Atualizar updated_at em ctes
CREATE OR REPLACE FUNCTION public.update_ctes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ctes_updated_at ON public.ctes;
CREATE TRIGGER trigger_ctes_updated_at
  BEFORE UPDATE ON public.ctes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ctes_updated_at();

-- Trigger: Executar antifraude automaticamente quando CT-e é autorizado
CREATE OR REPLACE FUNCTION public.trigger_antifraud_on_cte_authorized()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'autorizado' AND (OLD.status IS NULL OR OLD.status != 'autorizado') THEN
    PERFORM public.run_antifraud_rules(NEW.frete_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_run_antifraud_on_cte ON public.ctes;
CREATE TRIGGER trigger_run_antifraud_on_cte
  AFTER UPDATE ON public.ctes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_antifraud_on_cte_authorized();
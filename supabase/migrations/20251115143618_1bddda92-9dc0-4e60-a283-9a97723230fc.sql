-- ====================================
-- SISTEMA MDFE - MANIFESTO ELETRÔNICO
-- ====================================

-- ENUMS
CREATE TYPE mdfe_emitter_type AS ENUM ('PRODUCER', 'DRIVER', 'COMPANY');
CREATE TYPE mdfe_status AS ENUM ('PENDENTE', 'AUTORIZADO', 'ENCERRADO', 'CANCELADO', 'CONTINGENCIA');
CREATE TYPE mdfe_modo_emissao AS ENUM ('NORMAL', 'CONTINGENCIA_FSDA');
CREATE TYPE mdfe_documento_tipo AS ENUM ('NFE', 'CTE', 'NFCE');
CREATE TYPE mdfe_tipo_proprietario AS ENUM ('PROPRIO', 'TERCEIRO');

-- 1. TABELA PRINCIPAL: mdfe_manifestos
CREATE TABLE IF NOT EXISTS mdfe_manifestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES freights(id) ON DELETE CASCADE,
  emitted_by_id UUID NOT NULL REFERENCES profiles(id),
  emitter_type mdfe_emitter_type NOT NULL,
  company_id UUID REFERENCES transport_companies(id),
  numero_mdfe TEXT NOT NULL,
  serie TEXT NOT NULL DEFAULT '1',
  chave_acesso TEXT NOT NULL UNIQUE,
  cne_test TEXT DEFAULT '7120-1/00',
  protocolo_autorizacao TEXT,
  xml_assinado TEXT,
  xml_contingencia TEXT,
  status mdfe_status NOT NULL DEFAULT 'PENDENTE',
  modo_emissao mdfe_modo_emissao NOT NULL DEFAULT 'NORMAL',
  data_emissao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_autorizacao TIMESTAMPTZ,
  data_encerramento TIMESTAMPTZ,
  uf_inicio TEXT NOT NULL,
  uf_fim TEXT NOT NULL,
  municipio_carregamento_codigo TEXT NOT NULL,
  municipio_carregamento_nome TEXT NOT NULL,
  municipio_descarregamento_codigo TEXT NOT NULL,
  municipio_descarregamento_nome TEXT NOT NULL,
  peso_bruto_kg NUMERIC NOT NULL,
  valor_carga NUMERIC NOT NULL,
  dacte_url TEXT,
  observacoes TEXT,
  motivo_cancelamento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CONDUTORES
CREATE TABLE IF NOT EXISTS mdfe_condutores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mdfe_id UUID NOT NULL REFERENCES mdfe_manifestos(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES profiles(id),
  cpf TEXT NOT NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. VEÍCULOS
CREATE TABLE IF NOT EXISTS mdfe_veiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mdfe_id UUID NOT NULL REFERENCES mdfe_manifestos(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id),
  placa TEXT NOT NULL,
  renavam TEXT NOT NULL,
  tara INTEGER NOT NULL,
  capacidade_kg INTEGER NOT NULL,
  tipo_rodado TEXT NOT NULL,
  tipo_carroceria TEXT NOT NULL,
  tipo_proprietario mdfe_tipo_proprietario NOT NULL DEFAULT 'PROPRIO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. DOCUMENTOS FISCAIS
CREATE TABLE IF NOT EXISTS mdfe_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mdfe_id UUID NOT NULL REFERENCES mdfe_manifestos(id) ON DELETE CASCADE,
  tipo_documento mdfe_documento_tipo NOT NULL,
  chave_acesso TEXT NOT NULL,
  numero_documento TEXT NOT NULL,
  serie_documento TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  peso_kg NUMERIC,
  unidade_medida TEXT,
  tipo_unidade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. LOGS DE AUDITORIA
CREATE TABLE IF NOT EXISTS mdfe_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mdfe_id UUID NOT NULL REFERENCES mdfe_manifestos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  tipo_operacao TEXT NOT NULL,
  status_code TEXT,
  mensagem_sefaz TEXT,
  xml_enviado TEXT,
  xml_resposta TEXT,
  sucesso BOOLEAN NOT NULL DEFAULT TRUE,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. CONFIGURAÇÕES DE EMISSÃO
CREATE TABLE IF NOT EXISTS mdfe_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES transport_companies(id),
  user_id UUID REFERENCES profiles(id),
  auto_emit_on_acceptance BOOLEAN NOT NULL DEFAULT FALSE,
  auto_close_on_delivery BOOLEAN NOT NULL DEFAULT FALSE,
  serie_mdfe TEXT NOT NULL DEFAULT '1',
  ultimo_numero_mdfe INTEGER NOT NULL DEFAULT 0,
  cnpj TEXT,
  inscricao_estadual TEXT,
  rntrc TEXT,
  razao_social TEXT,
  nome_fantasia TEXT,
  logradouro TEXT,
  numero TEXT,
  bairro TEXT,
  municipio_codigo TEXT,
  municipio_nome TEXT,
  uf TEXT,
  cep TEXT,
  telefone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mdfe_config_unique_entity CHECK (
    (company_id IS NOT NULL AND user_id IS NULL) OR 
    (company_id IS NULL AND user_id IS NOT NULL)
  )
);

-- ÍNDICES
CREATE INDEX idx_mdfe_manifestos_freight ON mdfe_manifestos(freight_id);
CREATE INDEX idx_mdfe_manifestos_emitter ON mdfe_manifestos(emitted_by_id);
CREATE INDEX idx_mdfe_manifestos_status ON mdfe_manifestos(status);
CREATE INDEX idx_mdfe_manifestos_chave ON mdfe_manifestos(chave_acesso);
CREATE INDEX idx_mdfe_condutores_mdfe ON mdfe_condutores(mdfe_id);
CREATE INDEX idx_mdfe_veiculos_mdfe ON mdfe_veiculos(mdfe_id);
CREATE INDEX idx_mdfe_documentos_mdfe ON mdfe_documentos(mdfe_id);
CREATE INDEX idx_mdfe_logs_mdfe ON mdfe_logs(mdfe_id);
CREATE INDEX idx_mdfe_config_company ON mdfe_config(company_id);
CREATE INDEX idx_mdfe_config_user ON mdfe_config(user_id);

-- TRIGGER: Updated_at
CREATE OR REPLACE FUNCTION update_mdfe_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mdfe_manifestos_updated_at
  BEFORE UPDATE ON mdfe_manifestos
  FOR EACH ROW
  EXECUTE FUNCTION update_mdfe_updated_at();

CREATE TRIGGER trigger_mdfe_config_updated_at
  BEFORE UPDATE ON mdfe_config
  FOR EACH ROW
  EXECUTE FUNCTION update_mdfe_updated_at();

-- RLS POLICIES
ALTER TABLE mdfe_manifestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mdfe_condutores ENABLE ROW LEVEL SECURITY;
ALTER TABLE mdfe_veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mdfe_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mdfe_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mdfe_config ENABLE ROW LEVEL SECURITY;

-- mdfe_manifestos: Leitura para envolvidos no frete
CREATE POLICY mdfe_manifestos_select ON mdfe_manifestos
  FOR SELECT
  USING (
    emitted_by_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM freights f
      WHERE f.id = freight_id
      AND (
        f.producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR f.driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    )
    OR EXISTS (
      SELECT 1 FROM transport_companies tc
      WHERE tc.id = company_id
      AND tc.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    OR is_admin()
  );

-- mdfe_manifestos: Inserção apenas se envolvido no frete
CREATE POLICY mdfe_manifestos_insert ON mdfe_manifestos
  FOR INSERT
  WITH CHECK (
    emitted_by_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM freights f
      WHERE f.id = freight_id
      AND (
        f.producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR f.driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR f.company_id = mdfe_manifestos.company_id
      )
    )
  );

-- mdfe_manifestos: Atualização apenas pelo emitente
CREATE POLICY mdfe_manifestos_update ON mdfe_manifestos
  FOR UPDATE
  USING (
    emitted_by_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR is_admin()
  );

-- Políticas para tabelas relacionadas (herdam acesso do manifesto)
CREATE POLICY mdfe_condutores_all ON mdfe_condutores
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mdfe_manifestos m
      WHERE m.id = mdfe_condutores.mdfe_id
      AND (
        m.emitted_by_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM freights f
          WHERE f.id = m.freight_id
          AND (
            f.producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
            OR f.driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
          )
        )
        OR is_admin()
      )
    )
  );

CREATE POLICY mdfe_veiculos_all ON mdfe_veiculos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mdfe_manifestos m
      WHERE m.id = mdfe_veiculos.mdfe_id
      AND (
        m.emitted_by_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM freights f
          WHERE f.id = m.freight_id
          AND (
            f.producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
            OR f.driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
          )
        )
        OR is_admin()
      )
    )
  );

CREATE POLICY mdfe_documentos_all ON mdfe_documentos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mdfe_manifestos m
      WHERE m.id = mdfe_documentos.mdfe_id
      AND (
        m.emitted_by_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM freights f
          WHERE f.id = m.freight_id
          AND (
            f.producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
            OR f.driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
          )
        )
        OR is_admin()
      )
    )
  );

CREATE POLICY mdfe_logs_all ON mdfe_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mdfe_manifestos m
      WHERE m.id = mdfe_logs.mdfe_id
      AND (
        m.emitted_by_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM freights f
          WHERE f.id = m.freight_id
          AND (
            f.producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
            OR f.driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
          )
        )
        OR is_admin()
      )
    )
  );

-- mdfe_config: Apenas o dono pode ver e modificar
CREATE POLICY mdfe_config_select ON mdfe_config
  FOR SELECT
  USING (
    (company_id IN (
      SELECT tc.id FROM transport_companies tc
      WHERE tc.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    ))
    OR (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR is_admin()
  );

CREATE POLICY mdfe_config_insert ON mdfe_config
  FOR INSERT
  WITH CHECK (
    (company_id IN (
      SELECT tc.id FROM transport_companies tc
      WHERE tc.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    ))
    OR (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  );

CREATE POLICY mdfe_config_update ON mdfe_config
  FOR UPDATE
  USING (
    (company_id IN (
      SELECT tc.id FROM transport_companies tc
      WHERE tc.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    ))
    OR (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR is_admin()
  );

-- STORAGE BUCKET para DACTEs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('mdfe-dactes', 'mdfe-dactes', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public can view DACTEs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'mdfe-dactes');

CREATE POLICY "Authenticated users can upload DACTEs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'mdfe-dactes'
    AND auth.role() = 'authenticated'
  );
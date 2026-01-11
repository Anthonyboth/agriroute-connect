-- =====================================================
-- MIGRATION: CORREÇÕES DE AUDITORIA AGRIROUTE
-- Fase 1 & 2: Críticas e Alta Prioridade
-- =====================================================

-- =====================================================
-- 1. TRIGGER: PREVENÇÃO DE REUTILIZAÇÃO DE GTA
-- Impede que o mesmo número de GTA seja usado em múltiplos fretes ativos
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_gta_reuse()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_existing_freight_id UUID;
  v_existing_status TEXT;
BEGIN
  -- Apenas verificar documentos do tipo GTA
  IF NEW.document_type != 'GTA' OR NEW.document_number IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verificar se existe outro frete ativo com a mesma GTA
  SELECT f.id, f.status
  INTO v_existing_freight_id, v_existing_status
  FROM freight_sanitary_documents fsd
  JOIN freights f ON f.id = fsd.freight_id
  WHERE fsd.document_number = NEW.document_number
    AND fsd.document_type = 'GTA'
    AND fsd.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND f.status NOT IN ('CANCELLED', 'DELIVERED', 'EXPIRED', 'REJECTED')
  LIMIT 1;

  IF v_existing_freight_id IS NOT NULL THEN
    -- Registrar tentativa de fraude
    INSERT INTO auditoria_eventos (
      tipo,
      codigo_regra,
      descricao,
      severidade,
      frete_id,
      evidencias
    ) VALUES (
      'fraude',
      'GTA_REUSE',
      'Tentativa de reutilização de GTA em frete ativo',
      'critica',
      NEW.freight_id,
      jsonb_build_object(
        'document_number', NEW.document_number,
        'existing_freight_id', v_existing_freight_id,
        'existing_freight_status', v_existing_status,
        'attempted_at', now()
      )
    );
    
    RAISE EXCEPTION 'GTA % já está em uso no frete % (status: %). Possível reutilização fraudulenta.',
      NEW.document_number, v_existing_freight_id, v_existing_status;
  END IF;

  RETURN NEW;
END;
$$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trg_prevent_gta_reuse ON freight_sanitary_documents;
CREATE TRIGGER trg_prevent_gta_reuse
  BEFORE INSERT OR UPDATE ON freight_sanitary_documents
  FOR EACH ROW
  EXECUTE FUNCTION prevent_gta_reuse();

-- =====================================================
-- 2. TRIGGER: IMUTABILIDADE DE DOCUMENTOS VALIDADOS
-- Impede alteração de documentos já validados
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_update_validated_document()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Permitir apenas expiração pelo sistema (mudança para 'expired')
  IF OLD.validation_status = 'valid' THEN
    IF NEW.validation_status = 'expired' THEN
      -- Permitido: expiração automática pelo sistema
      RETURN NEW;
    END IF;
    
    -- Verificar alterações em campos críticos
    IF NEW.file_url IS DISTINCT FROM OLD.file_url OR
       NEW.document_number IS DISTINCT FROM OLD.document_number OR
       NEW.expiry_date IS DISTINCT FROM OLD.expiry_date OR
       NEW.ocr_data IS DISTINCT FROM OLD.ocr_data THEN
      
      -- Registrar tentativa de alteração
      INSERT INTO auditoria_eventos (
        tipo,
        codigo_regra,
        descricao,
        severidade,
        frete_id,
        evidencias
      ) VALUES (
        'alteracao_bloqueada',
        'DOC_IMMUTABLE',
        'Tentativa de alteração de documento já validado',
        'alta',
        OLD.freight_id,
        jsonb_build_object(
          'document_id', OLD.id,
          'document_type', OLD.document_type,
          'changed_fields', jsonb_build_object(
            'file_url_changed', NEW.file_url IS DISTINCT FROM OLD.file_url,
            'document_number_changed', NEW.document_number IS DISTINCT FROM OLD.document_number,
            'expiry_date_changed', NEW.expiry_date IS DISTINCT FROM OLD.expiry_date,
            'ocr_data_changed', NEW.ocr_data IS DISTINCT FROM OLD.ocr_data
          ),
          'attempted_at', now()
        )
      );
      
      RAISE EXCEPTION 'Documento já validado não pode ser alterado. Campos críticos são imutáveis após validação.';
    END IF;
    
    -- Não permitir revalidação para outro status (exceto expired)
    IF NEW.validation_status IS DISTINCT FROM OLD.validation_status AND 
       NEW.validation_status != 'expired' THEN
      RAISE EXCEPTION 'Status de validação de documento validado não pode ser alterado (exceto para expirado).';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trg_prevent_update_validated_document ON freight_sanitary_documents;
CREATE TRIGGER trg_prevent_update_validated_document
  BEFORE UPDATE ON freight_sanitary_documents
  FOR EACH ROW
  EXECUTE FUNCTION prevent_update_validated_document();

-- =====================================================
-- 3. TRIGGER: AUTO-POPULAR requires_sanitary_docs
-- Seta automaticamente quando cargo requer docs sanitários
-- =====================================================

CREATE OR REPLACE FUNCTION set_sanitary_docs_required()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Auto-popular com base no tipo de carga ou serviço
  IF NEW.service_type = 'TRANSPORTE_ANIMAIS' OR 
     NEW.cargo_type = ANY(ARRAY['bovinos', 'suinos', 'equinos', 'caprinos', 'ovinos', 'aves', 'carga_viva', 'animais_vivos']) THEN
    NEW.requires_sanitary_docs := true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trg_set_sanitary_docs_required ON freights;
CREATE TRIGGER trg_set_sanitary_docs_required
  BEFORE INSERT ON freights
  FOR EACH ROW
  EXECUTE FUNCTION set_sanitary_docs_required();

-- =====================================================
-- 4. FUNÇÃO: Verificação de expiração com cron
-- Melhoria da função existente para incluir mais detalhes
-- =====================================================

CREATE OR REPLACE FUNCTION run_compliance_expiry_check()
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_expired_count INTEGER := 0;
  v_alert_count INTEGER := 0;
  v_doc RECORD;
BEGIN
  -- 1. Expirar documentos vencidos
  UPDATE freight_sanitary_documents
  SET 
    validation_status = 'expired',
    updated_at = now()
  WHERE validation_status = 'valid'
    AND expiry_date < now()
    AND document_type = 'GTA';
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  
  -- 2. Gerar alertas para GTAs próximas de expirar (< 24h)
  FOR v_doc IN 
    SELECT 
      fsd.id,
      fsd.freight_id,
      fsd.document_number,
      fsd.expiry_date,
      EXTRACT(EPOCH FROM (fsd.expiry_date - now())) / 3600 as hours_to_expiry
    FROM freight_sanitary_documents fsd
    JOIN freights f ON f.id = fsd.freight_id
    WHERE fsd.validation_status = 'valid'
      AND fsd.document_type = 'GTA'
      AND fsd.expiry_date > now()
      AND fsd.expiry_date < now() + interval '24 hours'
      AND f.status IN ('OPEN', 'ACCEPTED', 'IN_NEGOTIATION', 'LOADING', 'LOADED', 'IN_TRANSIT')
  LOOP
    -- Registrar alerta
    INSERT INTO auditoria_eventos (
      tipo,
      codigo_regra,
      descricao,
      severidade,
      frete_id,
      evidencias
    ) VALUES (
      'alerta',
      'GTA_EXPIRING_SOON',
      format('GTA %s expira em %s horas', v_doc.document_number, round(v_doc.hours_to_expiry::numeric, 1)),
      'media',
      v_doc.freight_id,
      jsonb_build_object(
        'document_id', v_doc.id,
        'document_number', v_doc.document_number,
        'expiry_date', v_doc.expiry_date,
        'hours_to_expiry', v_doc.hours_to_expiry
      )
    )
    ON CONFLICT DO NOTHING;
    
    v_alert_count := v_alert_count + 1;
  END LOOP;
  
  -- 3. Atualizar compliance de fretes com documentos expirados
  UPDATE livestock_freight_compliance lfc
  SET 
    compliance_status = 'blocked',
    blocking_reasons = COALESCE(blocking_reasons, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'type', 'expired_gta',
        'severity', 'blocking',
        'message', 'GTA expirada automaticamente pelo sistema',
        'detected_at', now()
      )
    ),
    updated_at = now()
  FROM freight_sanitary_documents fsd
  WHERE fsd.id = lfc.gta_document_id
    AND fsd.validation_status = 'expired'
    AND lfc.compliance_status != 'blocked';

  RETURN jsonb_build_object(
    'records_expired', v_expired_count,
    'alerts_generated', v_alert_count,
    'executed_at', now()
  );
END;
$$;

-- =====================================================
-- 5. ÍNDICE: Unicidade de GTA por fretes ativos
-- Melhora performance da verificação de reutilização
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_freight_sanitary_docs_gta_active
ON freight_sanitary_documents (document_number, document_type)
WHERE document_type = 'GTA';

-- =====================================================
-- 6. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON FUNCTION prevent_gta_reuse() IS 
'Previne reutilização fraudulenta de GTA em múltiplos fretes ativos. 
Registra tentativas de fraude em auditoria_eventos.';

COMMENT ON FUNCTION prevent_update_validated_document() IS 
'Garante imutabilidade de documentos validados. 
Campos críticos (file_url, document_number, expiry_date, ocr_data) não podem ser alterados após validação.';

COMMENT ON FUNCTION set_sanitary_docs_required() IS 
'Auto-popula campo requires_sanitary_docs com base no tipo de carga/serviço.';

COMMENT ON FUNCTION run_compliance_expiry_check() IS 
'Executa verificação de expiração de compliance sanitário.
Deve ser chamada via cron (pg_cron) a cada hora.
Expira GTAs vencidas e gera alertas para GTAs próximas de expirar.';
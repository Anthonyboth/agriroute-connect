-- =====================================================
-- 1. TRIGGER: prevent_update_validated_document
-- Impede alteração de campos críticos em documentos já validados
-- =====================================================

CREATE OR REPLACE FUNCTION public.prevent_update_validated_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o documento foi validado/aprovado
  IF OLD.compliance_status IN ('approved', 'COMPLIANT', 'validated') THEN
    -- Campos críticos que não podem ser alterados após validação
    IF NEW.gta_number IS DISTINCT FROM OLD.gta_number OR
       NEW.gta_document_id IS DISTINCT FROM OLD.gta_document_id OR
       NEW.animal_count IS DISTINCT FROM OLD.animal_count OR
       NEW.animal_species IS DISTINCT FROM OLD.animal_species OR
       NEW.origin_farm_code IS DISTINCT FROM OLD.origin_farm_code OR
       NEW.destination_farm_code IS DISTINCT FROM OLD.destination_farm_code OR
       NEW.vaccination_status IS DISTINCT FROM OLD.vaccination_status THEN
      
      -- Log na auditoria antes de rejeitar
      INSERT INTO auditoria_eventos (
        tipo,
        codigo_regra,
        descricao,
        severidade,
        frete_id,
        evidencias
      ) VALUES (
        'TENTATIVA_ALTERACAO_DOC_VALIDADO',
        'COMPLIANCE_001',
        'Tentativa de alteração de documento sanitário já validado bloqueada',
        'ALTA',
        NEW.freight_id,
        jsonb_build_object(
          'campo_alterado', 'multiple',
          'old_gta_number', OLD.gta_number,
          'new_gta_number', NEW.gta_number,
          'compliance_id', OLD.id,
          'user_id', auth.uid(),
          'timestamp', now()
        )
      );
      
      RAISE EXCEPTION 'Não é permitido alterar campos críticos de documentos já validados. Status atual: %', OLD.compliance_status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_update_validated_document ON livestock_freight_compliance;
CREATE TRIGGER trigger_prevent_update_validated_document
  BEFORE UPDATE ON livestock_freight_compliance
  FOR EACH ROW
  EXECUTE FUNCTION prevent_update_validated_document();

COMMENT ON FUNCTION prevent_update_validated_document() IS 
'Impede alteração de campos críticos em documentos sanitários já validados, garantindo imutabilidade após submissão.';

-- =====================================================
-- 2. TRIGGER: prevent_duplicate_gta
-- Impede reutilização fraudulenta de GTAs
-- =====================================================

CREATE OR REPLACE FUNCTION public.prevent_duplicate_gta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_record RECORD;
BEGIN
  -- Verificar se já existe uma GTA com o mesmo número e UF de origem
  IF NEW.gta_number IS NOT NULL THEN
    SELECT lfc.id, lfc.freight_id, lfc.compliance_status, f.status as freight_status
    INTO v_existing_record
    FROM livestock_freight_compliance lfc
    JOIN freights f ON f.id = lfc.freight_id
    WHERE lfc.gta_number = NEW.gta_number
      AND lfc.origin_state_code = NEW.origin_state_code
      AND lfc.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND lfc.compliance_status NOT IN ('expired', 'cancelled', 'rejected')
    LIMIT 1;
    
    IF v_existing_record IS NOT NULL THEN
      -- Log de tentativa de fraude
      INSERT INTO auditoria_eventos (
        tipo,
        codigo_regra,
        descricao,
        severidade,
        frete_id,
        evidencias
      ) VALUES (
        'TENTATIVA_REUTILIZACAO_GTA',
        'FRAUD_001',
        'Tentativa de reutilização de GTA já cadastrada - possível fraude',
        'CRITICA',
        NEW.freight_id,
        jsonb_build_object(
          'gta_duplicada', NEW.gta_number,
          'uf_origem', NEW.origin_state_code,
          'compliance_original_id', v_existing_record.id,
          'frete_original_id', v_existing_record.freight_id,
          'status_original', v_existing_record.compliance_status,
          'novo_frete_id', NEW.freight_id,
          'user_id', auth.uid(),
          'timestamp', now()
        )
      );
      
      RAISE EXCEPTION 'GTA % já está cadastrada para outro frete (status: %). Reutilização não permitida.',
        NEW.gta_number, v_existing_record.compliance_status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_duplicate_gta ON livestock_freight_compliance;
CREATE TRIGGER trigger_prevent_duplicate_gta
  BEFORE INSERT OR UPDATE ON livestock_freight_compliance
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_gta();

COMMENT ON FUNCTION prevent_duplicate_gta() IS 
'Impede reutilização fraudulenta de GTAs, verificando unicidade por número e UF de origem.';

-- =====================================================
-- 3. FUNÇÃO: trigger_cte_polling (para cron job)
-- =====================================================

CREATE OR REPLACE FUNCTION public.trigger_cte_polling()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_response jsonb;
BEGIN
  -- Chamar edge function via http extension se disponível
  -- Caso contrário, log que o cron precisa chamar a edge function diretamente
  RAISE NOTICE 'CT-e polling trigger executado em %', now();
  
  -- Log de execução
  INSERT INTO compliance_audit_events (
    event_type,
    event_category,
    event_data,
    actor_role
  ) VALUES (
    'CTE_POLLING_TRIGGER',
    'fiscal',
    jsonb_build_object('executed_at', now(), 'triggered_by', 'cron'),
    'system'
  );
END;
$$;

COMMENT ON FUNCTION trigger_cte_polling() IS 
'Trigger para cron job de polling de CT-es em processamento. Executa a cada 5 minutos.';

-- =====================================================
-- 4. ÍNDICE: Otimização para polling de CT-e
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ctes_status_polling 
ON ctes (status, tentativas) 
WHERE status = 'processando' AND tentativas < 10;

-- =====================================================
-- 5. ATUALIZAR run_compliance_expiry_check para gerar alertas 24h antes
-- =====================================================

CREATE OR REPLACE FUNCTION public.run_compliance_expiry_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count INTEGER := 0;
  v_alert_count INTEGER := 0;
  v_record RECORD;
BEGIN
  -- 1. Expirar GTAs vencidas
  FOR v_record IN
    SELECT lfc.id, lfc.freight_id, lfc.gta_number, fsd.expiry_date
    FROM livestock_freight_compliance lfc
    JOIN freight_sanitary_documents fsd ON fsd.id = lfc.gta_document_id
    WHERE fsd.expiry_date < CURRENT_DATE
      AND lfc.compliance_status IN ('approved', 'pending', 'validating', 'COMPLIANT')
  LOOP
    -- Atualizar status para expirado
    UPDATE livestock_freight_compliance
    SET compliance_status = 'expired',
        updated_at = now()
    WHERE id = v_record.id;
    
    -- Registrar evento de expiração
    INSERT INTO compliance_audit_events (
      event_type,
      event_category,
      freight_id,
      livestock_compliance_id,
      event_data,
      actor_role
    ) VALUES (
      'GTA_EXPIRED',
      'compliance',
      v_record.freight_id,
      v_record.id,
      jsonb_build_object(
        'gta_number', v_record.gta_number,
        'expiry_date', v_record.expiry_date,
        'expired_at', now()
      ),
      'system'
    );
    
    v_expired_count := v_expired_count + 1;
  END LOOP;
  
  -- 2. Gerar alertas para GTAs que vencem em 24h
  FOR v_record IN
    SELECT lfc.id, lfc.freight_id, lfc.gta_number, fsd.expiry_date, f.producer_id
    FROM livestock_freight_compliance lfc
    JOIN freight_sanitary_documents fsd ON fsd.id = lfc.gta_document_id
    JOIN freights f ON f.id = lfc.freight_id
    WHERE fsd.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '24 hours'
      AND lfc.compliance_status IN ('approved', 'COMPLIANT')
      AND NOT EXISTS (
        SELECT 1 FROM notifications n 
        WHERE n.data->>'compliance_id' = lfc.id::text 
        AND n.type = 'gta_expiring_soon'
        AND n.created_at > now() - INTERVAL '24 hours'
      )
  LOOP
    -- Criar notificação de alerta
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      data
    ) VALUES (
      v_record.producer_id,
      'GTA próxima do vencimento',
      format('A GTA %s do frete vence em menos de 24 horas (%s)', 
             v_record.gta_number, 
             to_char(v_record.expiry_date, 'DD/MM/YYYY')),
      'gta_expiring_soon',
      jsonb_build_object(
        'compliance_id', v_record.id,
        'freight_id', v_record.freight_id,
        'gta_number', v_record.gta_number,
        'expiry_date', v_record.expiry_date
      )
    );
    
    -- Registrar evento de alerta
    INSERT INTO compliance_audit_events (
      event_type,
      event_category,
      freight_id,
      livestock_compliance_id,
      event_data,
      actor_role
    ) VALUES (
      'GTA_EXPIRING_ALERT',
      'compliance',
      v_record.freight_id,
      v_record.id,
      jsonb_build_object(
        'gta_number', v_record.gta_number,
        'expiry_date', v_record.expiry_date,
        'hours_until_expiry', EXTRACT(EPOCH FROM (v_record.expiry_date - now())) / 3600
      ),
      'system'
    );
    
    v_alert_count := v_alert_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'expired_count', v_expired_count,
    'alert_count', v_alert_count,
    'executed_at', now()
  );
END;
$$;

COMMENT ON FUNCTION run_compliance_expiry_check() IS 
'Executa verificação de expiração de compliance sanitário.
Expira GTAs vencidas e gera alertas 24h antes do vencimento.
Deve ser chamada via cron (pg_cron) a cada hora.';
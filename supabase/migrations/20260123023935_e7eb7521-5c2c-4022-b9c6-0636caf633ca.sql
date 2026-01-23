
-- =============================================================================
-- AUDITORIA DE PRODUÇÃO: Correção Completa do Módulo Fiscal
-- =============================================================================

-- 1. Atualizar constraint de status para incluir todos os valores usados
ALTER TABLE fiscal_issuers DROP CONSTRAINT IF EXISTS fiscal_issuers_status_check;
ALTER TABLE fiscal_issuers ADD CONSTRAINT fiscal_issuers_status_check 
  CHECK (status = ANY (ARRAY[
    'pending'::text, 
    'documents_pending'::text, 
    'certificate_pending'::text,
    'certificate_uploaded'::text,
    'sefaz_validating'::text, 
    'sefaz_validated'::text,
    'validated'::text, 
    'active'::text,
    'blocked'::text, 
    'suspended'::text
  ]));

-- 2. Criar função para reservar crédito de emissão
CREATE OR REPLACE FUNCTION public.reserve_emission_credit(
  p_issuer_id UUID,
  p_emission_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_available NUMERIC;
  v_emission_cost NUMERIC := 1;
BEGIN
  SELECT id, available_balance INTO v_wallet_id, v_available
  FROM fiscal_wallet
  WHERE issuer_id = p_issuer_id
  FOR UPDATE;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Carteira fiscal não encontrada para emissor %', p_issuer_id;
  END IF;
  
  IF v_available < v_emission_cost THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: %, Necessário: %', v_available, v_emission_cost;
  END IF;
  
  UPDATE fiscal_wallet
  SET 
    available_balance = available_balance - v_emission_cost,
    reserved_balance = reserved_balance + v_emission_cost,
    updated_at = NOW()
  WHERE id = v_wallet_id;
  
  INSERT INTO fiscal_wallet_transactions (
    wallet_id, transaction_type, amount, description, 
    reference_type, reference_id, status, created_at
  ) VALUES (
    v_wallet_id, 'reserve', v_emission_cost, 'Reserva para emissão fiscal',
    'emission', p_emission_id, 'completed', NOW()
  );
  
  RETURN TRUE;
END;
$$;

-- 3. Criar função para liberar crédito (em caso de falha/rejeição)
CREATE OR REPLACE FUNCTION public.release_emission_credit(
  p_emission_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issuer_id UUID;
  v_wallet_id UUID;
  v_emission_cost NUMERIC := 1;
BEGIN
  SELECT issuer_id INTO v_issuer_id
  FROM nfe_emissions
  WHERE id = p_emission_id;
  
  IF v_issuer_id IS NULL THEN
    RAISE WARNING 'Emissão não encontrada: %', p_emission_id;
    RETURN FALSE;
  END IF;
  
  SELECT id INTO v_wallet_id
  FROM fiscal_wallet
  WHERE issuer_id = v_issuer_id
  FOR UPDATE;
  
  IF v_wallet_id IS NULL THEN
    RAISE WARNING 'Carteira não encontrada para emissor: %', v_issuer_id;
    RETURN FALSE;
  END IF;
  
  UPDATE fiscal_wallet
  SET 
    available_balance = available_balance + v_emission_cost,
    reserved_balance = GREATEST(reserved_balance - v_emission_cost, 0),
    updated_at = NOW()
  WHERE id = v_wallet_id;
  
  INSERT INTO fiscal_wallet_transactions (
    wallet_id, transaction_type, amount, description, 
    reference_type, reference_id, status, created_at
  ) VALUES (
    v_wallet_id, 'refund', v_emission_cost, 'Estorno por falha na emissão',
    'emission', p_emission_id, 'completed', NOW()
  );
  
  RETURN TRUE;
END;
$$;

-- 4. Criar função para confirmar crédito (após autorização)
CREATE OR REPLACE FUNCTION public.confirm_emission_credit(
  p_emission_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issuer_id UUID;
  v_wallet_id UUID;
  v_emission_cost NUMERIC := 1;
BEGIN
  SELECT issuer_id INTO v_issuer_id
  FROM nfe_emissions
  WHERE id = p_emission_id;
  
  IF v_issuer_id IS NULL THEN
    RAISE WARNING 'Emissão não encontrada: %', p_emission_id;
    RETURN FALSE;
  END IF;
  
  SELECT id INTO v_wallet_id
  FROM fiscal_wallet
  WHERE issuer_id = v_issuer_id
  FOR UPDATE;
  
  IF v_wallet_id IS NULL THEN
    RAISE WARNING 'Carteira não encontrada para emissor: %', v_issuer_id;
    RETURN FALSE;
  END IF;
  
  UPDATE fiscal_wallet
  SET 
    reserved_balance = GREATEST(reserved_balance - v_emission_cost, 0),
    total_debited = total_debited + v_emission_cost,
    emissions_count = emissions_count + 1,
    last_emission_at = NOW(),
    updated_at = NOW()
  WHERE id = v_wallet_id;
  
  INSERT INTO fiscal_wallet_transactions (
    wallet_id, transaction_type, amount, description, 
    reference_type, reference_id, status, created_at
  ) VALUES (
    v_wallet_id, 'debit', v_emission_cost, 'Débito confirmado - emissão autorizada',
    'emission', p_emission_id, 'completed', NOW()
  );
  
  RETURN TRUE;
END;
$$;

-- 5. Garantir colunas necessárias em fiscal_wallet_transactions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_wallet_transactions' AND column_name = 'reference_type') THEN
    ALTER TABLE fiscal_wallet_transactions ADD COLUMN reference_type TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_wallet_transactions' AND column_name = 'reference_id') THEN
    ALTER TABLE fiscal_wallet_transactions ADD COLUMN reference_id UUID;
  END IF;
END $$;

-- 6. Comentários de documentação
COMMENT ON FUNCTION public.reserve_emission_credit IS 'Reserva crédito na carteira fiscal antes da emissão de documento';
COMMENT ON FUNCTION public.release_emission_credit IS 'Libera crédito reservado quando emissão falha ou é rejeitada';
COMMENT ON FUNCTION public.confirm_emission_credit IS 'Confirma débito do crédito após autorização da emissão';

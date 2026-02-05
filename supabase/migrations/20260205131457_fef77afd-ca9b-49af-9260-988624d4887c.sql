-- ============================================================
-- SISTEMA DE AVALIAÇÕES EXPANDIDO PARA TRANSPORTADORAS
-- ============================================================
-- Tipos de avaliação:
-- 1. PRODUCER_TO_DRIVER - Produtor avalia Motorista
-- 2. DRIVER_TO_PRODUCER - Motorista avalia Produtor
-- 3. PRODUCER_TO_COMPANY - Produtor avalia Transportadora (quando motorista é afiliado)
-- 4. COMPANY_TO_PRODUCER - Transportadora avalia Produtor (quando motorista afiliado completa frete)
-- ❌ NÃO EXISTE: Transportadora ↔ Motorista (conforme requisito do usuário)
-- ============================================================

-- 1. Adicionar coluna company_id para avaliações envolvendo transportadoras
ALTER TABLE public.freight_ratings
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.transport_companies(id);

-- 2. Adicionar coluna assignment_id para rastrear avaliação por motorista individual
ALTER TABLE public.freight_ratings
ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES public.freight_assignments(id);

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_freight_ratings_company_id ON public.freight_ratings(company_id);
CREATE INDEX IF NOT EXISTS idx_freight_ratings_assignment_id ON public.freight_ratings(assignment_id);
CREATE INDEX IF NOT EXISTS idx_freight_ratings_rating_type ON public.freight_ratings(rating_type);

-- 4. Atualizar constraint de unicidade para permitir múltiplas avaliações do mesmo frete
-- (produtor pode avaliar motorista E transportadora; transportadora pode avaliar produtor)
-- Primeiro remover constraint antiga se existir
ALTER TABLE public.freight_ratings
DROP CONSTRAINT IF EXISTS freight_ratings_freight_id_rater_id_rating_type_key;

-- Criar nova constraint que permite avaliações distintas por tipo
ALTER TABLE public.freight_ratings
ADD CONSTRAINT freight_ratings_unique_per_type 
UNIQUE (freight_id, rater_id, rated_user_id, rating_type, company_id);

-- 5. Comentários para documentação
COMMENT ON COLUMN public.freight_ratings.company_id IS 'ID da transportadora quando rating_type é PRODUCER_TO_COMPANY ou COMPANY_TO_PRODUCER';
COMMENT ON COLUMN public.freight_ratings.assignment_id IS 'ID do assignment individual para fretes multi-carreta';

-- 6. Função para obter avaliações pendentes com afiliação
CREATE OR REPLACE FUNCTION public.get_pending_ratings_with_affiliation(p_profile_id UUID)
RETURNS TABLE (
  freight_id UUID,
  assignment_id UUID,
  driver_id UUID,
  driver_name TEXT,
  company_id UUID,
  company_name TEXT,
  producer_id UUID,
  producer_name TEXT,
  pending_types TEXT[],
  payment_confirmed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_company_id UUID;
BEGIN
  -- Obter role do usuário
  SELECT role INTO v_role FROM profiles WHERE id = p_profile_id;
  
  -- Verificar se é dono de transportadora
  SELECT id INTO v_company_id FROM transport_companies WHERE profile_id = p_profile_id LIMIT 1;
  
  -- =============================================
  -- PRODUTOR: Avaliar Motorista e Transportadora
  -- =============================================
  IF v_role = 'PRODUTOR' THEN
    RETURN QUERY
    WITH confirmed_payments AS (
      SELECT DISTINCT ON (ep.freight_id, ep.driver_id)
        ep.freight_id,
        ep.driver_id,
        ep.confirmed_at
      FROM external_payments ep
      WHERE ep.status = 'confirmed'
        AND ep.producer_id = p_profile_id
    ),
    assignments_to_rate AS (
      SELECT 
        fa.freight_id,
        fa.id as assignment_id,
        fa.driver_id,
        p.full_name as driver_name,
        fa.company_id as affiliated_company_id,
        tc.company_name as company_name,
        f.producer_id,
        pp.full_name as producer_name,
        cp.confirmed_at as payment_confirmed_at
      FROM freight_assignments fa
      JOIN freights f ON f.id = fa.freight_id
      JOIN profiles p ON p.id = fa.driver_id
      JOIN profiles pp ON pp.id = f.producer_id
      JOIN confirmed_payments cp ON cp.freight_id = fa.freight_id AND cp.driver_id = fa.driver_id
      LEFT JOIN transport_companies tc ON tc.id = fa.company_id
      WHERE f.producer_id = p_profile_id
        AND fa.status = 'DELIVERED'
    )
    SELECT 
      atr.freight_id,
      atr.assignment_id,
      atr.driver_id,
      atr.driver_name,
      atr.affiliated_company_id,
      atr.company_name,
      atr.producer_id,
      atr.producer_name,
      ARRAY_REMOVE(ARRAY[
        -- Verificar se falta avaliar motorista
        CASE WHEN NOT EXISTS (
          SELECT 1 FROM freight_ratings fr 
          WHERE fr.freight_id = atr.freight_id 
            AND fr.rater_id = p_profile_id 
            AND fr.rated_user_id = atr.driver_id
            AND fr.rating_type = 'PRODUCER_TO_DRIVER'
        ) THEN 'PRODUCER_TO_DRIVER' END,
        -- Verificar se falta avaliar transportadora (se motorista for afiliado)
        CASE WHEN atr.affiliated_company_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM freight_ratings fr 
          WHERE fr.freight_id = atr.freight_id 
            AND fr.rater_id = p_profile_id 
            AND fr.company_id = atr.affiliated_company_id
            AND fr.rating_type = 'PRODUCER_TO_COMPANY'
        ) THEN 'PRODUCER_TO_COMPANY' END
      ], NULL) as pending_types,
      atr.payment_confirmed_at
    FROM assignments_to_rate atr
    WHERE EXISTS (
      -- Pelo menos uma avaliação pendente
      SELECT 1 WHERE NOT EXISTS (
        SELECT 1 FROM freight_ratings fr 
        WHERE fr.freight_id = atr.freight_id 
          AND fr.rater_id = p_profile_id 
          AND fr.rated_user_id = atr.driver_id
          AND fr.rating_type = 'PRODUCER_TO_DRIVER'
      )
      OR (atr.affiliated_company_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM freight_ratings fr 
        WHERE fr.freight_id = atr.freight_id 
          AND fr.rater_id = p_profile_id 
          AND fr.company_id = atr.affiliated_company_id
          AND fr.rating_type = 'PRODUCER_TO_COMPANY'
      ))
    );
  
  -- =============================================
  -- MOTORISTA: Avaliar Produtor
  -- =============================================
  ELSIF v_role IN ('MOTORISTA', 'MOTORISTA_AFILIADO') THEN
    RETURN QUERY
    WITH confirmed_payments AS (
      SELECT DISTINCT ON (ep.freight_id)
        ep.freight_id,
        ep.confirmed_at
      FROM external_payments ep
      WHERE ep.status = 'confirmed'
        AND ep.driver_id = p_profile_id
    )
    SELECT 
      fa.freight_id,
      fa.id as assignment_id,
      fa.driver_id,
      p.full_name as driver_name,
      fa.company_id as affiliated_company_id,
      tc.company_name,
      f.producer_id,
      pp.full_name as producer_name,
      ARRAY['DRIVER_TO_PRODUCER']::TEXT[] as pending_types,
      cp.confirmed_at as payment_confirmed_at
    FROM freight_assignments fa
    JOIN freights f ON f.id = fa.freight_id
    JOIN profiles p ON p.id = fa.driver_id
    JOIN profiles pp ON pp.id = f.producer_id
    JOIN confirmed_payments cp ON cp.freight_id = fa.freight_id
    LEFT JOIN transport_companies tc ON tc.id = fa.company_id
    WHERE fa.driver_id = p_profile_id
      AND fa.status = 'DELIVERED'
      AND NOT EXISTS (
        SELECT 1 FROM freight_ratings fr 
        WHERE fr.freight_id = fa.freight_id 
          AND fr.rater_id = p_profile_id 
          AND fr.rating_type = 'DRIVER_TO_PRODUCER'
      );
  
  -- =============================================
  -- TRANSPORTADORA: Avaliar Produtor
  -- =============================================
  ELSIF v_company_id IS NOT NULL THEN
    RETURN QUERY
    WITH confirmed_payments AS (
      SELECT DISTINCT ON (ep.freight_id, ep.driver_id)
        ep.freight_id,
        ep.driver_id,
        ep.confirmed_at
      FROM external_payments ep
      JOIN freight_assignments fa ON fa.freight_id = ep.freight_id AND fa.driver_id = ep.driver_id
      WHERE ep.status = 'confirmed'
        AND fa.company_id = v_company_id
    )
    SELECT 
      fa.freight_id,
      fa.id as assignment_id,
      fa.driver_id,
      p.full_name as driver_name,
      fa.company_id as affiliated_company_id,
      tc.company_name,
      f.producer_id,
      pp.full_name as producer_name,
      ARRAY['COMPANY_TO_PRODUCER']::TEXT[] as pending_types,
      cp.confirmed_at as payment_confirmed_at
    FROM freight_assignments fa
    JOIN freights f ON f.id = fa.freight_id
    JOIN profiles p ON p.id = fa.driver_id
    JOIN profiles pp ON pp.id = f.producer_id
    JOIN confirmed_payments cp ON cp.freight_id = fa.freight_id AND cp.driver_id = fa.driver_id
    JOIN transport_companies tc ON tc.id = fa.company_id
    WHERE fa.company_id = v_company_id
      AND fa.status = 'DELIVERED'
      AND NOT EXISTS (
        SELECT 1 FROM freight_ratings fr 
        WHERE fr.freight_id = fa.freight_id 
          AND fr.rater_id = p_profile_id 
          AND fr.rating_type = 'COMPANY_TO_PRODUCER'
          AND fr.company_id = v_company_id
      );
  END IF;
END;
$$;

-- 7. Conceder permissões
GRANT EXECUTE ON FUNCTION public.get_pending_ratings_with_affiliation(UUID) TO authenticated;
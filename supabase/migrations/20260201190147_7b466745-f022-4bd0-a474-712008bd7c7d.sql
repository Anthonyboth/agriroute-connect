
-- =====================================================
-- CORREÇÃO URGENTE: Restaurar dados do frete de teste
-- =====================================================

-- Corrigir o frete específico que foi incorretamente modificado pela migration anterior
UPDATE public.freights
SET 
  required_trucks = 3,  -- Há 3 atribuições ativas confirmadas
  accepted_trucks = 3,  -- Todas estão ativas (ACCEPTED, LOADED)
  drivers_assigned = ARRAY[
    '60f2073c-e7e3-483c-a6e4-2d76fbe6380e'::uuid,  -- Anthony Both Motorista (autônomo - LOADED)
    'f3cd0df9-28d4-48b9-b07a-20f05951a4b3'::uuid,  -- Anthony Both Motorista Transpo (afiliado - ACCEPTED)
    'ad0f7eeb-5813-4a25-aa76-9af12c951c45'::uuid   -- Anthony Motorista 3 (afiliado - ACCEPTED)
  ],
  status = 'ACCEPTED',  -- Já tem motoristas em progresso
  metadata = metadata - 'remaining_slots_expired_at'  -- Remover marcação de expiração incorreta
WHERE id = '80d056ae-89c7-4356-9d99-a4a947e2fa4f';

-- Executar sincronização imediata para todos os fretes CARGA
-- para garantir que não há outras inconsistências
DO $$
DECLARE
  v_freight RECORD;
  v_real_count INTEGER;
BEGIN
  FOR v_freight IN
    SELECT f.id, f.accepted_trucks, f.required_trucks, f.status
    FROM freights f
    WHERE f.service_type = 'CARGA'
      AND f.status IN ('OPEN', 'ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
  LOOP
    -- Contar atribuições reais
    SELECT COUNT(*) INTO v_real_count
    FROM freight_assignments fa
    WHERE fa.freight_id = v_freight.id
      AND fa.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION');
    
    -- Se diferente, corrigir
    IF v_real_count != v_freight.accepted_trucks OR 
       (v_real_count > 0 AND v_freight.status = 'OPEN') THEN
      UPDATE freights
      SET 
        accepted_trucks = v_real_count,
        required_trucks = GREATEST(required_trucks, v_real_count),
        status = CASE 
          WHEN v_real_count > 0 AND status = 'OPEN' THEN 'ACCEPTED'
          ELSE status
        END,
        drivers_assigned = (
          SELECT ARRAY_AGG(fa2.driver_id)
          FROM freight_assignments fa2
          WHERE fa2.freight_id = v_freight.id
            AND fa2.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION')
        ),
        updated_at = NOW()
      WHERE id = v_freight.id;
      
      RAISE NOTICE 'Corrigido frete %: accepted_trucks % -> %, status % -> ACCEPTED', 
        v_freight.id, v_freight.accepted_trucks, v_real_count, v_freight.status;
    END IF;
  END LOOP;
END;
$$;

-- Atualizar fretes que têm propostas aceitas mas não foram sincronizados
UPDATE freights 
SET 
  driver_id = fp.driver_id,
  status = 'ACCEPTED'::freight_status,
  updated_at = now()
FROM freight_proposals fp
WHERE freights.id = fp.freight_id 
  AND fp.status = 'ACCEPTED'
  AND freights.driver_id IS NULL;

-- Criar função para sincronizar fretes quando propostas são aceitas
CREATE OR REPLACE FUNCTION sync_freight_on_proposal_accept()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a proposta foi aceita, atualizar o frete
  IF NEW.status = 'ACCEPTED' AND OLD.status != 'ACCEPTED' THEN
    UPDATE freights 
    SET 
      driver_id = NEW.driver_id,
      status = 'ACCEPTED'::freight_status,
      updated_at = now()
    WHERE id = NEW.freight_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para sincronização automática
DROP TRIGGER IF EXISTS sync_freight_on_proposal_accept_trigger ON freight_proposals;
CREATE TRIGGER sync_freight_on_proposal_accept_trigger
  AFTER UPDATE ON freight_proposals
  FOR EACH ROW
  EXECUTE FUNCTION sync_freight_on_proposal_accept();
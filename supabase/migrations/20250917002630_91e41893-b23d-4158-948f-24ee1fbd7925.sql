-- Corrigir função para ter search_path seguro
CREATE OR REPLACE FUNCTION update_accepted_trucks_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar contador quando proposta é aceita
  IF NEW.status = 'ACCEPTED' AND OLD.status != 'ACCEPTED' THEN
    UPDATE public.freights 
    SET accepted_trucks = accepted_trucks + 1
    WHERE id = NEW.freight_id;
    
    -- Verificar se atingiu o limite e marcar frete como completo
    UPDATE public.freights 
    SET status = 'IN_NEGOTIATION'
    WHERE id = NEW.freight_id 
    AND accepted_trucks >= required_trucks 
    AND status = 'OPEN';
    
  -- Decrementar contador quando proposta aceita é rejeitada
  ELSIF OLD.status = 'ACCEPTED' AND NEW.status != 'ACCEPTED' THEN
    UPDATE public.freights 
    SET accepted_trucks = GREATEST(0, accepted_trucks - 1)
    WHERE id = NEW.freight_id;
    
    -- Reabrir frete se estava completo e agora tem vaga
    UPDATE public.freights 
    SET status = 'OPEN'
    WHERE id = NEW.freight_id 
    AND accepted_trucks < required_trucks 
    AND status = 'IN_NEGOTIATION';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
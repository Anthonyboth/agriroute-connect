-- Adicionar campos para controle de limite de carretas
ALTER TABLE public.freights 
ADD COLUMN required_trucks INTEGER DEFAULT 1 NOT NULL,
ADD COLUMN accepted_trucks INTEGER DEFAULT 0 NOT NULL;

-- Comentários para documentar os campos
COMMENT ON COLUMN public.freights.required_trucks IS 'Número de carretas necessárias para este frete';
COMMENT ON COLUMN public.freights.accepted_trucks IS 'Número de carretas já contratadas/aceitas';

-- Função para atualizar contador de carretas aceitas
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
$$ LANGUAGE plpgsql;

-- Criar trigger para monitorar mudanças nas propostas
CREATE TRIGGER update_trucks_count_trigger
AFTER UPDATE ON public.freight_proposals
FOR EACH ROW
EXECUTE FUNCTION update_accepted_trucks_count();
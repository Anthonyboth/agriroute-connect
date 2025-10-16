-- Adicionar validação de city_id em tabelas críticas
-- Função para validar city_id
CREATE OR REPLACE FUNCTION public.validate_city_id()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validar origin_city_id se fornecido
  IF NEW.origin_city_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.cities WHERE id = NEW.origin_city_id) THEN
      RAISE EXCEPTION 'origin_city_id inválido: cidade não encontrada no banco de dados';
    END IF;
  END IF;
  
  -- Validar destination_city_id se fornecido
  IF NEW.destination_city_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.cities WHERE id = NEW.destination_city_id) THEN
      RAISE EXCEPTION 'destination_city_id inválido: cidade não encontrada no banco de dados';
    END IF;
  END IF;
  
  -- Validar city_id em service_requests se fornecido
  IF TG_TABLE_NAME = 'service_requests' AND NEW.city_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.cities WHERE id = NEW.city_id) THEN
      RAISE EXCEPTION 'city_id inválido: cidade não encontrada no banco de dados';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Adicionar trigger para tabela freights
DROP TRIGGER IF EXISTS validate_freight_city_ids ON public.freights;
CREATE TRIGGER validate_freight_city_ids
  BEFORE INSERT OR UPDATE ON public.freights
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_city_id();

-- Adicionar trigger para tabela service_requests
DROP TRIGGER IF EXISTS validate_service_city_id ON public.service_requests;
CREATE TRIGGER validate_service_city_id
  BEFORE INSERT OR UPDATE ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_city_id();

-- Comentários explicativos
COMMENT ON FUNCTION public.validate_city_id() IS 'Valida se os city_id fornecidos existem na tabela cities antes de inserir/atualizar';
COMMENT ON TRIGGER validate_freight_city_ids ON public.freights IS 'Garante que origin_city_id e destination_city_id são válidos antes de salvar frete';
COMMENT ON TRIGGER validate_service_city_id ON public.service_requests IS 'Garante que city_id é válido antes de salvar solicitação de serviço';
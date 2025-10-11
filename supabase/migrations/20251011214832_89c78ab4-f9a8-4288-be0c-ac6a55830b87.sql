-- Migration: Sistema de perfis - Parte 2 (sem storage policies)

-- 1. Adicionar campos estruturados de endereço
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_number TEXT,
ADD COLUMN IF NOT EXISTS address_complement TEXT,
ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_state TEXT,
ADD COLUMN IF NOT EXISTS address_zip TEXT;

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.address_street IS 'Rua, avenida, BR, MT, etc.';
COMMENT ON COLUMN public.profiles.address_number IS 'Número do imóvel';
COMMENT ON COLUMN public.profiles.address_complement IS 'Complemento (apto, bloco, etc.)';
COMMENT ON COLUMN public.profiles.address_neighborhood IS 'Bairro, fazenda, distrito';
COMMENT ON COLUMN public.profiles.address_city IS 'Cidade';
COMMENT ON COLUMN public.profiles.address_state IS 'Estado (sigla UF)';
COMMENT ON COLUMN public.profiles.address_zip IS 'CEP';

-- 2. Criar função RPC para distribuição de estrelas por usuário
CREATE OR REPLACE FUNCTION public.get_user_rating_distribution(p_user_id UUID)
RETURNS TABLE(
  star_rating INTEGER,
  count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.rating as star_rating,
    COUNT(*)::BIGINT as count
  FROM public.ratings r
  WHERE r.rated_user_id = p_user_id
  GROUP BY r.rating
  ORDER BY r.rating DESC;
END;
$$;

-- 3. Criar tabela para avaliações de serviços (se não existir)
CREATE TABLE IF NOT EXISTS public.service_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rated_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  rating_type TEXT NOT NULL CHECK (rating_type IN ('CLIENT_TO_PROVIDER', 'PROVIDER_TO_CLIENT')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(service_request_id, rater_id, rating_type)
);

-- Enable RLS
ALTER TABLE public.service_ratings ENABLE ROW LEVEL SECURITY;

-- RLS policies para service_ratings
CREATE POLICY "Users can create ratings for their services"
ON public.service_ratings
FOR INSERT
TO authenticated
WITH CHECK (
  rater_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND service_request_id IN (
    SELECT sr.id FROM public.service_requests sr
    JOIN public.profiles p ON (sr.client_id = p.id OR sr.provider_id = p.id)
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view ratings for their services"
ON public.service_ratings
FOR SELECT
TO authenticated
USING (
  service_request_id IN (
    SELECT sr.id FROM public.service_requests sr
    JOIN public.profiles p ON (sr.client_id = p.id OR sr.provider_id = p.id)
    WHERE p.user_id = auth.uid()
  )
  OR is_admin()
);

-- 4. Trigger para atualizar rating do perfil com avaliações de serviços
CREATE OR REPLACE FUNCTION public.update_profile_rating_with_services()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Atualizar perfil com todas as avaliações (fretes + serviços)
  UPDATE public.profiles 
  SET 
    total_ratings = (
      SELECT COUNT(*) FROM (
        SELECT 1 FROM public.ratings WHERE rated_user_id = NEW.rated_user_id
        UNION ALL
        SELECT 1 FROM public.service_ratings WHERE rated_user_id = NEW.rated_user_id
      ) combined
    ),
    rating_sum = (
      SELECT SUM(rating) FROM (
        SELECT rating FROM public.ratings WHERE rated_user_id = NEW.rated_user_id
        UNION ALL
        SELECT rating FROM public.service_ratings WHERE rated_user_id = NEW.rated_user_id
      ) combined
    ),
    rating = (
      SELECT ROUND(AVG(rating)::numeric, 1) FROM (
        SELECT rating FROM public.ratings WHERE rated_user_id = NEW.rated_user_id
        UNION ALL
        SELECT rating FROM public.service_ratings WHERE rated_user_id = NEW.rated_user_id
      ) combined
    )
  WHERE id = NEW.rated_user_id;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS update_service_rating_trigger ON public.service_ratings;
CREATE TRIGGER update_service_rating_trigger
AFTER INSERT ON public.service_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_rating_with_services();
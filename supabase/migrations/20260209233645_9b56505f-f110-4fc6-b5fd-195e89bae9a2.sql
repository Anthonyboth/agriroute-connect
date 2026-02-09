
-- Trigger para manter profiles.rating e total_ratings sincronizados com freight_ratings
CREATE OR REPLACE FUNCTION public.sync_profile_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_rating numeric;
  total_count integer;
  target_user_id uuid;
BEGIN
  -- Determinar o usuário afetado
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.rated_user_id;
  ELSE
    target_user_id := NEW.rated_user_id;
  END IF;

  -- Calcular média e total de avaliações
  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO avg_rating, total_count
  FROM freight_ratings
  WHERE rated_user_id = target_user_id;

  -- Atualizar perfil
  UPDATE profiles
  SET rating = ROUND(avg_rating::numeric, 2),
      total_ratings = total_count,
      updated_at = now()
  WHERE id = target_user_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Trigger em INSERT, UPDATE, DELETE na freight_ratings
DROP TRIGGER IF EXISTS trigger_sync_profile_rating ON public.freight_ratings;
CREATE TRIGGER trigger_sync_profile_rating
AFTER INSERT OR UPDATE OR DELETE ON public.freight_ratings
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_rating();

-- Retroativo: sincronizar ratings existentes
UPDATE profiles p
SET rating = sub.avg_rating,
    total_ratings = sub.total_count,
    updated_at = now()
FROM (
  SELECT rated_user_id,
         ROUND(AVG(rating)::numeric, 2) as avg_rating,
         COUNT(*) as total_count
  FROM freight_ratings
  GROUP BY rated_user_id
) sub
WHERE p.id = sub.rated_user_id;

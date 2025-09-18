-- Corrigir todas as funções com search_path mutable
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_profile_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the rated user's profile
  UPDATE public.profiles 
  SET 
    total_ratings = (SELECT COUNT(*) FROM public.ratings WHERE rated_user_id = NEW.rated_user_id),
    rating_sum = (SELECT SUM(rating) FROM public.ratings WHERE rated_user_id = NEW.rated_user_id),
    rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM public.ratings WHERE rated_user_id = NEW.rated_user_id)
  WHERE id = NEW.rated_user_id;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_loyalty_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update total points for the user
  INSERT INTO public.user_loyalty (user_id, total_points, completed_freights)
  VALUES (NEW.user_id, NEW.points, CASE WHEN NEW.action_type = 'FREIGHT_COMPLETED' THEN 1 ELSE 0 END)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    total_points = user_loyalty.total_points + NEW.points,
    completed_freights = user_loyalty.completed_freights + CASE WHEN NEW.action_type = 'FREIGHT_COMPLETED' THEN 1 ELSE 0 END,
    tier = CASE 
      WHEN user_loyalty.total_points + NEW.points >= 1000 THEN 'GOLD'
      WHEN user_loyalty.total_points + NEW.points >= 500 THEN 'SILVER'
      ELSE 'BRONZE'
    END,
    updated_at = now();
  
  RETURN NEW;
END;
$$;
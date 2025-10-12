-- Corrigir avisos de segurança

-- Adicionar search_path às funções que estavam faltando
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, table_name, operation, old_data, timestamp)
    VALUES (get_current_user_safe(), TG_TABLE_NAME, TG_OP, row_to_json(OLD), now());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, table_name, operation, old_data, new_data, timestamp)
    VALUES (get_current_user_safe(), TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW), now());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, table_name, operation, new_data, timestamp)
    VALUES (get_current_user_safe(), TG_TABLE_NAME, TG_OP, row_to_json(NEW), now());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION update_loyalty_points()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_loyalty (user_id, total_points, completed_freights)
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
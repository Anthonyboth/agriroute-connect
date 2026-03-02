
-- Tabela de log para mismatches de city_id corrigidos automaticamente
CREATE TABLE IF NOT EXISTS public.city_id_mismatch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id uuid,
  field_name text NOT NULL,
  city_name text,
  state text,
  wrong_city_id uuid,
  correct_city_id uuid,
  corrected_at timestamptz DEFAULT now(),
  operation text
);

ALTER TABLE public.city_id_mismatch_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler (is_admin() sem argumento)
CREATE POLICY "Only admins can read mismatch logs"
  ON public.city_id_mismatch_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Trigger SECURITY DEFINER pode inserir
CREATE POLICY "System can insert mismatch logs"
  ON public.city_id_mismatch_logs FOR INSERT
  WITH CHECK (true);

-- Trigger atualizado com logging de mismatches
CREATE OR REPLACE FUNCTION public.backfill_freight_city_ids()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resolved_origin_id uuid;
  v_resolved_dest_id uuid;
BEGIN
  IF (NEW.origin_city IS NOT NULL AND NEW.origin_state IS NOT NULL) THEN
    SELECT c.id INTO v_resolved_origin_id
    FROM cities c
    WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(NEW.origin_city))
      AND UPPER(TRIM(c.state)) = UPPER(TRIM(NEW.origin_state))
    LIMIT 1;
    
    IF v_resolved_origin_id IS NOT NULL THEN
      IF NEW.origin_city_id IS NOT NULL AND NEW.origin_city_id != v_resolved_origin_id THEN
        INSERT INTO city_id_mismatch_logs (freight_id, field_name, city_name, state, wrong_city_id, correct_city_id, operation)
        VALUES (NEW.id, 'origin', NEW.origin_city, NEW.origin_state, NEW.origin_city_id, v_resolved_origin_id, TG_OP);
      END IF;
      NEW.origin_city_id := v_resolved_origin_id;
    END IF;
  END IF;

  IF (NEW.destination_city IS NOT NULL AND NEW.destination_state IS NOT NULL) THEN
    SELECT c.id INTO v_resolved_dest_id
    FROM cities c
    WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(NEW.destination_city))
      AND UPPER(TRIM(c.state)) = UPPER(TRIM(NEW.destination_state))
    LIMIT 1;
    
    IF v_resolved_dest_id IS NOT NULL THEN
      IF NEW.destination_city_id IS NOT NULL AND NEW.destination_city_id != v_resolved_dest_id THEN
        INSERT INTO city_id_mismatch_logs (freight_id, field_name, city_name, state, wrong_city_id, correct_city_id, operation)
        VALUES (NEW.id, 'destination', NEW.destination_city, NEW.destination_state, NEW.destination_city_id, v_resolved_dest_id, TG_OP);
      END IF;
      NEW.destination_city_id := v_resolved_dest_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Notificação via pg_notify
CREATE OR REPLACE FUNCTION public.notify_city_id_mismatch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_notify('city_id_mismatch', json_build_object(
    'freight_id', NEW.freight_id,
    'field', NEW.field_name,
    'city', NEW.city_name,
    'state', NEW.state,
    'wrong_id', NEW.wrong_city_id,
    'correct_id', NEW.correct_city_id,
    'operation', NEW.operation,
    'at', NEW.corrected_at
  )::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_city_id_mismatch ON public.city_id_mismatch_logs;
CREATE TRIGGER trg_notify_city_id_mismatch
  AFTER INSERT ON public.city_id_mismatch_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_city_id_mismatch();

COMMENT ON TABLE public.city_id_mismatch_logs IS 'Registra correções automáticas de city_id em fretes. Cada registro = bug no frontend que enviou city_id errado. Monitoramento + alertas Telegram.';

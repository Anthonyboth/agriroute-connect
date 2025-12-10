-- =============================================
-- SISTEMA DE RASTREAMENTO GPS COM HISTÓRICO E CHAT AUTOMÁTICO
-- =============================================

-- 1. Tabela para histórico de localização de motoristas (360 dias)
CREATE TABLE IF NOT EXISTS public.driver_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  freight_id UUID REFERENCES freights(id) ON DELETE SET NULL,
  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  accuracy NUMERIC(10,2),
  speed NUMERIC(6,2),
  heading NUMERIC(6,2),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '360 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_location_history_driver ON driver_location_history(driver_profile_id);
CREATE INDEX IF NOT EXISTS idx_location_history_freight ON driver_location_history(freight_id);
CREATE INDEX IF NOT EXISTS idx_location_history_expires ON driver_location_history(expires_at);
CREATE INDEX IF NOT EXISTS idx_location_history_captured ON driver_location_history(captured_at DESC);

-- RLS para driver_location_history (somente sistema pode inserir)
ALTER TABLE driver_location_history ENABLE ROW LEVEL SECURITY;

-- Política: Sistema pode inserir (via service role)
CREATE POLICY "System can insert location history"
ON driver_location_history
FOR INSERT
WITH CHECK (true);

-- Política: Ninguém pode ler diretamente (apenas via funções)
CREATE POLICY "No direct read access"
ON driver_location_history
FOR SELECT
USING (false);

-- 2. Tabela para controlar último envio de localização no chat
CREATE TABLE IF NOT EXISTS public.location_chat_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES freights(id) ON DELETE CASCADE,
  driver_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_id UUID REFERENCES freight_messages(id) ON DELETE SET NULL,
  UNIQUE(freight_id, driver_profile_id)
);

-- RLS
ALTER TABLE location_chat_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage location chat log"
ON location_chat_log
FOR ALL
WITH CHECK (true);

-- 3. Função para enviar localização no chat a cada 30 minutos
CREATE OR REPLACE FUNCTION public.send_location_to_freight_chats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freight RECORD;
  v_last_sent TIMESTAMPTZ;
  v_message_id UUID;
  v_count INTEGER := 0;
  v_address TEXT;
BEGIN
  -- Buscar fretes em trânsito
  FOR v_freight IN 
    SELECT 
      f.id AS freight_id,
      f.driver_id,
      f.producer_id,
      f.current_lat,
      f.current_lng,
      f.company_id,
      p.full_name AS driver_name
    FROM freights f
    JOIN profiles p ON p.id = f.driver_id
    WHERE f.status = 'IN_TRANSIT'
      AND f.current_lat IS NOT NULL
      AND f.current_lng IS NOT NULL
  LOOP
    -- Verificar se já enviou mensagem nos últimos 30 minutos
    SELECT last_sent_at INTO v_last_sent
    FROM location_chat_log
    WHERE freight_id = v_freight.freight_id
      AND driver_profile_id = v_freight.driver_id;
    
    -- Se enviou há menos de 30 minutos, pular
    IF v_last_sent IS NOT NULL AND v_last_sent > (now() - INTERVAL '30 minutes') THEN
      CONTINUE;
    END IF;
    
    -- Criar mensagem de localização no chat do frete
    INSERT INTO freight_messages (
      freight_id,
      sender_id,
      message,
      message_type,
      location_lat,
      location_lng,
      location_address
    ) VALUES (
      v_freight.freight_id,
      v_freight.driver_id,
      '📍 Localização atualizada automaticamente',
      'location',
      v_freight.current_lat,
      v_freight.current_lng,
      'Lat: ' || ROUND(v_freight.current_lat::numeric, 6) || ', Lng: ' || ROUND(v_freight.current_lng::numeric, 6)
    )
    RETURNING id INTO v_message_id;
    
    -- Atualizar log de envio
    INSERT INTO location_chat_log (freight_id, driver_profile_id, last_sent_at, message_id)
    VALUES (v_freight.freight_id, v_freight.driver_id, now(), v_message_id)
    ON CONFLICT (freight_id, driver_profile_id)
    DO UPDATE SET last_sent_at = now(), message_id = v_message_id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'messages_sent', v_count,
    'executed_at', now()
  );
END;
$$;

-- 4. Função para limpar localizações antigas (mais de 360 dias)
CREATE OR REPLACE FUNCTION public.cleanup_old_location_history()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM driver_location_history
  WHERE expires_at < now()
  RETURNING COUNT(*) INTO v_deleted;
  
  RETURN jsonb_build_object(
    'success', true,
    'records_deleted', COALESCE(v_deleted, 0),
    'executed_at', now()
  );
END;
$$;

-- 5. Função para inserir localização no histórico
CREATE OR REPLACE FUNCTION public.insert_driver_location_history(
  p_driver_profile_id UUID,
  p_freight_id UUID,
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_accuracy NUMERIC DEFAULT NULL,
  p_speed NUMERIC DEFAULT NULL,
  p_heading NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO driver_location_history (
    driver_profile_id,
    freight_id,
    lat,
    lng,
    accuracy,
    speed,
    heading
  ) VALUES (
    p_driver_profile_id,
    p_freight_id,
    p_lat,
    p_lng,
    p_accuracy,
    p_speed,
    p_heading
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- 6. Atualizar texto do mural de avisos (remover frase sobre seguro)
UPDATE system_announcements 
SET message = 'A plataforma está disponível gratuitamente por um período indeterminado para que você possa testar e verificar seu valor.

Quando for o momento certo, implementaremos uma cobrança mensal ou percentual pelo uso da plataforma.

🚜 Aproveite o período de testes e conheça todos os recursos!

⚠️ Importante: Durante o período de testes, as transações financeiras não estão habilitadas dentro da plataforma. Os acordos de pagamento devem ser feitos externamente.',
    updated_at = now()
WHERE id = '806d45a8-9615-4c13-8b12-b2f98dc2f0a2';
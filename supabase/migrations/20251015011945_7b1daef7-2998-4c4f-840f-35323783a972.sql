-- Tabela para armazenar tokens de push notifications dos usuários
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id, endpoint)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(is_active);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Função para notificar motoristas quando frete é criado
CREATE OR REPLACE FUNCTION notify_matched_drivers_on_freight_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Disparar matching espacial via HTTP POST
  PERFORM
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/spatial-freight-matching',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'freight_id', NEW.id,
        'notify_drivers', true
      )
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que dispara quando frete é criado
DROP TRIGGER IF EXISTS on_freight_created_notify_drivers ON freights;
CREATE TRIGGER on_freight_created_notify_drivers
  AFTER INSERT ON freights
  FOR EACH ROW
  WHEN (NEW.status = 'OPEN')
  EXECUTE FUNCTION notify_matched_drivers_on_freight_creation();

-- Função para notificar prestadores quando serviço é criado
CREATE OR REPLACE FUNCTION notify_matched_providers_on_service_creation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/service-provider-spatial-matching',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'service_request_id', NEW.id,
        'notify_providers', true
      )
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que dispara quando serviço é criado
DROP TRIGGER IF EXISTS on_service_created_notify_providers ON service_requests;
CREATE TRIGGER on_service_created_notify_providers
  AFTER INSERT ON service_requests
  FOR EACH ROW
  WHEN (NEW.status = 'OPEN')
  EXECUTE FUNCTION notify_matched_providers_on_service_creation();
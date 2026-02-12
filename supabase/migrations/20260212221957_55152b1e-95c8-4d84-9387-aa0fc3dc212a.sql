
-- ============================================================
-- FIX: Notificação de avaliação SOMENTE após COMPLETED (pagamento confirmado)
-- Bug: Trigger disparava no status DELIVERED, antes do pagamento ser confirmado
-- Correção: Mudar gatilho de DELIVERED para COMPLETED
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_freight_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Frete aceito pelo motorista
  IF NEW.status = 'ACCEPTED' AND OLD.status != 'ACCEPTED' THEN
    IF NEW.producer_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.producer_id,
        'Motorista aceitou o frete',
        'Um motorista aceitou seu frete!',
        'freight_accepted',
        jsonb_build_object('freight_id', NEW.id)
      );
    END IF;
    IF NEW.driver_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.driver_id,
        'Frete aceito!',
        'Você aceitou o frete com sucesso',
        'freight_accepted',
        jsonb_build_object('freight_id', NEW.id)
      );
    END IF;
  END IF;
  
  -- ✅ CORREÇÃO: Avaliação SOMENTE após COMPLETED (pagamento confirmado)
  -- Anteriormente disparava em DELIVERED, causando notificação prematura
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
    IF NEW.driver_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.producer_id,
        'Avalie o motorista',
        'O frete foi concluído. Que tal avaliar o motorista?',
        'rating_pending',
        jsonb_build_object('freight_id', NEW.id, 'rated_user_id', NEW.driver_id)
      );
      
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.driver_id,
        'Avalie o produtor',
        'O frete foi concluído. Que tal avaliar o produtor?',
        'rating_pending',
        jsonb_build_object('freight_id', NEW.id, 'rated_user_id', NEW.producer_id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ============================================================
-- FIX: Tabela cities - restringir acesso a usuários autenticados
-- ============================================================

-- Remover políticas existentes que permitem acesso público
DROP POLICY IF EXISTS "Cities are viewable by everyone" ON public.cities;
DROP POLICY IF EXISTS "Anyone can view cities" ON public.cities;
DROP POLICY IF EXISTS "cities_select_all" ON public.cities;
DROP POLICY IF EXISTS "allow_public_read_cities" ON public.cities;

-- Criar política restritiva: somente autenticados
CREATE POLICY "Authenticated users can view cities"
ON public.cities FOR SELECT
TO authenticated
USING (true);

-- Bloquear acesso anônimo explicitamente
CREATE POLICY "Deny anonymous access to cities"
ON public.cities AS RESTRICTIVE FOR SELECT
TO anon
USING (false);

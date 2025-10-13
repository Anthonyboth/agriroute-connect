-- ============================================
-- FIX: Corrigir recursão RLS e criar funções seguras para marcar mensagens como lidas
-- ============================================

-- 1. DROPAR policy recursiva em freight_chat_participants
DROP POLICY IF EXISTS "Participantes veem outros participantes" ON public.freight_chat_participants;

-- 2. CRIAR nova policy sem recursão
CREATE POLICY "users_see_own_participation"
ON public.freight_chat_participants
FOR SELECT
TO authenticated
USING (
  participant_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
  AND is_active = true
);

-- 3. CRIAR função para marcar mensagens de frete como lidas (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.mark_freight_messages_as_read(p_freight_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_profile_id uuid;
  v_is_participant boolean;
BEGIN
  -- Obter profile do usuário autenticado
  SELECT id INTO v_current_profile_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_current_profile_id IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  -- Verificar se é participante ativo do frete
  SELECT EXISTS (
    SELECT 1
    FROM public.freight_chat_participants
    WHERE freight_id = p_freight_id
      AND participant_id = v_current_profile_id
      AND is_active = true
  ) INTO v_is_participant;

  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'Usuário não é participante deste frete';
  END IF;

  -- Marcar mensagens como lidas
  UPDATE public.freight_messages
  SET read_at = now()
  WHERE freight_id = p_freight_id
    AND sender_id != v_current_profile_id
    AND read_at IS NULL;
END;
$$;

-- 4. CRIAR função para marcar mensagens de serviço como lidas (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.mark_service_messages_as_read(p_service_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_profile_id uuid;
  v_is_participant boolean;
BEGIN
  -- Obter profile do usuário autenticado
  SELECT id INTO v_current_profile_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_current_profile_id IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  -- Verificar se é cliente ou prestador do serviço
  SELECT EXISTS (
    SELECT 1
    FROM public.service_requests
    WHERE id = p_service_request_id
      AND (client_id = v_current_profile_id OR provider_id = v_current_profile_id)
  ) INTO v_is_participant;

  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'Usuário não é participante deste serviço';
  END IF;

  -- Marcar mensagens como lidas
  UPDATE public.service_messages
  SET read_at = now()
  WHERE service_request_id = p_service_request_id
    AND sender_id != v_current_profile_id
    AND read_at IS NULL;
END;
$$;

-- 5. GRANT EXECUTE nas funções para authenticated
GRANT EXECUTE ON FUNCTION public.mark_freight_messages_as_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_service_messages_as_read(uuid) TO authenticated;

-- 6. Comentários explicativos
COMMENT ON FUNCTION public.mark_freight_messages_as_read IS 'Marca mensagens de frete como lidas de forma segura, validando participação do usuário';
COMMENT ON FUNCTION public.mark_service_messages_as_read IS 'Marca mensagens de serviço como lidas de forma segura, validando participação do usuário';
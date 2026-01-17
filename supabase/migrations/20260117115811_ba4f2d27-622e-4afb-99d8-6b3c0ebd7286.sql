-- =====================================================
-- CORREÇÃO DE POLÍTICAS RLS - freight_messages
-- Problemas identificados:
-- 1. Algumas policies usam role 'public' (anônimo) - RISCO DE SEGURANÇA
-- 2. Policies duplicadas com lógicas conflitantes
-- 3. Comparações incorretas sender_id = auth.uid() (deveria usar profile_id)
-- =====================================================

-- 1. Remover TODAS as policies existentes
DROP POLICY IF EXISTS "Participantes do chat veem mensagens" ON public.freight_messages;
DROP POLICY IF EXISTS "Participantes podem enviar mensagens" ON public.freight_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.freight_messages;
DROP POLICY IF EXISTS "freight_messages_delete_by_sender_or_producer" ON public.freight_messages;
DROP POLICY IF EXISTS "freight_messages_insert_sender_is_participant" ON public.freight_messages;
DROP POLICY IF EXISTS "freight_messages_select_participants" ON public.freight_messages;
DROP POLICY IF EXISTS "freight_messages_update_by_sender" ON public.freight_messages;

-- 2. Criar função helper para obter profile_id (se não existir)
CREATE OR REPLACE FUNCTION public.get_current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- 3. Política SELECT: Apenas participantes do frete podem ver mensagens
CREATE POLICY "freight_messages_select_participants"
ON public.freight_messages
FOR SELECT
TO authenticated
USING (
  -- O remetente pode ver suas próprias mensagens
  sender_id = public.get_current_profile_id()
  OR
  -- Participantes do frete podem ver mensagens
  EXISTS (
    SELECT 1 FROM public.freights f
    WHERE f.id = freight_messages.freight_id
    AND (
      f.producer_id = public.get_current_profile_id()
      OR f.driver_id = public.get_current_profile_id()
      OR EXISTS (
        SELECT 1 FROM public.freight_assignments fa
        WHERE fa.freight_id = f.id 
        AND fa.driver_id = public.get_current_profile_id()
      )
      -- Transportadora do frete (profile_id é o dono da transportadora)
      OR EXISTS (
        SELECT 1 FROM public.transport_companies tc
        WHERE tc.id = f.company_id
        AND tc.profile_id = public.get_current_profile_id()
      )
    )
  )
  OR
  -- Participantes ativos do chat
  EXISTS (
    SELECT 1 FROM public.freight_chat_participants fcp
    WHERE fcp.freight_id = freight_messages.freight_id
    AND fcp.participant_id = public.get_current_profile_id()
    AND fcp.is_active = true
  )
  OR
  -- Admin pode ver tudo
  public.has_role(auth.uid(), 'admin')
);

-- 4. Política INSERT: Apenas participantes podem enviar mensagens
CREATE POLICY "freight_messages_insert_participants"
ON public.freight_messages
FOR INSERT
TO authenticated
WITH CHECK (
  -- O sender_id deve ser o profile do usuário atual
  sender_id = public.get_current_profile_id()
  AND
  (
    -- Participantes do frete podem enviar
    EXISTS (
      SELECT 1 FROM public.freights f
      WHERE f.id = freight_messages.freight_id
      AND (
        f.producer_id = public.get_current_profile_id()
        OR f.driver_id = public.get_current_profile_id()
        OR EXISTS (
          SELECT 1 FROM public.freight_assignments fa
          WHERE fa.freight_id = f.id 
          AND fa.driver_id = public.get_current_profile_id()
        )
        OR EXISTS (
          SELECT 1 FROM public.transport_companies tc
          WHERE tc.id = f.company_id
          AND tc.profile_id = public.get_current_profile_id()
        )
      )
    )
    OR
    -- Participantes ativos do chat podem enviar
    EXISTS (
      SELECT 1 FROM public.freight_chat_participants fcp
      WHERE fcp.freight_id = freight_messages.freight_id
      AND fcp.participant_id = public.get_current_profile_id()
      AND fcp.is_active = true
    )
  )
);

-- 5. Política UPDATE: Apenas o remetente pode editar suas mensagens
CREATE POLICY "freight_messages_update_sender"
ON public.freight_messages
FOR UPDATE
TO authenticated
USING (
  sender_id = public.get_current_profile_id()
)
WITH CHECK (
  sender_id = public.get_current_profile_id()
);

-- 6. Política DELETE: Remetente ou produtor do frete pode excluir
CREATE POLICY "freight_messages_delete_sender_or_producer"
ON public.freight_messages
FOR DELETE
TO authenticated
USING (
  sender_id = public.get_current_profile_id()
  OR
  EXISTS (
    SELECT 1 FROM public.freights f
    WHERE f.id = freight_messages.freight_id
    AND f.producer_id = public.get_current_profile_id()
  )
  OR
  public.has_role(auth.uid(), 'admin')
);

-- 7. Adicionar comentário explicativo
COMMENT ON TABLE public.freight_messages IS 
'Mensagens privadas de chat entre participantes de um frete.
Dados protegidos por RLS:
- Apenas participantes do frete podem ver/enviar mensagens
- Participantes: produtor, motorista, motorista atribuído, transportadora, participantes do chat
- Apenas o remetente pode editar suas mensagens
- Remetente ou produtor podem excluir mensagens
- Admin tem acesso completo para auditoria';
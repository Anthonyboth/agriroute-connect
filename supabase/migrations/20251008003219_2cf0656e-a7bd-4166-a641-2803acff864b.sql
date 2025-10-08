-- Criar tabela de mensagens para service_requests (se não existir)
CREATE TABLE IF NOT EXISTS public.service_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'IMAGE')),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.service_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Usuários podem ver mensagens dos seus service_requests
CREATE POLICY "Users can view messages for their service requests"
ON public.service_messages
FOR SELECT
USING (
  service_request_id IN (
    SELECT id FROM public.service_requests
    WHERE client_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
       OR provider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = sender_id AND user_id = auth.uid())
);

-- Política para inserir mensagens
CREATE POLICY "Users can send messages for their service requests"
ON public.service_messages
FOR INSERT
WITH CHECK (
  sender_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND service_request_id IN (
    SELECT id FROM public.service_requests
    WHERE client_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
       OR provider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- Política para atualizar mensagens (marcar como lida)
CREATE POLICY "Users can update their own messages"
ON public.service_messages
FOR UPDATE
USING (sender_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Index para melhor performance
CREATE INDEX IF NOT EXISTS idx_service_messages_service_request ON public.service_messages(service_request_id);
CREATE INDEX IF NOT EXISTS idx_service_messages_sender ON public.service_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_service_messages_created_at ON public.service_messages(created_at DESC);
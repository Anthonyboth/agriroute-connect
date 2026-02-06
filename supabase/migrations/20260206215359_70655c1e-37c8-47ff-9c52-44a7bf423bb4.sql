-- Adicionar coluna delivered_at para confirmação de entrega
ALTER TABLE public.service_messages 
ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Índice para queries de mensagens não entregues
CREATE INDEX IF NOT EXISTS idx_service_messages_delivered 
ON public.service_messages(sender_id, delivered_at) 
WHERE delivered_at IS NULL;

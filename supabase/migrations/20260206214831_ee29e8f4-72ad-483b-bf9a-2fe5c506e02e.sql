-- Atualizar check constraint para aceitar todos os tipos de mídia
ALTER TABLE public.service_messages 
DROP CONSTRAINT service_messages_message_type_check;

ALTER TABLE public.service_messages 
ADD CONSTRAINT service_messages_message_type_check 
CHECK (message_type = ANY (ARRAY['TEXT'::text, 'IMAGE'::text, 'AUDIO'::text, 'VIDEO'::text, 'FILE'::text]));

-- Add COUNTER_PROPOSAL and PROPOSAL to freight_messages message_type check constraint
ALTER TABLE public.freight_messages DROP CONSTRAINT freight_messages_message_type_check;

ALTER TABLE public.freight_messages ADD CONSTRAINT freight_messages_message_type_check 
  CHECK (message_type = ANY (ARRAY['TEXT'::text, 'IMAGE'::text, 'VIDEO'::text, 'AUDIO'::text, 'FILE'::text, 'SYSTEM'::text, 'LOCATION_REQUEST'::text, 'LOCATION_RESPONSE'::text, 'COUNTER_PROPOSAL'::text, 'PROPOSAL'::text]));
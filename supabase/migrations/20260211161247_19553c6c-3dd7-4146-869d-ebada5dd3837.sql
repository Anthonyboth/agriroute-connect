-- Fix: allow rich media message types in freight chat
-- Existing check constraint blocks AUDIO/VIDEO/FILE message inserts

ALTER TABLE public.freight_messages
  DROP CONSTRAINT IF EXISTS freight_messages_message_type_check;

ALTER TABLE public.freight_messages
  ADD CONSTRAINT freight_messages_message_type_check
  CHECK (
    message_type = ANY (
      ARRAY[
        'TEXT'::text,
        'IMAGE'::text,
        'VIDEO'::text,
        'AUDIO'::text,
        'FILE'::text,
        'SYSTEM'::text,
        'LOCATION_REQUEST'::text,
        'LOCATION_RESPONSE'::text
      ]
    )
  );
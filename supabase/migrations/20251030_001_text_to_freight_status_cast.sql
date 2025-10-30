-- Migration: Text to freight_status Implicit Cast
-- Creates a conversion function and implicit cast to handle PT-BR labels and text inputs
-- Handles both CANCELED and CANCELLED spellings

-- Drop existing cast if it exists
DROP CAST IF EXISTS (text AS public.freight_status);

-- Create conversion function that maps PT-BR labels and synonyms to enum values
CREATE OR REPLACE FUNCTION public.text_to_freight_status(input_text TEXT)
RETURNS public.freight_status
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized_text TEXT;
  result public.freight_status;
BEGIN
  -- Return NULL for NULL input
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;

  -- Normalize: trim, uppercase, replace spaces and special chars
  normalized_text := UPPER(TRIM(input_text));
  normalized_text := REPLACE(normalized_text, ' ', '_');
  normalized_text := REPLACE(normalized_text, 'Â', 'A');
  normalized_text := REPLACE(normalized_text, 'Ã', 'A');
  normalized_text := REPLACE(normalized_text, 'É', 'E');
  normalized_text := REPLACE(normalized_text, 'Í', 'I');
  normalized_text := REPLACE(normalized_text, 'Ó', 'O');

  -- Handle PT-BR label mappings
  normalized_text := CASE normalized_text
    -- PT-BR labels to enum
    WHEN 'ABERTO' THEN 'OPEN'
    WHEN 'EM_NEGOCIACAO' THEN 'IN_NEGOTIATION'
    WHEN 'EM_NEGOCIAÇÃO' THEN 'IN_NEGOTIATION'
    WHEN 'ACEITO' THEN 'ACCEPTED'
    WHEN 'CARREGANDO' THEN 'LOADING'
    WHEN 'COLETANDO' THEN 'LOADING'
    WHEN 'CARREGADO' THEN 'LOADED'
    WHEN 'EM_TRANSPORTE' THEN 'IN_TRANSIT'
    WHEN 'EM_TRANSITO' THEN 'IN_TRANSIT'
    WHEN 'EM_TRÂNSITO' THEN 'IN_TRANSIT'
    WHEN 'AGUARDANDO_CONFIRMACAO' THEN 'DELIVERED_PENDING_CONFIRMATION'
    WHEN 'AGUARDANDO_CONFIRMAÇÃO' THEN 'DELIVERED_PENDING_CONFIRMATION'
    WHEN 'ENTREGUE' THEN 'DELIVERED'
    WHEN 'FINALIZADO' THEN 'COMPLETED'
    WHEN 'CONCLUIDO' THEN 'COMPLETED'
    WHEN 'CONCLUÍDO' THEN 'COMPLETED'
    WHEN 'CANCELADO' THEN 'CANCELLED'  -- PT-BR maps to CANCELLED
    WHEN 'CANCELED' THEN 'CANCELLED'   -- US spelling maps to CANCELLED
    WHEN 'REJEITADO' THEN 'REJECTED'
    WHEN 'PENDENTE' THEN 'PENDING'
    -- Alternative synonyms
    WHEN 'AGUARDANDO' THEN 'OPEN'
    WHEN 'NEGOCIANDO' THEN 'IN_NEGOTIATION'
    WHEN 'TRANSPORTE' THEN 'IN_TRANSIT'
    ELSE normalized_text
  END;

  -- Try to cast to enum (will raise exception if invalid)
  BEGIN
    result := normalized_text::public.freight_status;
    RETURN result;
  EXCEPTION WHEN OTHERS THEN
    -- Log error and raise with helpful message
    RAISE EXCEPTION 'Invalid freight status: "%". Expected values: OPEN, IN_NEGOTIATION, ACCEPTED, LOADING, LOADED, IN_TRANSIT, DELIVERED_PENDING_CONFIRMATION, DELIVERED, COMPLETED, CANCELLED, REJECTED, PENDING', input_text
      USING HINT = 'Check the status value or use a PT-BR label like "Em Trânsito", "Cancelado", etc.';
  END;
END;
$$;

-- Create implicit cast from text to freight_status
-- This allows PostgreSQL to automatically convert text to enum when needed
CREATE CAST (text AS public.freight_status)
  WITH FUNCTION public.text_to_freight_status(text)
  AS IMPLICIT;

-- Add helpful comment
COMMENT ON FUNCTION public.text_to_freight_status(text) IS
'Converts text to freight_status enum. Handles PT-BR labels (e.g., "Em Trânsito", "Cancelado") and synonyms (CANCELED/CANCELLED). Used by implicit cast.';

-- Notify PostgREST to reload schema and recognize new cast
SELECT pg_notify('pgrst', 'reload schema');

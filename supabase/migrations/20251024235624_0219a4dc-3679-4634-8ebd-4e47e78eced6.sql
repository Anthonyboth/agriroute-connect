-- Adicionar COMPLETED e OPEN aos status permitidos em freight_assignments
ALTER TABLE public.freight_assignments 
DROP CONSTRAINT IF EXISTS freight_assignments_status_check;

ALTER TABLE public.freight_assignments
ADD CONSTRAINT freight_assignments_status_check 
CHECK (status = ANY (ARRAY[
  'OPEN'::text,
  'ACCEPTED'::text, 
  'LOADING'::text, 
  'LOADED'::text, 
  'IN_TRANSIT'::text, 
  'DELIVERED_PENDING_CONFIRMATION'::text, 
  'DELIVERED'::text, 
  'COMPLETED'::text,
  'CANCELLED'::text
]));

-- Criar função que sincroniza status entre freights e freight_assignments
CREATE OR REPLACE FUNCTION public.sync_freight_assignment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.freight_assignments
    SET status = NEW.status::text,
        updated_at = now()
    WHERE freight_id = NEW.id
      AND status IS DISTINCT FROM NEW.status::text;
  END IF;
  RETURN NEW;
END;
$$;

-- Criar trigger para sincronizar automaticamente
DROP TRIGGER IF EXISTS trigger_sync_freight_assignment_status ON public.freights;
CREATE TRIGGER trigger_sync_freight_assignment_status
AFTER UPDATE OF status ON public.freights
FOR EACH ROW
EXECUTE FUNCTION public.sync_freight_assignment_status();

-- Corrigir o frete problemático imediatamente
UPDATE public.freight_assignments
SET status = 'COMPLETED',
    updated_at = now()
WHERE freight_id = '736e6a53-7bdc-4e67-b87a-44316ab0c35f'
  AND status != 'COMPLETED';
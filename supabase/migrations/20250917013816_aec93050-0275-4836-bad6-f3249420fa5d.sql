-- Add CANCELLED status to freight proposals if not exists
DO $$ 
BEGIN
    -- Check if the status already allows CANCELLED
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%freight_proposals_status%' 
        AND consrc LIKE '%CANCELLED%'
    ) THEN
        -- Assuming it's a text field with check constraint, let's allow CANCELLED status
        ALTER TABLE public.freight_proposals DROP CONSTRAINT IF EXISTS freight_proposals_status_check;
        ALTER TABLE public.freight_proposals ADD CONSTRAINT freight_proposals_status_check 
        CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'));
    END IF;
END $$;
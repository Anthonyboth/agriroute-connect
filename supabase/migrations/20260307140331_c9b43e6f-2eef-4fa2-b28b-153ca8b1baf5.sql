-- Drop the unconditional unique constraint that blocks re-submission after CANCELLED/REJECTED
ALTER TABLE public.freight_proposals DROP CONSTRAINT freight_proposals_freight_id_driver_id_key;

-- The partial unique index idx_unique_active_proposal already ensures 
-- only one PENDING/ACCEPTED proposal per driver per freight
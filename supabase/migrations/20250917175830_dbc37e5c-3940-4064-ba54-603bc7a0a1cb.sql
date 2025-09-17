-- Allow producers to update proposal status for their own freights
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE polname = 'Producers can update proposals for their freights'
      AND schemaname = 'public' AND tablename = 'freight_proposals'
  ) THEN
    CREATE POLICY "Producers can update proposals for their freights"
    ON public.freight_proposals
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1
        FROM public.freights f
        JOIN public.profiles p ON f.producer_id = p.id
        WHERE f.id = freight_proposals.freight_id
          AND p.user_id = auth.uid()
      ) OR is_admin()
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.freights f
        JOIN public.profiles p ON f.producer_id = p.id
        WHERE f.id = freight_proposals.freight_id
          AND p.user_id = auth.uid()
      ) OR is_admin()
    );
  END IF;
END $$;

-- Ensure trigger to keep accepted_trucks updated and manage freight status
DROP TRIGGER IF EXISTS trg_update_accepted_trucks_count ON public.freight_proposals;
CREATE TRIGGER trg_update_accepted_trucks_count
AFTER UPDATE OF status ON public.freight_proposals
FOR EACH ROW
EXECUTE FUNCTION public.update_accepted_trucks_count();
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE polname = 'Drivers can delete their own vehicles' 
      AND schemaname = 'public' 
      AND tablename = 'vehicles'
  ) THEN
    CREATE POLICY "Drivers can delete their own vehicles"
    ON public.vehicles
    FOR DELETE
    USING (
      driver_id IN (
        SELECT profiles.id FROM public.profiles WHERE profiles.user_id = auth.uid()
      )
    );
  END IF;
END
$$;
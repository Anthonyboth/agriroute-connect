-- Enable RLS on user tables that don't have it enabled yet
-- (Skipping system tables like spatial_ref_sys that we can't modify)

-- Enable RLS on ratings table if it exists and doesn't have RLS
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ratings' AND table_schema = 'public') THEN
    -- Check if RLS is already enabled
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = 'ratings' 
      AND schemaname = 'public' 
      AND rowsecurity = true
    ) THEN
      ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
      
      -- Create policies for ratings table
      CREATE POLICY "Users can view ratings for their freights" 
      ON public.ratings 
      FOR SELECT 
      USING (
        freight_id IN (
          SELECT f.id 
          FROM freights f 
          JOIN profiles p ON (f.producer_id = p.id OR f.driver_id = p.id)
          WHERE p.user_id = auth.uid()
        )
        OR is_admin()
      );

      CREATE POLICY "Users can create ratings for completed freights" 
      ON public.ratings 
      FOR INSERT 
      WITH CHECK (
        rater_id IN (
          SELECT p.id 
          FROM profiles p 
          WHERE p.user_id = auth.uid()
        )
        AND freight_id IN (
          SELECT f.id 
          FROM freights f 
          JOIN profiles p ON (f.producer_id = p.id OR f.driver_id = p.id)
          WHERE p.user_id = auth.uid() AND f.status = 'DELIVERED'
        )
      );

      CREATE POLICY "Users can update their own ratings" 
      ON public.ratings 
      FOR UPDATE 
      USING (
        rater_id IN (
          SELECT p.id 
          FROM profiles p 
          WHERE p.user_id = auth.uid()
        )
      );
    END IF;
  END IF;
END $$;

-- Enable RLS on service_providers table if it exists and doesn't have RLS
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_providers' AND table_schema = 'public') THEN
    -- Check if RLS is already enabled
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = 'service_providers' 
      AND schemaname = 'public' 
      AND rowsecurity = true
    ) THEN
      ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;
      
      -- Create policies for service_providers
      CREATE POLICY "Authenticated users can view service providers" 
      ON public.service_providers 
      FOR SELECT 
      USING (auth.role() = 'authenticated');

      CREATE POLICY "Users can create their own service provider profile" 
      ON public.service_providers 
      FOR INSERT 
      WITH CHECK (
        user_id IN (
          SELECT p.id 
          FROM profiles p 
          WHERE p.user_id = auth.uid() AND p.role = 'PRESTADOR_SERVICOS'
        )
      );

      CREATE POLICY "Users can update their own service provider profile" 
      ON public.service_providers 
      FOR UPDATE 
      USING (
        user_id IN (
          SELECT p.id 
          FROM profiles p 
          WHERE p.user_id = auth.uid()
        )
      );
    END IF;
  END IF;
END $$;

-- Enable RLS on plans table if it exists and doesn't have RLS
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plans' AND table_schema = 'public') THEN
    -- Check if RLS is already enabled
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = 'plans' 
      AND schemaname = 'public' 
      AND rowsecurity = true
    ) THEN
      ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
      
      -- Create policy for plans - allow authenticated users to view plans
      CREATE POLICY "Authenticated users can view subscription plans" 
      ON public.plans 
      FOR SELECT 
      USING (auth.role() = 'authenticated');
    END IF;
  END IF;
END $$;

-- Enable RLS on subscriptions table if it exists and doesn't have RLS
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions' AND table_schema = 'public') THEN
    -- Check if RLS is already enabled
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = 'subscriptions' 
      AND schemaname = 'public' 
      AND rowsecurity = true
    ) THEN
      ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
      
      -- Allow users to view their own subscriptions
      CREATE POLICY "Users can view their own subscriptions" 
      ON public.subscriptions 
      FOR SELECT 
      USING (
        user_id IN (
          SELECT p.id 
          FROM profiles p 
          WHERE p.user_id = auth.uid()
        )
        OR is_admin()
      );
      
      -- Allow users to manage their own subscriptions
      CREATE POLICY "Users can manage their own subscriptions" 
      ON public.subscriptions 
      FOR ALL 
      USING (
        user_id IN (
          SELECT p.id 
          FROM profiles p 
          WHERE p.user_id = auth.uid()
        )
        OR is_admin()
      )
      WITH CHECK (
        user_id IN (
          SELECT p.id 
          FROM profiles p 
          WHERE p.user_id = auth.uid()
        )
        OR is_admin()
      );
    END IF;
  END IF;
END $$;

-- Enable RLS on service_requests table if it exists and doesn't have RLS
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_requests' AND table_schema = 'public') THEN
    -- Check if RLS is already enabled
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = 'service_requests' 
      AND schemaname = 'public' 
      AND rowsecurity = true
    ) THEN
      ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Users can view relevant service requests" 
      ON public.service_requests 
      FOR SELECT 
      USING (
        requester_id IN (
          SELECT p.id 
          FROM profiles p 
          WHERE p.user_id = auth.uid()
        )
        OR provider_id IN (
          SELECT p.id 
          FROM profiles p 
          WHERE p.user_id = auth.uid()
        )
        OR is_admin()
      );
      
      CREATE POLICY "Users can create service requests" 
      ON public.service_requests 
      FOR INSERT 
      WITH CHECK (
        requester_id IN (
          SELECT p.id 
          FROM profiles p 
          WHERE p.user_id = auth.uid()
        )
      );
      
      CREATE POLICY "Users can update their own service requests" 
      ON public.service_requests 
      FOR UPDATE 
      USING (
        requester_id IN (
          SELECT p.id 
          FROM profiles p 
          WHERE p.user_id = auth.uid()
        )
        OR provider_id IN (
          SELECT p.id 
          FROM profiles p 
          WHERE p.user_id = auth.uid()
        )
        OR is_admin()
      );
    END IF;
  END IF;
END $$;
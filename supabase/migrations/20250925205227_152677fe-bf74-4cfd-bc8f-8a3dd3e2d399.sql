-- Enable RLS only on tables that actually exist

-- Check if each table exists and enable RLS
DO $$
BEGIN
  -- Core tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'freights') THEN
    ALTER TABLE public.freights ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'freight_proposals') THEN
    ALTER TABLE public.freight_proposals ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'freight_payments') THEN
    ALTER TABLE public.freight_payments ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Vehicle and service related tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicles') THEN
    ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_providers') THEN
    ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_requests') THEN
    ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Payment and subscription tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_subscriptions') THEN
    ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plans') THEN
    ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'driver_payout_requests') THEN
    ALTER TABLE public.driver_payout_requests ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Notification tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
  END IF;

  RAISE NOTICE 'RLS enabled on all existing tables';
END
$$;
-- Enable RLS and policies for user_devices and ensure unique device_id for UPSERTs

-- 1) Enable RLS
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- 2) Ensure unique index on device_id for ON CONFLICT in upserts
CREATE UNIQUE INDEX IF NOT EXISTS user_devices_device_id_key ON public.user_devices (device_id);

-- 3) Policies
-- Allow users to view their own devices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_devices' AND policyname = 'Users can view own devices'
  ) THEN
    CREATE POLICY "Users can view own devices"
    ON public.user_devices
    FOR SELECT
    USING (
      user_id IN (
        SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
      )
    );
  END IF;
END$$;

-- Allow users to insert their own devices (UPSERT insert path)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_devices' AND policyname = 'Users can insert own devices'
  ) THEN
    CREATE POLICY "Users can insert own devices"
    ON public.user_devices
    FOR INSERT
    WITH CHECK (
      user_id IN (
        SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
      )
    );
  END IF;
END$$;

-- Allow users to update their own devices (UPSERT update path + updates like last_active_at, permissions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_devices' AND policyname = 'Users can update own devices'
  ) THEN
    CREATE POLICY "Users can update own devices"
    ON public.user_devices
    FOR UPDATE
    USING (
      user_id IN (
        SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
      )
    )
    WITH CHECK (
      user_id IN (
        SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
      )
    );
  END IF;
END$$;
-- =========================================
-- Fix 1: user_devices RLS policies
-- =========================================

-- Enable RLS
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS users_insert_own_devices ON public.user_devices;
DROP POLICY IF EXISTS users_select_own_devices ON public.user_devices;
DROP POLICY IF EXISTS users_update_own_devices ON public.user_devices;
DROP POLICY IF EXISTS users_delete_own_devices ON public.user_devices;
DROP POLICY IF EXISTS users_claim_unowned_devices ON public.user_devices;
DROP POLICY IF EXISTS "Users can insert their devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can view their devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can update their devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can delete their devices" ON public.user_devices;
DROP POLICY IF EXISTS "Authenticated users can register devices" ON public.user_devices;

-- SELECT: view own devices
CREATE POLICY users_select_own_devices
ON public.user_devices
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

-- INSERT: allow inserting devices for current user's profile
CREATE POLICY users_insert_own_devices
ON public.user_devices
FOR INSERT
TO authenticated
WITH CHECK (
  user_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

-- UPDATE: update own devices
CREATE POLICY users_update_own_devices
ON public.user_devices
FOR UPDATE
TO authenticated
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

-- UPDATE: allow claiming unowned devices (legacy data)
CREATE POLICY users_claim_unowned_devices
ON public.user_devices
FOR UPDATE
TO authenticated
USING (
  user_id IS NULL
)
WITH CHECK (
  user_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

-- DELETE: delete own devices
CREATE POLICY users_delete_own_devices
ON public.user_devices
FOR DELETE
TO authenticated
USING (
  user_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

-- =========================================
-- Fix 2: freight_ratings UNIQUE constraint
-- =========================================

-- Ensure the correct UNIQUE constraint exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'freight_ratings_freight_id_rater_id_rating_type_key'
      AND conrelid = 'public.freight_ratings'::regclass
  ) THEN
    ALTER TABLE public.freight_ratings
    ADD CONSTRAINT freight_ratings_freight_id_rater_id_rating_type_key
    UNIQUE (freight_id, rater_id, rating_type);
  END IF;
END $$;
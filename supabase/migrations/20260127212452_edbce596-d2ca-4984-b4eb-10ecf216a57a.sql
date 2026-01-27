
-- ============================================
-- FIX: Restore permissions on identity_selfies table
-- The table had all permissions revoked, preventing upsert operations
-- RLS policies already restrict access to own records only
-- ============================================

-- Grant basic permissions to authenticated role (RLS handles the rest)
GRANT SELECT, INSERT, UPDATE ON public.identity_selfies TO authenticated;

-- Ensure anon still has no access
REVOKE ALL ON public.identity_selfies FROM anon;

-- Verify RLS is still enabled
ALTER TABLE public.identity_selfies ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they work with proper permissions
DROP POLICY IF EXISTS "users_can_insert_own_identity_selfie" ON public.identity_selfies;
DROP POLICY IF EXISTS "users_can_view_own_identity_selfie" ON public.identity_selfies;
DROP POLICY IF EXISTS "users_can_update_own_identity_selfie" ON public.identity_selfies;
DROP POLICY IF EXISTS "admins_can_manage_all_identity_selfies" ON public.identity_selfies;

-- Users can insert their own selfies
CREATE POLICY "users_can_insert_own_identity_selfie" 
ON public.identity_selfies 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Users can view their own selfies
CREATE POLICY "users_can_view_own_identity_selfie" 
ON public.identity_selfies 
FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Users can update their own selfies
CREATE POLICY "users_can_update_own_identity_selfie" 
ON public.identity_selfies 
FOR UPDATE 
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admins can manage all selfies
CREATE POLICY "admins_can_manage_all_identity_selfies" 
ON public.identity_selfies 
FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Create security definer function to check if a driver profile is visible to company owner
CREATE OR REPLACE FUNCTION public.is_driver_visible_for_company(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM company_drivers cd
    JOIN transport_companies tc ON cd.company_id = tc.id
    WHERE cd.driver_profile_id = _profile_id
      AND tc.profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
      AND cd.status = 'ACTIVE'
  );
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "profiles_select_own_company_or_admin" ON public.profiles;

-- Create new policy without recursion
CREATE POLICY "profiles_select_own_or_admin_or_company_driver" 
ON public.profiles 
FOR SELECT 
USING (
  user_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_driver_visible_for_company(id)
);
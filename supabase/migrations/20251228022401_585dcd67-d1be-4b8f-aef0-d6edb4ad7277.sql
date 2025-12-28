-- Policy 7: Business relationship - Company can see affiliated drivers
-- Using correct column: profile_id instead of owner_id
CREATE POLICY "Company can see affiliated driver profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_drivers cd
    JOIN public.transport_companies tc ON tc.id = cd.company_id
    WHERE cd.driver_profile_id = profiles.id
    AND tc.profile_id = auth.uid()
  )
);

-- Policy 8: Driver can see their company's owner profile
CREATE POLICY "Driver can see company owner profile"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_drivers cd
    JOIN public.transport_companies tc ON tc.id = cd.company_id
    WHERE tc.profile_id = profiles.id
    AND cd.driver_profile_id = auth.uid()
  )
);

-- Keep existing UPDATE/INSERT policies for own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);
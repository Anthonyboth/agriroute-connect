
-- Helper function in public schema to check if current user's company has an affiliated driver
-- identified by their user_id in the storage folder path
CREATE OR REPLACE FUNCTION public.is_company_owner_of_driver_storage(file_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM transport_companies tc
    INNER JOIN company_drivers cd ON cd.company_id = tc.id
    INNER JOIN profiles p ON p.id = cd.driver_profile_id
    WHERE tc.profile_id = (SELECT pr.id FROM profiles pr WHERE pr.user_id = auth.uid() LIMIT 1)
      AND p.user_id::text = (storage.foldername(file_name))[1]
      AND cd.status IN ('ACTIVE', 'INACTIVE', 'PENDING')
  );
$$;

-- Identity selfies: allow company owners to view their affiliated drivers' selfies
CREATE POLICY "Company owners can view affiliated driver selfies"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'identity-selfies'
    AND public.is_company_owner_of_driver_storage(name)
  );

-- Driver documents: allow company owners to view their affiliated drivers' documents  
CREATE POLICY "Company owners can view affiliated driver documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'driver-documents'
    AND public.is_company_owner_of_driver_storage(name)
  );

-- Profile photos: allow company owners to view their affiliated drivers' profile photos
CREATE POLICY "Company owners can view affiliated driver profile photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'profile-photos'
    AND public.is_company_owner_of_driver_storage(name)
  );

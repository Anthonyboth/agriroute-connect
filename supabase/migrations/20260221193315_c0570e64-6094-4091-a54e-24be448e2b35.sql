
-- Fix: identity-selfies has folder structure selfies/{user_id}/file
-- while driver-documents and profile-photos have {user_id}/file
-- We need to check both positions

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
      AND (
        p.user_id::text = (storage.foldername(file_name))[1]
        OR p.user_id::text = (storage.foldername(file_name))[2]
      )
      AND cd.status IN ('ACTIVE', 'INACTIVE', 'PENDING')
  );
$$;

-- Allow carriers to view service_requests assigned to their affiliated drivers
CREATE POLICY "carriers_view_affiliated_driver_services"
ON public.service_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM company_drivers cd
    JOIN transport_companies tc ON tc.id = cd.company_id
    WHERE cd.driver_profile_id = service_requests.provider_id
      AND cd.status = 'ACTIVE'
      AND tc.profile_id = get_my_profile_id()
  )
);
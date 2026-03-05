
REVOKE ALL ON public.driver_payout_requests FROM anon;

CREATE POLICY "Deny anon access to driver_payout_requests"
ON public.driver_payout_requests
AS RESTRICTIVE FOR ALL TO anon USING (false);

ALTER TABLE public.driver_payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers view own payout requests"
ON public.driver_payout_requests
FOR SELECT TO authenticated
USING (driver_id = get_my_profile_id());

CREATE POLICY "Drivers insert own payout requests"
ON public.driver_payout_requests
FOR INSERT TO authenticated
WITH CHECK (driver_id = get_my_profile_id());

CREATE POLICY "Drivers update own payout requests"
ON public.driver_payout_requests
FOR UPDATE TO authenticated
USING (driver_id = get_my_profile_id());

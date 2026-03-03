-- Fix: antt_price_sync_logs INSERT should be service_role only
DROP POLICY IF EXISTS "Service can insert sync logs" ON public.antt_price_sync_logs;

CREATE POLICY "service_role_insert_sync_logs"
ON public.antt_price_sync_logs FOR INSERT
TO service_role
WITH CHECK (true);

-- Fix: city_id_mismatch_logs INSERT should be service_role only  
DROP POLICY IF EXISTS "System can insert mismatch logs" ON public.city_id_mismatch_logs;

CREATE POLICY "service_role_insert_mismatch_logs"
ON public.city_id_mismatch_logs FOR INSERT
TO service_role
WITH CHECK (true);
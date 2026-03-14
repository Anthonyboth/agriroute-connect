-- Corrigir RLS do Autopay para mapear auth.uid() -> profiles.id
-- Evita 42501 ao inserir/upsert em autopay_settings/autopay_logs

-- autopay_settings
DROP POLICY IF EXISTS "Users manage own autopay" ON public.autopay_settings;
CREATE POLICY "Users manage own autopay"
ON public.autopay_settings
FOR ALL
TO authenticated
USING (profile_id = public.get_my_profile_id())
WITH CHECK (profile_id = public.get_my_profile_id());

-- autopay_logs
DROP POLICY IF EXISTS "Users read own autopay logs" ON public.autopay_logs;
CREATE POLICY "Users read own autopay logs"
ON public.autopay_logs
FOR SELECT
TO authenticated
USING (profile_id = public.get_my_profile_id());

DROP POLICY IF EXISTS "Users insert own autopay logs" ON public.autopay_logs;
CREATE POLICY "Users insert own autopay logs"
ON public.autopay_logs
FOR INSERT
TO authenticated
WITH CHECK (profile_id = public.get_my_profile_id());
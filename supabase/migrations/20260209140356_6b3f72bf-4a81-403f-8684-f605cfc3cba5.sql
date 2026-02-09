
-- ============================================================
-- FIX: Remove overly permissive INSERT/UPDATE policies
-- History/metrics tables: triggers use SECURITY DEFINER (bypass RLS)
-- so no INSERT policy is needed for regular users.
-- notifications: restrict INSERT so authenticated users can only
-- create notifications via system flows (edge functions use service_role).
-- ============================================================

-- 1. freight_assignment_history: DROP permissive INSERT
DROP POLICY IF EXISTS "System inserts assignment history" ON public.freight_assignment_history;

-- 2. freight_history: DROP permissive INSERT
DROP POLICY IF EXISTS "System inserts freight history" ON public.freight_history;

-- 3. operation_history: DROP permissive INSERT
DROP POLICY IF EXISTS "Sistema insere histórico via trigger" ON public.operation_history;

-- 4. reports_daily_metrics: DROP permissive INSERT and UPDATE
DROP POLICY IF EXISTS "Sistema insere métricas via trigger" ON public.reports_daily_metrics;
DROP POLICY IF EXISTS "Sistema atualiza métricas via trigger" ON public.reports_daily_metrics;

-- 5. service_request_history: DROP permissive INSERT
DROP POLICY IF EXISTS "System inserts service history" ON public.service_request_history;

-- 6. notifications: Replace permissive INSERT with a scoped one
--    Client-side code inserts notifications for other users as part of
--    business flows (freight accepted, affiliation approved, etc).
--    Edge functions use service_role which bypasses RLS.
--    We restrict to authenticated users only (already was) AND require
--    that user_id references a valid profile. This prevents inserting
--    notifications for non-existent users or injecting arbitrary data.
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

CREATE POLICY "Authenticated users can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  -- Ensure the target user_id exists in profiles
  EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = user_id
  )
);

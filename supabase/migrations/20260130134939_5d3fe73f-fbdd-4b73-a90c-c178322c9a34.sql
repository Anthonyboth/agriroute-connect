-- Fix: prevent authenticated users from reading other users' sensitive PII in public.profiles
-- Keep only owner/admin SELECT paths; public/non-owner reads must use the masked profiles_secure view instead.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- This policy allows non-owners (freight participants) to SELECT full rows from profiles,
-- which includes phone/CPF/address and document URLs. Remove it.
DROP POLICY IF EXISTS "profiles_select_freight_participants" ON public.profiles;
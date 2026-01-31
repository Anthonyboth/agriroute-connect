-- Fix login-blocking RLS recursion on public.profiles
--
-- Root cause: public.profiles has FORCE ROW LEVEL SECURITY enabled, so even SECURITY DEFINER helper
-- functions cannot safely read from public.profiles when those functions are used inside RLS policies
-- on public.profiles (leads to 42P17 infinite recursion).
--
-- Solution: keep RLS enabled, but remove FORCE so that SECURITY DEFINER helpers can read profiles
-- without re-entering the same RLS policy evaluation.

ALTER TABLE public.profiles NO FORCE ROW LEVEL SECURITY;
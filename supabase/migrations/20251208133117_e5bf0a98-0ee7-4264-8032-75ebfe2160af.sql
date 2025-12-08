-- Fix database error: Add UNIQUE constraint on (user_id, role) for ON CONFLICT to work

-- First, remove any duplicate profiles (keep the one created first by using created_at)
DELETE FROM public.profiles p1
USING public.profiles p2
WHERE p1.user_id = p2.user_id
  AND p1.role = p2.role
  AND p1.created_at > p2.created_at;

-- Create unique index on (user_id, role) 
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id_role 
ON public.profiles (user_id, role);
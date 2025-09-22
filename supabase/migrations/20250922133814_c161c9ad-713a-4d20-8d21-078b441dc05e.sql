-- Fix RLS on spatial_ref_sys table
-- This is a PostGIS system table that contains spatial reference system definitions
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all users to read spatial reference data
-- This is safe as it contains public geospatial reference information
CREATE POLICY "spatial_ref_sys_read_policy" 
ON public.spatial_ref_sys 
FOR SELECT 
USING (true);
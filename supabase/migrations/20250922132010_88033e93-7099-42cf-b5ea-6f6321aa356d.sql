-- Enable RLS on spatial_ref_sys table (PostGIS system table)
-- This table contains spatial reference system definitions and should be readable by all authenticated users
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all authenticated users to read spatial reference data
-- This is safe as it contains public geospatial reference information
CREATE POLICY "Allow read access to spatial reference data" 
ON public.spatial_ref_sys 
FOR SELECT 
USING (true);
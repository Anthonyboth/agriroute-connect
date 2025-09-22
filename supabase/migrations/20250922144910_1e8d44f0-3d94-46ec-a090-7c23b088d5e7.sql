-- Enable RLS on spatial_ref_sys table
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

-- Allow all users to read spatial reference system data (this is reference data)
CREATE POLICY "Anyone can read spatial reference systems" 
ON public.spatial_ref_sys 
FOR SELECT 
USING (true);
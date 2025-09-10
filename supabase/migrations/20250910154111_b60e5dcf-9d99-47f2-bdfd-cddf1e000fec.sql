-- Create storage buckets for document uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('driver-documents', 'driver-documents', false),
  ('profile-photos', 'profile-photos', false);

-- Add document fields to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS selfie_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS document_photo_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cnh_photo_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS truck_documents_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS truck_photo_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS license_plate_photo_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_proof_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_enabled BOOLEAN DEFAULT false;

-- Create RLS policies for driver documents bucket
CREATE POLICY "Users can upload their own driver documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'driver-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own driver documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'driver-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all driver documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'driver-documents' AND is_admin());

-- Create RLS policies for profile photos bucket
CREATE POLICY "Users can upload their own profile photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own profile photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view all profile photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'profile-photos');

CREATE POLICY "Admins can view all profile photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'profile-photos' AND is_admin());
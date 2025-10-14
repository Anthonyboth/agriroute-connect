-- Tornar o bucket profile-photos público para permitir acesso via getPublicUrl
UPDATE storage.buckets 
SET public = true 
WHERE id = 'profile-photos';
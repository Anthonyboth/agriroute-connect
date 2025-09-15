-- Adicionar colunas de documentação ao profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
ADD COLUMN IF NOT EXISTS document_rg_url TEXT,
ADD COLUMN IF NOT EXISTS document_cpf_url TEXT,
ADD COLUMN IF NOT EXISTS cnh_url TEXT,
ADD COLUMN IF NOT EXISTS address_proof_url TEXT,
ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES public.profiles(id);

-- Comentário sobre as colunas
COMMENT ON COLUMN public.profiles.profile_photo_url IS 'URL da foto de perfil do usuário';
COMMENT ON COLUMN public.profiles.document_rg_url IS 'URL do documento RG';
COMMENT ON COLUMN public.profiles.document_cpf_url IS 'URL do documento CPF';
COMMENT ON COLUMN public.profiles.cnh_url IS 'URL da CNH (para prestadores que precisam)';
COMMENT ON COLUMN public.profiles.address_proof_url IS 'URL do comprovante de endereço';
COMMENT ON COLUMN public.profiles.validation_status IS 'Status de validação: PENDING, APPROVED, REJECTED';
COMMENT ON COLUMN public.profiles.validated_at IS 'Data/hora da validação';
COMMENT ON COLUMN public.profiles.validated_by IS 'ID do admin que fez a validação';
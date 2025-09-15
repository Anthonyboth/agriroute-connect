-- Criar tabela para armazenar selfies com documentos para verificação de identidade
CREATE TABLE public.identity_selfies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  selfie_url TEXT NOT NULL,
  upload_method TEXT NOT NULL DEFAULT 'CAMERA', -- CAMERA ou GALLERY
  verification_status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
  verification_notes TEXT,
  verified_by UUID,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Garantir que cada usuário só tenha uma selfie ativa por vez
  CONSTRAINT unique_user_selfie UNIQUE (user_id)
);

-- Habilitar RLS na tabela
ALTER TABLE public.identity_selfies ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para identity_selfies
-- Usuários podem inserir suas próprias selfies
CREATE POLICY "users_can_insert_own_identity_selfie" 
ON public.identity_selfies 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
);

-- Usuários podem visualizar suas próprias selfies
CREATE POLICY "users_can_view_own_identity_selfie" 
ON public.identity_selfies 
FOR SELECT 
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
);

-- Usuários podem atualizar suas próprias selfies (caso precisem reenviar)
CREATE POLICY "users_can_update_own_identity_selfie" 
ON public.identity_selfies 
FOR UPDATE 
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-- Admins podem gerenciar todas as selfies (para verificação)
CREATE POLICY "admins_can_manage_all_identity_selfies" 
ON public.identity_selfies 
FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_identity_selfies_updated_at
BEFORE UPDATE ON public.identity_selfies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
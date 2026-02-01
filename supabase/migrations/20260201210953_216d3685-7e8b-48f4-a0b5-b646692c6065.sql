-- Adicionar política de UPDATE para fiscal_terms_acceptances
-- O upsert requer políticas tanto para INSERT quanto UPDATE

-- Primeiro, vamos verificar se a política já existe e recriá-la corretamente
DROP POLICY IF EXISTS "Users update own term acceptances" ON fiscal_terms_acceptances;

-- Criar política de UPDATE
CREATE POLICY "Users update own term acceptances" 
ON fiscal_terms_acceptances 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = fiscal_terms_acceptances.profile_id 
    AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = fiscal_terms_acceptances.profile_id 
    AND p.user_id = auth.uid()
  )
);
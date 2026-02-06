-- Bloquear explicitamente qualquer acesso anônimo à tabela profiles_encrypted_data
CREATE POLICY "anon_no_access_pii"
  ON public.profiles_encrypted_data
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

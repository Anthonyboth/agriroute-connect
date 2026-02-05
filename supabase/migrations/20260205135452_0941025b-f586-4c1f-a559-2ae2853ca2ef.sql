
-- ============================================================
-- PRODUÇÃO: RLS para emission_queue
-- Permite que usuários vejam apenas seus próprios itens de fila
-- ============================================================

-- Política para SELECT: usuário pode ver seus próprios itens de fila
CREATE POLICY "emission_queue_select_own"
  ON public.emission_queue
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.nfe_emissions ne
      WHERE ne.id = emission_queue.emission_id
      AND ne.created_by = auth.uid()
    )
  );

-- Política para UPDATE: usuário pode atualizar seus próprios itens (para retry manual)
CREATE POLICY "emission_queue_update_own"
  ON public.emission_queue
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.nfe_emissions ne
      WHERE ne.id = emission_queue.emission_id
      AND ne.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.nfe_emissions ne
      WHERE ne.id = emission_queue.emission_id
      AND ne.created_by = auth.uid()
    )
  );

-- Política para DELETE: usuário pode cancelar seus próprios itens da fila
CREATE POLICY "emission_queue_delete_own"
  ON public.emission_queue
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.nfe_emissions ne
      WHERE ne.id = emission_queue.emission_id
      AND ne.created_by = auth.uid()
    )
  );

-- INSERT é feito apenas pelo sistema via service_role
-- Não precisa de política para usuários autenticados


-- ==========================================
-- SECURITY FIX: freight_sanitary_documents + transport_companies
-- ==========================================

-- ============ freight_sanitary_documents ============
-- Fix all policies from {public} to {authenticated}
DROP POLICY IF EXISTS "Usuários podem ver documentos dos seus fretes" ON freight_sanitary_documents;
DROP POLICY IF EXISTS "Usuários podem inserir documentos nos seus fretes" ON freight_sanitary_documents;
DROP POLICY IF EXISTS "Usuários podem atualizar documentos dos seus fretes" ON freight_sanitary_documents;

-- Recreate with authenticated role and proper checks
CREATE POLICY "sanitary_docs_select_participant" ON freight_sanitary_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM freights f
      WHERE f.id = freight_sanitary_documents.freight_id
      AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
    )
    OR is_admin()
  );

CREATE POLICY "sanitary_docs_insert_participant" ON freight_sanitary_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM freights f
      WHERE f.id = freight_sanitary_documents.freight_id
      AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
    )
  );

CREATE POLICY "sanitary_docs_update_participant" ON freight_sanitary_documents
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM freights f
      WHERE f.id = freight_sanitary_documents.freight_id
      AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
    )
  );

-- Block anon access
CREATE POLICY "sanitary_docs_deny_anon" ON freight_sanitary_documents
  FOR ALL TO anon USING (false);

-- ============ transport_companies ============
-- Add anon deny
CREATE POLICY "transport_companies_deny_anon" ON transport_companies
  FOR ALL TO anon USING (false);

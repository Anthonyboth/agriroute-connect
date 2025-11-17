-- Adicionar colunas para compartilhamento de modelos entre empresa
ALTER TABLE freight_templates 
ADD COLUMN shared_with_company BOOLEAN DEFAULT false,
ADD COLUMN company_id UUID REFERENCES transport_companies(id);

CREATE INDEX idx_freight_templates_company ON freight_templates(company_id);
CREATE INDEX idx_freight_templates_shared ON freight_templates(shared_with_company) WHERE shared_with_company = true;

-- Atualizar RLS policies para permitir acesso a modelos compartilhados
DROP POLICY IF EXISTS "Users can view their own templates" ON freight_templates;

CREATE POLICY "Users can view their own and company shared templates" ON freight_templates
  FOR SELECT
  USING (
    producer_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR 
    (
      shared_with_company = true 
      AND company_id IN (
        SELECT company_id FROM profiles WHERE user_id = auth.uid() AND company_id IS NOT NULL
      )
    )
  );

-- Policy para inserir apenas próprios modelos
CREATE POLICY "Users can insert their own templates" ON freight_templates
  FOR INSERT
  WITH CHECK (producer_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Policy para atualizar apenas próprios modelos (não modelos compartilhados de outros)
CREATE POLICY "Users can update their own templates" ON freight_templates
  FOR UPDATE
  USING (producer_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Policy para deletar apenas próprios modelos
CREATE POLICY "Users can delete their own templates" ON freight_templates
  FOR DELETE
  USING (producer_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));
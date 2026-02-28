-- Fix RLS policies on freight_templates that cause "more than one row returned by subquery"
-- when a user has multiple profiles (e.g., MOTORISTA + PRODUTOR)

DROP POLICY IF EXISTS "Users can view their own and company shared templates" ON freight_templates;
DROP POLICY IF EXISTS "Users can insert their own templates" ON freight_templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON freight_templates;
DROP POLICY IF EXISTS "Users can delete their own templates" ON freight_templates;
DROP POLICY IF EXISTS "Producers can select own templates" ON freight_templates;
DROP POLICY IF EXISTS "Producers can insert own templates" ON freight_templates;
DROP POLICY IF EXISTS "Producers can update own templates" ON freight_templates;
DROP POLICY IF EXISTS "Producers can delete own templates" ON freight_templates;

CREATE POLICY "Users can view their own and company shared templates" ON freight_templates
  FOR SELECT
  USING (
    producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR (
      shared_with_company = true 
      AND company_id IN (
        SELECT company_id FROM company_drivers 
        WHERE driver_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        AND status = 'active'
      )
    )
  );

CREATE POLICY "Users can insert their own templates" ON freight_templates
  FOR INSERT
  WITH CHECK (producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own templates" ON freight_templates
  FOR UPDATE
  USING (producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own templates" ON freight_templates
  FOR DELETE
  USING (producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
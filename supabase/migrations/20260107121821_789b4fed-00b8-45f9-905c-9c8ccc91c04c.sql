-- Add manifestation_mode column to track assisted manifestations
ALTER TABLE nfe_documents 
ADD COLUMN IF NOT EXISTS manifestation_mode VARCHAR(20) DEFAULT 'assisted';

-- Add portal_redirect_at column to track when user was redirected to SEFAZ
ALTER TABLE nfe_documents 
ADD COLUMN IF NOT EXISTS portal_redirect_at TIMESTAMP WITH TIME ZONE;

-- Add user_declaration_at column to track when user declared manifestation complete
ALTER TABLE nfe_documents 
ADD COLUMN IF NOT EXISTS user_declaration_at TIMESTAMP WITH TIME ZONE;

-- Create fiscal_compliance_logs table for auditing
CREATE TABLE IF NOT EXISTS fiscal_compliance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action_type VARCHAR(50) NOT NULL,
  nfe_access_key VARCHAR(44),
  freight_id UUID REFERENCES freights(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on fiscal_compliance_logs
ALTER TABLE fiscal_compliance_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own logs
CREATE POLICY "Users can view their own compliance logs"
ON fiscal_compliance_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own logs
CREATE POLICY "Users can insert their own compliance logs"
ON fiscal_compliance_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create fiscal_responsibility_acceptances table
CREATE TABLE IF NOT EXISTS fiscal_responsibility_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  accepted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  term_version VARCHAR(10) DEFAULT '1.0'
);

-- Enable RLS
ALTER TABLE fiscal_responsibility_acceptances ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own acceptance
CREATE POLICY "Users can view their own acceptance"
ON fiscal_responsibility_acceptances
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own acceptance
CREATE POLICY "Users can insert their own acceptance"
ON fiscal_responsibility_acceptances
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_fiscal_compliance_logs_user_id ON fiscal_compliance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_compliance_logs_nfe_key ON fiscal_compliance_logs(nfe_access_key);
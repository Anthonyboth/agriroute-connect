-- Create financial_transactions table (if not exists due to previous run)
CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES transport_companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
  freight_id UUID REFERENCES freights(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_financial_transactions_company ON financial_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_freight ON financial_transactions(freight_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_created ON financial_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Companies can view own transactions" ON financial_transactions;
DROP POLICY IF EXISTS "Companies can insert own transactions" ON financial_transactions;
DROP POLICY IF EXISTS "Companies can update own transactions" ON financial_transactions;

-- RLS Policy: Companies can only view their own transactions
CREATE POLICY "Companies can view own transactions"
  ON financial_transactions
  FOR SELECT
  USING (
    company_id IN (
      SELECT id FROM transport_companies 
      WHERE profile_id = auth.uid()
    )
  );

-- RLS Policy: Companies can insert their own transactions
CREATE POLICY "Companies can insert own transactions"
  ON financial_transactions
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT id FROM transport_companies 
      WHERE profile_id = auth.uid()
    )
  );

-- RLS Policy: Companies can update their own transactions
CREATE POLICY "Companies can update own transactions"
  ON financial_transactions
  FOR UPDATE
  USING (
    company_id IN (
      SELECT id FROM transport_companies 
      WHERE profile_id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_financial_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS financial_transactions_updated_at ON financial_transactions;

CREATE TRIGGER financial_transactions_updated_at
  BEFORE UPDATE ON financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_financial_transactions_updated_at();

-- Add to realtime publication (ignore error if already exists)
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE financial_transactions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
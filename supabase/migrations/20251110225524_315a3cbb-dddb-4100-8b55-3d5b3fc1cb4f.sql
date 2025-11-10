-- ==============================================================================
-- PHASE 2: WHITELIST SYSTEM FOR TRUSTED ENTITIES
-- Allows marking IPs and users as trusted to reduce false positives
-- ==============================================================================

-- Create trusted_entities table
CREATE TABLE IF NOT EXISTS trusted_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('IP', 'USER', 'IP_RANGE')),
  entity_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  added_by UUID REFERENCES auth.users(id) NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(entity_type, entity_value)
);

-- Create indexes
CREATE INDEX idx_trusted_entities_type_value ON trusted_entities(entity_type, entity_value);
CREATE INDEX idx_trusted_entities_active ON trusted_entities(is_active) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE trusted_entities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage whitelist"
ON trusted_entities FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All authenticated can view active whitelist"
ON trusted_entities FOR SELECT
TO authenticated
USING (is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW()));

-- Create RPC function to check if entity is trusted
CREATE OR REPLACE FUNCTION is_trusted_entity(
  p_entity_type TEXT,
  p_entity_value TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM trusted_entities
    WHERE entity_type = p_entity_type
      AND entity_value = p_entity_value
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$;

COMMENT ON TABLE trusted_entities IS 'Stores trusted IPs, users, and IP ranges to reduce security false positives';
COMMENT ON FUNCTION is_trusted_entity IS 'Checks if an IP or user is in the trusted whitelist';
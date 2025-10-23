-- Remove 24h delay and enable chat immediately after approval
CREATE OR REPLACE FUNCTION enable_chat_after_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ACTIVE' AND (OLD.status = 'PENDING' OR OLD.status IS NULL) THEN
    NEW.chat_enabled_at = NOW();  -- Immediate instead of +24h
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update existing records that still have chat disabled
UPDATE company_drivers
SET chat_enabled_at = NOW()
WHERE status = 'ACTIVE' 
  AND (chat_enabled_at IS NULL OR chat_enabled_at > NOW());
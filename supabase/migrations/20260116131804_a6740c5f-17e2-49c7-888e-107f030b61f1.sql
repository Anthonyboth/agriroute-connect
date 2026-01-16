-- Add test credits to fiscal wallet for testing purposes
UPDATE public.fiscal_wallet 
SET 
  available_balance = 10, 
  total_credited = 10,
  last_credit_at = now(),
  updated_at = now()
WHERE issuer_id = '0016a4f9-4371-4b00-b215-e6293c7fcb52';
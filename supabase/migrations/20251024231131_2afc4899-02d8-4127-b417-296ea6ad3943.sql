
-- Atualizar frete para status COMPLETED
UPDATE freights 
SET 
  status = 'COMPLETED', 
  tracking_status = 'COMPLETED',
  updated_at = NOW()
WHERE id = '736e6a53-7bdc-4e67-b87a-44316ab0c35f';

-- Remover solicitações de fretes de teste criadas durante desenvolvimento
DELETE FROM freights 
WHERE id IN (
  '12305dda-ffa1-4eb9-9d7e-c6f7f9239e73',
  'a8d27eb2-32fc-410a-a991-2d2aa57f0d29'
);

-- Também limpar registros relacionados se existirem
DELETE FROM freight_proposals WHERE freight_id IN (
  '12305dda-ffa1-4eb9-9d7e-c6f7f9239e73',
  'a8d27eb2-32fc-410a-a991-2d2aa57f0d29'
);

DELETE FROM freight_messages WHERE freight_id IN (
  '12305dda-ffa1-4eb9-9d7e-c6f7f9239e73',
  'a8d27eb2-32fc-410a-a991-2d2aa57f0d29'
);

DELETE FROM freight_matches WHERE freight_id IN (
  '12305dda-ffa1-4eb9-9d7e-c6f7f9239e73',
  'a8d27eb2-32fc-410a-a991-2d2aa57f0d29'
);
-- Aprovar a transportadora RS Transportes que ficou pendente
UPDATE transport_companies 
SET status = 'APPROVED', approved_at = NOW(), updated_at = NOW()
WHERE profile_id = '06812bbb-212e-4b4c-b4f2-2fc16f9094c5' 
AND status = 'PENDING';

-- Comentário: A partir de agora, o AutomaticApprovalService vai aprovar 
-- automaticamente transport_companies quando a role for TRANSPORTADORA
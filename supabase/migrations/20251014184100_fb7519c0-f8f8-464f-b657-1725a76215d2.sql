-- ============================================
-- LIMPEZA COMPLETA DO BANCO DE DADOS
-- Remove todos os dados de teste mantendo a estrutura
-- ============================================

-- 1. Mensagens e interações
DELETE FROM freight_messages;
DELETE FROM service_messages;
DELETE FROM company_internal_messages;
DELETE FROM freight_chat_participants;
DELETE FROM notifications;

-- 2. Financeiro
DELETE FROM freight_payments;
DELETE FROM service_payments;
DELETE FROM external_payments;
DELETE FROM freight_advances;
DELETE FROM driver_payouts;
DELETE FROM driver_payout_requests;
DELETE FROM driver_withdrawals;
DELETE FROM balance_transactions;

-- 3. Fretes e Serviços
DELETE FROM freight_proposals;
DELETE FROM flexible_freight_proposals;
DELETE FROM freight_assignments;
DELETE FROM freight_checkins;
DELETE FROM freight_attachments;
DELETE FROM freight_ratings;
DELETE FROM freights;

DELETE FROM service_ratings;
DELETE FROM service_matches;
DELETE FROM service_requests;

-- 4. Localização e áreas
DELETE FROM driver_service_areas;
DELETE FROM service_provider_areas;
DELETE FROM user_cities;
DELETE FROM driver_availability;

-- 5. Transportadoras e motoristas
DELETE FROM company_vehicle_assignments;
DELETE FROM company_drivers;
DELETE FROM company_invites;
DELETE FROM convites_motoristas;
DELETE FROM vehicles;

-- 6. Empresas
DELETE FROM transport_companies;

-- 7. Limites e controles
DELETE FROM driver_notification_limits;
DELETE FROM provider_notification_limits;

-- 8. Eventos e emergências
DELETE FROM emergency_events;
DELETE FROM incident_logs;
DELETE FROM evidence_files;

-- 9. Stripe
DELETE FROM driver_stripe_accounts;

-- 10. Limpar rate limits e logs
DELETE FROM api_rate_limits;
DELETE FROM audit_logs;
DELETE FROM financial_audit_logs;

-- 11. Usuários (cascata para auth.users)
-- CUIDADO: Isso vai deletar todos os usuários e cascatear para auth.users
DELETE FROM profiles;

-- 12. Validar limpeza - Retornar contagem de registros nas tabelas principais
SELECT 
  'profiles' as tabela, COUNT(*) as registros FROM profiles
UNION ALL
SELECT 'freights', COUNT(*) FROM freights
UNION ALL
SELECT 'service_requests', COUNT(*) FROM service_requests
UNION ALL
SELECT 'transport_companies', COUNT(*) FROM transport_companies
UNION ALL
SELECT 'freight_proposals', COUNT(*) FROM freight_proposals
UNION ALL
SELECT 'vehicles', COUNT(*) FROM vehicles
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'freight_messages', COUNT(*) FROM freight_messages;

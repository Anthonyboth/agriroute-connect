
-- =============================================
-- LIMPEZA GERAL DO AGRIROUTE - VERSÃO FINAL
-- =============================================
-- Sem manipulação de triggers

-- =============================================
-- FASE 1: TABELAS RELACIONADAS A FRETES
-- =============================================

DELETE FROM livestock_freight_compliance;
DELETE FROM freight_sanitary_documents;
DELETE FROM freight_ratings;
DELETE FROM freight_feedback;
DELETE FROM freight_advances;
DELETE FROM freight_payments;
DELETE FROM freight_payment_deadlines;
DELETE FROM flexible_freight_proposals;
DELETE FROM freight_proposals;
DELETE FROM freight_matches;
DELETE FROM freight_assignments;
DELETE FROM freight_messages;
DELETE FROM freight_chat_participants;
DELETE FROM freight_attachments;
DELETE FROM freight_route_history;
DELETE FROM freight_eta_history;
DELETE FROM freight_status_history;
DELETE FROM freight_events;
DELETE FROM freight_checkins;
DELETE FROM driver_checkins;
DELETE FROM freight_delay_alerts;
DELETE FROM freight_alerts;
DELETE FROM freight_stops;
DELETE FROM freight_templates;
DELETE FROM freights;

-- =============================================
-- FASE 2: TABELAS DE SERVIÇOS
-- =============================================

DELETE FROM service_ratings;
DELETE FROM service_payments;
DELETE FROM service_request_matches;
DELETE FROM service_matches;
DELETE FROM service_messages;
DELETE FROM urban_service_requests;
DELETE FROM service_requests;

-- =============================================
-- FASE 3: TABELAS DE MOTORISTAS
-- =============================================

DELETE FROM driver_badges;
DELETE FROM driver_rewards;
DELETE FROM driver_levels;
DELETE FROM driver_withdrawals;
DELETE FROM driver_payout_requests;
DELETE FROM driver_payouts;
DELETE FROM driver_expenses;
DELETE FROM driver_location_history;
DELETE FROM affiliated_drivers_tracking;
DELETE FROM driver_availability;
DELETE FROM driver_service_areas;
DELETE FROM driver_notification_limits;

-- =============================================
-- FASE 4: TABELAS DE PRESTADORES
-- =============================================

DELETE FROM service_provider_payouts;
DELETE FROM service_provider_payout_requests;
DELETE FROM service_provider_areas;
DELETE FROM urban_service_providers;

-- =============================================
-- FASE 5: NOTIFICAÇÕES E LOGS
-- =============================================

DELETE FROM notifications;

-- =============================================
-- FASE 6: COMUNICAÇÃO EMPRESA-MOTORISTA
-- =============================================

DELETE FROM company_driver_chats;
DELETE FROM company_internal_messages;
DELETE FROM chat_typing_indicators;
DELETE FROM company_vehicle_assignments;
DELETE FROM company_invites;
DELETE FROM convites_motoristas;
DELETE FROM document_request_messages;
DELETE FROM document_requests;

-- =============================================
-- FASE 7: TABELAS FISCAIS
-- =============================================

DELETE FROM mdfe_logs;
DELETE FROM mdfe_veiculos;
DELETE FROM mdfe_documentos;
DELETE FROM mdfe_condutores;
DELETE FROM mdfe_manifestos;
DELETE FROM mdfe_config;
DELETE FROM nfe_documents;
DELETE FROM nfe_emissions;
DELETE FROM ctes;
DELETE FROM fiscal_wallet_transactions;
DELETE FROM fiscal_wallet;
DELETE FROM fiscal_responsibility_acceptances;
DELETE FROM fiscal_terms_acceptances;
DELETE FROM fiscal_compliance_logs;
DELETE FROM fiscal_certificates;
DELETE FROM fiscal_issuers;
DELETE FROM antifraud_nfe_events;
DELETE FROM fiscalizacao_logs;
DELETE FROM empresas_fiscais;

-- =============================================
-- FASE 8: VEÍCULOS E STRIPE
-- =============================================

DELETE FROM vehicles;
DELETE FROM driver_stripe_accounts;

-- =============================================
-- FASE 9: ASSOCIAÇÕES DE EMPRESAS
-- =============================================

DELETE FROM company_drivers;
DELETE FROM transport_companies;

-- =============================================
-- FASE 10: USER_ROLES E SALDOS
-- =============================================

DELETE FROM user_roles WHERE user_id IN (
  '3c75e966-eb39-46cc-8afe-0fd9ea41e0ac',
  '793bd36b-1b05-484c-8b3d-aceaf596fd98',
  '5cd7a639-d455-4d67-b281-ef41f3c7438a',
  '7b022a0d-ed43-4f2a-a9c1-0af71aa65f96',
  'd074324d-93f0-404c-8ccc-984c32819dc0',
  '271de0b8-8e53-4bef-b37e-77e21ded1ebd',
  '0e97bb71-16d8-49be-86ba-aa986047dbc0',
  '23a52846-412a-443a-b3d3-2add856c1360',
  'a8915728-de0b-4484-a9fc-5b695f45bfe1',
  '7f9dab74-39f4-4e30-aff2-ca440b158c5e',
  '8d49bae9-c98b-47bc-a0a1-0fdc29caac1d',
  '811c36c6-7f39-4aa3-afd8-b2ba79e0b215',
  '19bf2699-102f-493e-baad-b78f7d492334',
  '582e2ced-2311-4c2a-8b01-ae176800238c',
  'f58689c0-5617-48e9-912a-73fae7df9d22',
  '8fd75cda-883c-403a-9c1d-4548e1853d21'
);

DELETE FROM service_providers;
DELETE FROM service_provider_balances;
DELETE FROM balance_transactions;

-- =============================================
-- FASE 11: REMOVER PERFIS ESPECIFICADOS
-- =============================================

DELETE FROM profiles WHERE id IN (
  '00b28db9-bdf9-4641-b9e2-bd6cb1b31ee6',
  '0c215c96-ef3a-4105-9ff9-fb038312dd91',
  '0e3388b4-007a-4c99-9008-942ecbd62700',
  '1915a47d-cf24-478a-ac30-f176be8ef6f3',
  '38befd23-6ef4-4c86-8e79-c6af1d756cf5',
  '38d25c5f-df6c-4c07-be2e-50b5f51f6576',
  '3e6d05fd-3643-4711-bcf2-ad5f955e8d6a',
  'f8edff7e-a6cd-4682-bfa6-e592c2280b06',
  'd93be6b4-180a-49ed-84d0-f5e220e35190',
  '5298f6b3-4ccc-4215-bbea-389ac002e76c',
  '9a2f1a97-7171-4cd6-961a-7c0630b9573e',
  'c5dc4f08-0a2b-422a-9811-40232eff167a',
  'ca766d88-9928-4151-88f2-4474bd194e04',
  'd0c2c1cf-4d1e-4f7b-b2ab-d023c5f96f8b',
  'd35af314-0d4f-405b-ba03-1f68a1b5dd46',
  'c26452bf-db77-4ce5-aed4-6d9fdfedd82a'
);


-- Delete all data related to DELIVERED/COMPLETED/CANCELLED freights (test data cleanup)
-- Freight IDs to delete:
-- 3a39548c-213a-4b19-b6f2-d5b265518a4b (DELIVERED)
-- 720f3f36-e98b-4edf-a372-7a3c8ed5dc12 (DELIVERED)
-- 80d056ae-89c7-4356-9d99-a4a947e2fa4f (CANCELLED)
-- cdc92bc9-8d81-4960-b27f-2b14c178ce0a (CANCELLED)
-- e0e7d8f8-b79d-419e-a21e-0200976538a0 (DELIVERED)

DO $$
DECLARE
  freight_ids uuid[] := ARRAY[
    '3a39548c-213a-4b19-b6f2-d5b265518a4b',
    '720f3f36-e98b-4edf-a372-7a3c8ed5dc12',
    '80d056ae-89c7-4356-9d99-a4a947e2fa4f',
    'cdc92bc9-8d81-4960-b27f-2b14c178ce0a',
    'e0e7d8f8-b79d-419e-a21e-0200976538a0'
  ]::uuid[];
BEGIN
  -- Child tables (alphabetical, all referencing freight_id)
  DELETE FROM antifraud_feedback WHERE freight_id = ANY(freight_ids);
  DELETE FROM auto_confirm_logs WHERE freight_id = ANY(freight_ids);
  DELETE FROM compliance_audit_events WHERE freight_id = ANY(freight_ids);
  DELETE FROM driver_checkins WHERE freight_id = ANY(freight_ids);
  DELETE FROM driver_expenses WHERE freight_id = ANY(freight_ids);
  DELETE FROM driver_location_history WHERE freight_id = ANY(freight_ids);
  DELETE FROM driver_payouts WHERE freight_id = ANY(freight_ids);
  DELETE FROM driver_trip_progress WHERE freight_id = ANY(freight_ids);
  DELETE FROM emergency_events WHERE freight_id = ANY(freight_ids);
  DELETE FROM external_payments WHERE freight_id = ANY(freight_ids);
  DELETE FROM financial_transactions WHERE freight_id = ANY(freight_ids);
  DELETE FROM fiscal_compliance_logs WHERE freight_id = ANY(freight_ids);
  DELETE FROM fiscalizacao_logs WHERE freight_id = ANY(freight_ids);
  DELETE FROM flexible_freight_proposals WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_advances WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_alerts WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_assignment_history WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_attachments WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_chat_participants WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_checkins WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_delay_alerts WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_eta_history WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_events WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_feedback WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_history WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_matches WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_messages WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_payment_deadlines WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_payments WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_proposals WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_ratings WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_route_history WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_sanitary_documents WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_status_history WHERE freight_id = ANY(freight_ids);
  DELETE FROM freight_stops WHERE freight_id = ANY(freight_ids);
  DELETE FROM gta_assisted_drafts WHERE freight_id = ANY(freight_ids);
  DELETE FROM guest_freight_security_log WHERE freight_id = ANY(freight_ids);
  DELETE FROM incident_logs WHERE freight_id = ANY(freight_ids);
  DELETE FROM inspection_access_logs WHERE freight_id = ANY(freight_ids);
  DELETE FROM inspection_qr_codes WHERE freight_id = ANY(freight_ids);
  DELETE FROM livestock_freight_compliance WHERE freight_id = ANY(freight_ids);
  DELETE FROM location_chat_log WHERE freight_id = ANY(freight_ids);
  DELETE FROM loyalty_points WHERE freight_id = ANY(freight_ids);
  DELETE FROM mdfe_manifestos WHERE freight_id = ANY(freight_ids);
  DELETE FROM nfa_documents WHERE freight_id = ANY(freight_ids);
  DELETE FROM nfe_documents WHERE freight_id = ANY(freight_ids);
  DELETE FROM nfe_emissions WHERE freight_id = ANY(freight_ids);
  DELETE FROM offline_incidents WHERE freight_id = ANY(freight_ids);
  DELETE FROM payments WHERE freight_id = ANY(freight_ids);
  DELETE FROM ratings WHERE freight_id = ANY(freight_ids);
  DELETE FROM route_deviations WHERE freight_id = ANY(freight_ids);
  DELETE FROM stop_events WHERE freight_id = ANY(freight_ids);
  DELETE FROM subscription_fees WHERE freight_id = ANY(freight_ids);
  DELETE FROM tracking_consents WHERE freight_id = ANY(freight_ids);
  DELETE FROM trip_locations WHERE freight_id = ANY(freight_ids);
  DELETE FROM trip_progress_audit WHERE freight_id = ANY(freight_ids);
  
  -- Delete freight_assignments (has FK to freights)
  DELETE FROM freight_assignments WHERE freight_id = ANY(freight_ids);
  
  -- Also check for ctes and auditoria_eventos
  DELETE FROM ctes WHERE frete_id = ANY(freight_ids);
  DELETE FROM auditoria_eventos WHERE frete_id = ANY(freight_ids);
  
  -- Finally delete the freights themselves
  DELETE FROM freights WHERE id = ANY(freight_ids);
  
  RAISE NOTICE 'Cleaned up % test freights and all related data', array_length(freight_ids, 1);
END $$;

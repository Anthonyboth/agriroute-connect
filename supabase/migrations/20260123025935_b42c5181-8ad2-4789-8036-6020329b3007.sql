-- =============================================================================
-- SECURITY HARDENING: Fix 9 Critical Data Exposure Issues
-- Creates secure views with masked sensitive fields for client access
-- =============================================================================

-- =============================================================================
-- 1. BALANCE_TRANSACTIONS: Mask Stripe IDs for client access
-- =============================================================================

CREATE OR REPLACE VIEW public.balance_transactions_secure 
WITH (security_invoker = true)
AS
SELECT 
  id,
  provider_id,
  transaction_type,
  amount,
  balance_before,
  balance_after,
  status,
  description,
  reference_type,
  reference_id,
  created_at,
  updated_at,
  -- Mask Stripe identifiers
  CASE 
    WHEN stripe_payment_intent_id IS NOT NULL THEN CONCAT('pi_****', RIGHT(stripe_payment_intent_id, 4))
    ELSE NULL 
  END as stripe_payment_intent_id_masked,
  CASE 
    WHEN stripe_payout_id IS NOT NULL THEN CONCAT('po_****', RIGHT(stripe_payout_id, 4))
    ELSE NULL 
  END as stripe_payout_id_masked
FROM public.balance_transactions;

COMMENT ON VIEW public.balance_transactions_secure IS 'Secure view masking Stripe payment identifiers for client access';

-- =============================================================================
-- 2. FREIGHT_PAYMENTS: Mask payment processing data
-- =============================================================================

CREATE OR REPLACE VIEW public.freight_payments_secure 
WITH (security_invoker = true)
AS
SELECT 
  id,
  freight_id,
  payer_id,
  receiver_id,
  amount,
  payment_type,
  payment_method,
  status,
  completed_at,
  created_at,
  updated_at,
  -- Mask Stripe identifiers
  CASE 
    WHEN stripe_payment_intent_id IS NOT NULL THEN CONCAT('pi_****', RIGHT(stripe_payment_intent_id, 4))
    ELSE NULL 
  END as stripe_payment_intent_masked,
  CASE 
    WHEN stripe_session_id IS NOT NULL THEN CONCAT('cs_****', RIGHT(stripe_session_id, 4))
    ELSE NULL 
  END as stripe_session_masked,
  CASE 
    WHEN external_transaction_id IS NOT NULL THEN CONCAT('ext_****', RIGHT(external_transaction_id, 4))
    ELSE NULL 
  END as external_transaction_masked
FROM public.freight_payments;

COMMENT ON VIEW public.freight_payments_secure IS 'Secure view masking Stripe and external payment identifiers';

-- =============================================================================
-- 3. SERVICE_REQUESTS: Create view with masked contact info
-- =============================================================================

CREATE OR REPLACE VIEW public.service_requests_secure
WITH (security_invoker = true)
AS
SELECT 
  sr.id,
  sr.client_id,
  sr.provider_id,
  sr.service_type,
  sr.status,
  sr.urgency,
  sr.is_emergency,
  sr.preferred_datetime,
  sr.created_at,
  sr.updated_at,
  sr.accepted_at,
  sr.completed_at,
  sr.cancelled_at,
  sr.cancellation_reason,
  sr.location_city,
  sr.location_state,
  sr.city_name,
  sr.city_id,
  sr.state,
  sr.location_lat,
  sr.location_lng,
  sr.city_lat,
  sr.city_lng,
  sr.service_radius_km,
  sr.problem_description,
  sr.additional_info,
  sr.vehicle_info,
  sr.estimated_price,
  sr.final_price,
  sr.client_rating,
  sr.provider_rating,
  sr.client_comment,
  sr.provider_comment,
  sr.provider_notes,
  sr.reference_number,
  sr.prospect_user_id,
  -- Mask contact information for non-participants
  CASE 
    WHEN sr.client_id = auth.uid() OR sr.provider_id = auth.uid() THEN sr.contact_name
    ELSE CONCAT(LEFT(COALESCE(sr.contact_name, ''), 2), '***')
  END as contact_name_masked,
  CASE 
    WHEN sr.client_id = auth.uid() OR sr.provider_id = auth.uid() THEN sr.contact_phone
    ELSE CONCAT('(**)*****-', RIGHT(COALESCE(sr.contact_phone, '0000'), 4))
  END as contact_phone_masked,
  CASE 
    WHEN sr.client_id = auth.uid() OR sr.provider_id = auth.uid() THEN sr.contact_email
    WHEN sr.contact_email IS NOT NULL THEN CONCAT(LEFT(SPLIT_PART(sr.contact_email, '@', 1), 2), '***@', SPLIT_PART(sr.contact_email, '@', 2))
    ELSE NULL
  END as contact_email_masked,
  CASE 
    WHEN sr.client_id = auth.uid() OR sr.provider_id = auth.uid() THEN sr.contact_document
    ELSE '***.***.***-**'
  END as contact_document_masked,
  -- Mask address for non-participants
  CASE 
    WHEN sr.client_id = auth.uid() OR sr.provider_id = auth.uid() THEN sr.location_address
    ELSE CONCAT(LEFT(COALESCE(sr.location_address, ''), 10), '***')
  END as location_address_masked
FROM public.service_requests sr;

COMMENT ON VIEW public.service_requests_secure IS 'Secure view masking contact info and addresses for non-participants';

-- =============================================================================
-- 4. VEHICLES: Create view that protects document URLs
-- =============================================================================

CREATE OR REPLACE VIEW public.vehicles_secure
WITH (security_invoker = true)
AS
SELECT 
  v.id,
  v.driver_id,
  v.vehicle_type,
  v.license_plate,
  v.max_capacity_tons,
  v.axle_count,
  v.status,
  v.created_at,
  v.updated_at,
  v.vehicle_specifications,
  v.high_performance,
  v.company_id,
  v.is_company_vehicle,
  v.assigned_driver_id,
  v.last_inspection_date,
  v.crlv_expiry_date,
  v.insurance_expiry_date,
  v.vehicle_validation_status,
  v.primary_identification,
  v.vehicle_photo_url,
  v.vehicle_photos,
  -- Document URLs only visible to owner/admin
  CASE 
    WHEN v.driver_id = auth.uid() OR public.is_admin() THEN v.crlv_url
    ELSE NULL
  END as crlv_url,
  CASE 
    WHEN v.driver_id = auth.uid() OR public.is_admin() THEN v.insurance_document_url
    ELSE NULL
  END as insurance_document_url,
  CASE 
    WHEN v.driver_id = auth.uid() OR public.is_admin() THEN v.inspection_certificate_url
    ELSE NULL
  END as inspection_certificate_url,
  CASE 
    WHEN v.driver_id = auth.uid() OR public.is_admin() THEN v.vehicle_documents
    ELSE NULL
  END as vehicle_documents,
  -- Show document validity status without revealing URL
  CASE WHEN v.crlv_url IS NOT NULL THEN true ELSE false END as has_crlv,
  CASE WHEN v.insurance_document_url IS NOT NULL THEN true ELSE false END as has_insurance,
  CASE WHEN v.inspection_certificate_url IS NOT NULL THEN true ELSE false END as has_inspection
FROM public.vehicles v;

COMMENT ON VIEW public.vehicles_secure IS 'Secure view protecting document URLs, visible only to owner/admin';

-- =============================================================================
-- 5. IDENTITY_SELFIES: Create view that protects selfie URLs
-- =============================================================================

CREATE OR REPLACE VIEW public.identity_selfies_secure
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  created_at,
  updated_at,
  verification_status,
  verification_notes,
  verified_at,
  verified_by,
  upload_method,
  -- Only owner can see the actual selfie URL
  CASE 
    WHEN user_id = auth.uid() THEN selfie_url
    ELSE NULL
  END as selfie_url,
  -- Show verification status for admins without revealing URL
  CASE 
    WHEN public.is_admin() AND selfie_url IS NOT NULL THEN true 
    ELSE false 
  END as has_selfie_uploaded
FROM public.identity_selfies;

COMMENT ON VIEW public.identity_selfies_secure IS 'Secure view protecting selfie URLs from non-owners';

-- =============================================================================
-- 6. FISCAL_CERTIFICATES: Critical - Hide password_hash and storage paths
-- =============================================================================

CREATE OR REPLACE VIEW public.fiscal_certificates_secure
WITH (security_invoker = true)
AS
SELECT 
  fc.id,
  fc.issuer_id,
  fc.certificate_type,
  fc.valid_from,
  fc.valid_until,
  fc.is_valid,
  fc.is_expired,
  fc.created_at,
  fc.updated_at,
  fc.status,
  fc.subject_cn,
  fc.issuer_cn,
  fc.serial_number,
  fc.subject_document,
  fc.usage_count,
  fc.last_used_at,
  fc.uploaded_at,
  fc.purchased_via_platform,
  -- NEVER expose password_hash, storage_path, or encryption_key_id
  CASE WHEN fc.storage_path IS NOT NULL THEN true ELSE false END as certificate_uploaded,
  -- Calculate days until expiration
  CASE 
    WHEN fc.valid_until IS NOT NULL THEN (fc.valid_until::date - CURRENT_DATE)
    ELSE NULL
  END as days_until_expiration
FROM public.fiscal_certificates fc
WHERE EXISTS (
  SELECT 1 FROM public.fiscal_issuers fi 
  WHERE fi.id = fc.issuer_id AND fi.profile_id = auth.uid()
);

COMMENT ON VIEW public.fiscal_certificates_secure IS 'Secure view hiding password_hash and storage_path from all clients';

-- =============================================================================
-- 7. DRIVER_LOCATION_HISTORY: Add time-based access restrictions
-- =============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "System can insert location history" ON public.driver_location_history;
DROP POLICY IF EXISTS "No direct read access" ON public.driver_location_history;
DROP POLICY IF EXISTS "driver_location_history_service_insert" ON public.driver_location_history;
DROP POLICY IF EXISTS "driver_location_history_owner_select" ON public.driver_location_history;
DROP POLICY IF EXISTS "driver_location_insert_restricted" ON public.driver_location_history;
DROP POLICY IF EXISTS "driver_location_select_restricted" ON public.driver_location_history;
DROP POLICY IF EXISTS "freight_producer_location_access" ON public.driver_location_history;

-- Create stricter INSERT policy
CREATE POLICY "driver_location_insert_restricted" ON public.driver_location_history
FOR INSERT WITH CHECK (driver_profile_id = auth.uid());

-- Create time-restricted SELECT policy (7 days for owner)
CREATE POLICY "driver_location_select_restricted" ON public.driver_location_history
FOR SELECT USING (
  driver_profile_id = auth.uid() 
  AND captured_at > (NOW() - INTERVAL '7 days')
);

-- Create policy for freight producers to see current freight location (24h)
-- Using uppercase enum values for freight_status
CREATE POLICY "freight_producer_location_access" ON public.driver_location_history
FOR SELECT USING (
  freight_id IS NOT NULL 
  AND captured_at > (NOW() - INTERVAL '24 hours')
  AND EXISTS (
    SELECT 1 FROM public.freights f 
    WHERE f.id = driver_location_history.freight_id 
    AND f.producer_id = auth.uid()
    AND f.status IN ('ACCEPTED'::freight_status, 'IN_TRANSIT'::freight_status, 'LOADING'::freight_status)
  )
);

COMMENT ON TABLE public.driver_location_history IS 'Location history with 7-day client access limit for security';

-- =============================================================================
-- 8. PROFILES_ENCRYPTED_DATA: Add documentation
-- =============================================================================

COMMENT ON TABLE public.profiles_encrypted_data IS 'PII encrypted with AES-256. INSERT/DELETE via triggers only. SELECT restricted to owner.';

-- =============================================================================
-- 9. Additional hardening: Revoke/Grant permissions
-- =============================================================================

REVOKE SELECT ON public.fiscal_certificates FROM anon;
REVOKE SELECT ON public.identity_selfies FROM anon;
REVOKE SELECT ON public.driver_location_history FROM anon;
REVOKE SELECT ON public.balance_transactions FROM anon;
REVOKE SELECT ON public.freight_payments FROM anon;

GRANT SELECT ON public.balance_transactions_secure TO authenticated;
GRANT SELECT ON public.freight_payments_secure TO authenticated;
GRANT SELECT ON public.service_requests_secure TO authenticated;
GRANT SELECT ON public.vehicles_secure TO authenticated;
GRANT SELECT ON public.identity_selfies_secure TO authenticated;
GRANT SELECT ON public.fiscal_certificates_secure TO authenticated;
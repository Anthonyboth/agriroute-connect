-- ============================================
-- P0 SECURITY HARDENING MIGRATION (CORRECTED)
-- Fix storage buckets and sensitive table access
-- ============================================

-- ============================================
-- 1. MAKE SENSITIVE STORAGE BUCKETS PRIVATE
-- ============================================

UPDATE storage.buckets SET public = false WHERE id = 'driver-documents';
UPDATE storage.buckets SET public = false WHERE id = 'chat-images';
UPDATE storage.buckets SET public = false WHERE id = 'chat-files';
UPDATE storage.buckets SET public = false WHERE id = 'proposal-chat-images';
UPDATE storage.buckets SET public = false WHERE id = 'proposal-chat-files';
UPDATE storage.buckets SET public = false WHERE id = 'service-chat-images';
UPDATE storage.buckets SET public = false WHERE id = 'chat-interno-images';

-- ============================================
-- 2. DROP OVERLY PERMISSIVE STORAGE POLICIES
-- ============================================

DROP POLICY IF EXISTS "driver_documents_public_view" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view driver documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view driver documents" ON storage.objects;
DROP POLICY IF EXISTS "Imagens de chat são públicas" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view chat images" ON storage.objects;
DROP POLICY IF EXISTS "chat_images_public_view" ON storage.objects;
DROP POLICY IF EXISTS "Arquivos de chat são públicos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view chat files" ON storage.objects;
DROP POLICY IF EXISTS "chat_files_public_view" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view proposal chat images" ON storage.objects;
DROP POLICY IF EXISTS "proposal_chat_images_public_view" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view proposal chat files" ON storage.objects;
DROP POLICY IF EXISTS "proposal_chat_files_public_view" ON storage.objects;

-- ============================================
-- 3. CREATE OWNERSHIP-BASED STORAGE POLICIES
-- ============================================

DROP POLICY IF EXISTS "driver_documents_owner_select" ON storage.objects;
CREATE POLICY "driver_documents_owner_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'driver-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "chat_images_authenticated_select" ON storage.objects;
CREATE POLICY "chat_images_authenticated_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-images' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "chat_files_authenticated_select" ON storage.objects;
CREATE POLICY "chat_files_authenticated_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-files' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "proposal_chat_images_authenticated_select" ON storage.objects;
CREATE POLICY "proposal_chat_images_authenticated_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'proposal-chat-images' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "proposal_chat_files_authenticated_select" ON storage.objects;
CREATE POLICY "proposal_chat_files_authenticated_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'proposal-chat-files' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "service_chat_images_authenticated_select" ON storage.objects;
CREATE POLICY "service_chat_images_authenticated_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'service-chat-images' AND auth.uid() IS NOT NULL);

-- ============================================
-- 4. HARDEN balance_transactions TABLE
-- ============================================

DROP POLICY IF EXISTS "balance_transactions_select_policy" ON public.balance_transactions;
DROP POLICY IF EXISTS "Users can view their transactions" ON public.balance_transactions;
DROP POLICY IF EXISTS "Anyone can view transactions" ON public.balance_transactions;

REVOKE SELECT ON public.balance_transactions FROM authenticated;
REVOKE SELECT ON public.balance_transactions FROM anon;

DROP POLICY IF EXISTS "balance_transactions_owner_only" ON public.balance_transactions;
CREATE POLICY "balance_transactions_owner_only"
ON public.balance_transactions FOR SELECT TO authenticated
USING (
  provider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- ============================================
-- 5. HARDEN fiscal_certificates TABLE
-- ============================================

DROP POLICY IF EXISTS "fiscal_certificates_select_policy" ON public.fiscal_certificates;
DROP POLICY IF EXISTS "Anyone can view certificates" ON public.fiscal_certificates;
REVOKE SELECT ON public.fiscal_certificates FROM authenticated;
REVOKE SELECT ON public.fiscal_certificates FROM anon;

-- ============================================
-- 6. HARDEN identity_selfies TABLE
-- ============================================

DROP POLICY IF EXISTS "identity_selfies_public_select" ON public.identity_selfies;
DROP POLICY IF EXISTS "Anyone can view selfies" ON public.identity_selfies;
REVOKE SELECT ON public.identity_selfies FROM authenticated;
REVOKE SELECT ON public.identity_selfies FROM anon;

-- ============================================
-- 7. HARDEN driver_location_history TABLE
-- ============================================

DROP POLICY IF EXISTS "driver_location_public_select" ON public.driver_location_history;
DROP POLICY IF EXISTS "Anyone can view location" ON public.driver_location_history;
REVOKE SELECT ON public.driver_location_history FROM authenticated;
REVOKE SELECT ON public.driver_location_history FROM anon;

DROP POLICY IF EXISTS "driver_location_owner_or_producer" ON public.driver_location_history;
CREATE POLICY "driver_location_owner_or_producer"
ON public.driver_location_history FOR SELECT TO authenticated
USING (
  driver_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR (
    freight_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.freights f
      WHERE f.id = driver_location_history.freight_id
      AND f.producer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      AND f.status NOT IN ('COMPLETED', 'CANCELLED', 'DELIVERED')
    )
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- ============================================
-- 8. HARDEN freight_payments TABLE
-- ============================================

DROP POLICY IF EXISTS "freight_payments_public_select" ON public.freight_payments;
DROP POLICY IF EXISTS "Anyone can view payments" ON public.freight_payments;
REVOKE SELECT ON public.freight_payments FROM authenticated;
REVOKE SELECT ON public.freight_payments FROM anon;

-- ============================================
-- 9. HARDEN service_requests CONTACT DATA
-- ============================================

DROP VIEW IF EXISTS public.service_requests_secure;
CREATE VIEW public.service_requests_secure
WITH (security_invoker = true) AS
SELECT
  id, service_type, status, created_at, updated_at, preferred_datetime,
  location_city, location_state, location_lat, location_lng,
  problem_description, additional_info, urgency, is_emergency, vehicle_info,
  estimated_price, final_price, accepted_at, completed_at, cancelled_at,
  cancellation_reason, client_id, provider_id, location_address, reference_number,
  CASE 
    WHEN client_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR provider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    THEN contact_phone ELSE '***-****'
  END as contact_phone,
  CASE 
    WHEN client_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR provider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    THEN contact_email ELSE '***@***.***'
  END as contact_email,
  CASE 
    WHEN client_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR provider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    THEN contact_name ELSE CONCAT(LEFT(contact_name, 3), '***')
  END as contact_name
FROM public.service_requests;

GRANT SELECT ON public.service_requests_secure TO authenticated;

-- ============================================
-- 10. HARDEN vehicles TABLE - Document URLs (CORRECTED COLUMNS)
-- ============================================

DROP VIEW IF EXISTS public.vehicles_secure;
CREATE VIEW public.vehicles_secure
WITH (security_invoker = true) AS
SELECT
  id, driver_id, vehicle_type, axle_count, max_capacity_tons, status,
  created_at, updated_at, high_performance, primary_identification,
  company_id, assigned_driver_id, is_company_vehicle, vehicle_validation_status,
  vehicle_specifications,
  CASE 
    WHEN driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR assigned_driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    THEN license_plate ELSE CONCAT(LEFT(license_plate, 3), '****')
  END as license_plate,
  CASE 
    WHEN driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR assigned_driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    THEN crlv_url ELSE NULL
  END as crlv_url,
  CASE 
    WHEN driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR assigned_driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    THEN insurance_document_url ELSE NULL
  END as insurance_document_url,
  CASE 
    WHEN driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR assigned_driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    THEN inspection_certificate_url ELSE NULL
  END as inspection_certificate_url,
  vehicle_photo_url,
  crlv_expiry_date, insurance_expiry_date, last_inspection_date
FROM public.vehicles;

GRANT SELECT ON public.vehicles_secure TO authenticated;

-- ============================================
-- 11. HARDEN transport_companies TABLE (CORRECTED COLUMNS)
-- ============================================

DROP VIEW IF EXISTS public.transport_companies_secure;
CREATE VIEW public.transport_companies_secure
WITH (security_invoker = true) AS
SELECT
  id, company_name, status, profile_id, created_at, updated_at, city, state, address, zip_code,
  CASE 
    WHEN profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    THEN company_cnpj ELSE CONCAT(LEFT(company_cnpj, 8), '****-**')
  END as company_cnpj,
  CASE 
    WHEN profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    THEN state_registration ELSE '***.***.***'
  END as state_registration,
  CASE 
    WHEN profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    THEN municipal_registration ELSE '***.***.***'
  END as municipal_registration,
  CASE 
    WHEN profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    THEN antt_registration ELSE '***.***.***'
  END as antt_registration,
  CASE 
    WHEN profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    THEN cnpj_document_url ELSE NULL
  END as cnpj_document_url,
  CASE 
    WHEN profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    THEN antt_document_url ELSE NULL
  END as antt_document_url
FROM public.transport_companies;

GRANT SELECT ON public.transport_companies_secure TO authenticated;

-- ============================================
-- 12. Update driver_location_history retention to 7 days
-- ============================================

UPDATE public.driver_location_history
SET expires_at = LEAST(expires_at, created_at + INTERVAL '7 days')
WHERE expires_at IS NULL OR expires_at > created_at + INTERVAL '7 days';
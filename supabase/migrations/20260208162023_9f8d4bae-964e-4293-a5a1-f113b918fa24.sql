
-- =====================================================
-- DATA REPAIR: Fix desynced freight_assignments
-- Sync assignment status from driver_trip_progress (source of truth)
-- =====================================================

-- 1. Fix assignments stuck at ACCEPTED/LOADING/LOADED/IN_TRANSIT 
-- where driver_trip_progress shows DELIVERED or DELIVERED_PENDING_CONFIRMATION
UPDATE freight_assignments fa
SET 
  status = dtp.current_status,
  updated_at = now()
FROM driver_trip_progress dtp
WHERE fa.freight_id = dtp.freight_id
  AND fa.driver_id = dtp.driver_id
  AND fa.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
  AND dtp.current_status IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED');

-- 2. Fix assignments where external_payments shows terminal status
-- but assignment is still at an active status (payment already confirmed)
UPDATE freight_assignments fa
SET 
  status = 'DELIVERED',
  updated_at = now()
FROM external_payments ep
WHERE fa.freight_id = ep.freight_id
  AND fa.driver_id = ep.driver_id
  AND fa.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION')
  AND ep.status IN ('paid_by_producer', 'confirmed', 'accepted');

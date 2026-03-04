
-- Fix: Disable the update_freight_status() trigger on freight_status_history
-- This trigger was causing REDUNDANT updates to freights.status, which then fired
-- notify_freight_status_change AGAIN, generating duplicate notifications.
-- The edge function driver-update-trip-progress-fast already manages:
-- 1) driver_trip_progress (source of truth)
-- 2) freight_assignments.status (synced)
-- 3) freights.status is synced via trg_sync_freight_status_on_assignment_update for terminal states
-- So this trigger is redundant and causes cascading duplicates.

DROP TRIGGER IF EXISTS freight_status_update_trigger ON public.freight_status_history;

/**
 * driver-effective-status.ts
 * 
 * Resolves the "real" status of a driver on a freight by cross-referencing
 * driver_trip_progress (source of truth) with freight_assignments (legacy).
 * 
 * This is needed because the sync from driver_trip_progress → freight_assignments
 * can fail silently, leaving assignment status stale while the driver has actually
 * progressed (e.g., trip says DELIVERED but assignment says ACCEPTED).
 */

/** Statuses that mean the driver is done with their trip */
export const TERMINAL_TRIP_STATUSES = [
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED'
] as const;

/** Statuses that mean the driver is still actively working */
export const ACTIVE_TRIP_STATUSES = [
  'ACCEPTED',
  'LOADING',
  'LOADED',
  'IN_TRANSIT',
  'DELIVERED_PENDING_CONFIRMATION'
] as const;

/**
 * Returns the effective status for a driver, preferring trip progress over assignment.
 * This mirrors the logic in useDriverFreightStatus hook.
 */
export function getDriverEffectiveStatus(
  assignmentStatus: string | null | undefined,
  tripProgressStatus: string | null | undefined
): string {
  // Trip progress is the source of truth
  if (tripProgressStatus) return tripProgressStatus;
  // Fall back to assignment status
  if (assignmentStatus) return assignmentStatus;
  return 'UNKNOWN';
}

/**
 * Returns true if the driver's effective status indicates they're still active
 * (not yet delivered/completed/cancelled).
 */
export function isDriverStillActive(
  assignmentStatus: string | null | undefined,
  tripProgressStatus: string | null | undefined
): boolean {
  const effective = getDriverEffectiveStatus(assignmentStatus, tripProgressStatus);
  return !TERMINAL_TRIP_STATUSES.includes(effective as any);
}

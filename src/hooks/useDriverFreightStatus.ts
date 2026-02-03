/**
 * useDriverFreightStatus
 *
 * For multi-truck freights, each driver progresses independently.
 * This hook resolves the effective status for a specific driver using:
 * 1) driver_trip_progress.current_status (preferred)
 * 2) freight_assignments.status (fallback)
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type DriverFreightStatusSource = 'trip_progress' | 'assignment' | 'unknown';

interface UseDriverFreightStatusResult {
  status: string | null;
  source: DriverFreightStatusSource;
  isLoading: boolean;
}

export function useDriverFreightStatus(
  freightId: string | null | undefined,
  driverId: string | null | undefined,
): UseDriverFreightStatusResult {
  const [status, setStatus] = useState<string | null>(null);
  const [source, setSource] = useState<DriverFreightStatusSource>('unknown');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!freightId || !driverId) {
      setIsLoading(false);
      setStatus(null);
      setSource('unknown');
      return;
    }

    let cancelled = false;

    const fetch = async () => {
      try {
        setIsLoading(true);

        // 1) Prefer driver_trip_progress
        const { data: progress, error: progressError } = await supabase
          .from('driver_trip_progress')
          .select('current_status, updated_at')
          .eq('freight_id', freightId)
          .eq('driver_id', driverId)
          .maybeSingle();

        if (!cancelled && !progressError && progress?.current_status) {
          setStatus(progress.current_status);
          setSource('trip_progress');
          return;
        }

        // 2) Fallback to assignment status
        const { data: assignment, error: assignmentError } = await supabase
          .from('freight_assignments')
          .select('status, updated_at')
          .eq('freight_id', freightId)
          .eq('driver_id', driverId)
          .not('status', 'in', '(CANCELLED,REJECTED)')
          .maybeSingle();

        if (!cancelled && !assignmentError && assignment?.status) {
          setStatus(assignment.status);
          setSource('assignment');
          return;
        }

        if (!cancelled) {
          setStatus(null);
          setSource('unknown');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetch();

    // Realtime updates (filtered by freight_id, and we verify driver_id in payload)
    const progressChannel = supabase
      .channel(`driver_freight_status_progress_${freightId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_trip_progress',
          filter: `freight_id=eq.${freightId}`,
        },
        (payload) => {
          const newRow: any = (payload as any).new;
          const oldRow: any = (payload as any).old;
          const relevantDriverId = newRow?.driver_id || oldRow?.driver_id;
          if (relevantDriverId === driverId) fetch();
        },
      )
      .subscribe();

    const assignmentChannel = supabase
      .channel(`driver_freight_status_assignment_${freightId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_assignments',
          filter: `freight_id=eq.${freightId}`,
        },
        (payload) => {
          const newRow: any = (payload as any).new;
          const oldRow: any = (payload as any).old;
          const relevantDriverId = newRow?.driver_id || oldRow?.driver_id;
          if (relevantDriverId === driverId) fetch();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(progressChannel);
      supabase.removeChannel(assignmentChannel);
    };
  }, [freightId, driverId]);

  return { status, source, isLoading };
}

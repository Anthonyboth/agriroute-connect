import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const ACTIVE_STATUSES = ['PENDING', 'OPEN', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'];

/**
 * Returns the count of active service requests where the current user is the client.
 * Used for tab badges on "Solicitações" tabs across dashboards.
 */
export function useMyRequestsCount() {
  const { profile } = useAuth();

  const { data: count = 0 } = useQuery({
    queryKey: ['my-requests-count', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return 0;
      
      const { count, error } = await supabase
        .from('service_requests')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', profile.id)
        .in('status', ACTIVE_STATUSES);
      
      if (error) {
        console.error('Error fetching my requests count:', error);
        return 0;
      }
      return count || 0;
    },
    enabled: !!profile?.id,
    staleTime: 60 * 1000,
  });

  return count;
}

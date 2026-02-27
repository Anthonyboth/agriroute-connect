import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type FreightShareStatus = 
  | 'AVAILABLE'       // Frete aberto, pode aceitar/contrapropor
  | 'UNAVAILABLE'     // Já aceito por outro ou cancelado
  | 'LOADING'         // Verificando disponibilidade
  | 'ERROR';          // Erro ao verificar

interface FreightShareState {
  status: FreightShareStatus;
  freightStatus: string | null;
  driverName: string | null;
  isAcceptedByOther: boolean;
  isCancelled: boolean;
  canAccept: boolean;
  canCounterPropose: boolean;
  statusLabel: string;
}

export function useFreightShareActions(freightId: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['freight-share-availability', freightId],
    queryFn: async (): Promise<FreightShareState> => {
      if (!freightId) {
        return {
          status: 'ERROR',
          freightStatus: null,
          driverName: null,
          isAcceptedByOther: false,
          isCancelled: false,
          canAccept: false,
          canCounterPropose: false,
          statusLabel: 'Frete não encontrado',
        };
      }

      const { data: freight, error: freightError } = await supabase
        .from('freights')
        .select('id, status, driver_id, driver:profiles_secure!freights_driver_id_fkey(full_name)')
        .eq('id', freightId)
        .maybeSingle();

      if (freightError || !freight) {
        return {
          status: 'UNAVAILABLE',
          freightStatus: null,
          driverName: null,
          isAcceptedByOther: false,
          isCancelled: false,
          canAccept: false,
          canCounterPropose: false,
          statusLabel: 'Frete não encontrado ou removido',
        };
      }

      const OPEN_STATUSES = ['OPEN', 'APPROVED', 'NEW'];
      const CANCELLED_STATUSES = ['CANCELLED', 'CANCELADO'];
      const ACCEPTED_STATUSES = ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED', 'DELIVERED_PENDING_CONFIRMATION', 'COMPLETED', 'CONCLUIDO'];

      const isOpen = OPEN_STATUSES.includes(freight.status);
      const isCancelled = CANCELLED_STATUSES.includes(freight.status);
      const isAccepted = ACCEPTED_STATUSES.includes(freight.status);

      const driverProfile = Array.isArray(freight.driver) ? freight.driver[0] : freight.driver;
      const driverName = driverProfile?.full_name || null;

      if (isOpen) {
        return {
          status: 'AVAILABLE',
          freightStatus: freight.status,
          driverName: null,
          isAcceptedByOther: false,
          isCancelled: false,
          canAccept: true,
          canCounterPropose: true,
          statusLabel: 'Disponível para aceite',
        };
      }

      if (isCancelled) {
        return {
          status: 'UNAVAILABLE',
          freightStatus: freight.status,
          driverName: null,
          isAcceptedByOther: false,
          isCancelled: true,
          canAccept: false,
          canCounterPropose: false,
          statusLabel: 'Frete cancelado',
        };
      }

      if (isAccepted) {
        return {
          status: 'UNAVAILABLE',
          freightStatus: freight.status,
          driverName,
          isAcceptedByOther: true,
          isCancelled: false,
          canAccept: false,
          canCounterPropose: false,
          statusLabel: driverName 
            ? `Aceito por ${driverName}` 
            : 'Já aceito por outro motorista',
        };
      }

      // Status desconhecido — tratar como indisponível
      return {
        status: 'UNAVAILABLE',
        freightStatus: freight.status,
        driverName,
        isAcceptedByOther: false,
        isCancelled: false,
        canAccept: false,
        canCounterPropose: false,
        statusLabel: `Status: ${freight.status}`,
      };
    },
    enabled: !!freightId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const defaultState: FreightShareState = {
    status: isLoading ? 'LOADING' : error ? 'ERROR' : 'LOADING',
    freightStatus: null,
    driverName: null,
    isAcceptedByOther: false,
    isCancelled: false,
    canAccept: false,
    canCounterPropose: false,
    statusLabel: isLoading ? 'Verificando disponibilidade...' : 'Erro ao verificar',
  };

  return {
    ...(data || defaultState),
    isLoading,
    refetch,
  };
}

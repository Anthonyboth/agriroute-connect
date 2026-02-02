/**
 * useFreightDriverManager.ts
 * 
 * Hook CENTRALIZADO para gerenciar motoristas e atribuições por frete.
 * Garante que cada frete seja exibido UMA ÚNICA VEZ no dashboard,
 * com todos os motoristas atribuídos agrupados.
 * 
 * REGRAS DE NEGÓCIO:
 * 1. Fretes multi-carreta (required_trucks > 1) podem ter múltiplos motoristas
 * 2. No dashboard da transportadora, cada frete aparece como 1 card
 * 3. Os motoristas atribuídos são listados dentro do card, não como cards separados
 * 
 * Este hook é a FONTE ÚNICA DE VERDADE para:
 * - Lista de fretes da transportadora (agrupados)
 * - Motoristas atribuídos por frete
 * - Status de capacidade (vagas preenchidas vs disponíveis)
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

// =====================================================
// TIPOS
// =====================================================

export interface DriverAssignment {
  id: string;
  driverId: string;
  driverName: string;
  driverPhoto?: string | null;
  driverRating?: number | null;
  status: string;
  agreedPrice: number | null;
  acceptedAt: string | null;
  vehiclePlate?: string | null;
}

export interface ManagedFreight {
  id: string;
  status: string;
  cargoType: string | null;
  weight: number | null;
  distanceKm: number | null;
  price: number | null;
  requiredTrucks: number;
  acceptedTrucks: number;
  /** Capacidade disponível */
  availableSlots: number;
  /** Está com capacidade completa? */
  isFullyAssigned: boolean;
  /** Origem */
  originCity: string | null;
  originState: string | null;
  originAddress: string | null;
  /** Destino */
  destinationCity: string | null;
  destinationState: string | null;
  destinationAddress: string | null;
  /** Datas */
  pickupDate: string | null;
  deliveryDate: string | null;
  createdAt: string;
  /** Produtor */
  producer: {
    id: string;
    name: string;
    phone?: string | null;
  } | null;
  /** Motoristas atribuídos */
  drivers: DriverAssignment[];
  /** Dados brutos do frete (para componentes que precisam) */
  rawFreight: any;
}

export interface UseFreightDriverManagerOptions {
  companyId: string | null | undefined;
  /** IDs dos motoristas afiliados à transportadora */
  affiliatedDriverIds?: string[];
  /** Incluir fretes com status OPEN que têm motoristas aceitos? */
  includePartialOpen?: boolean;
}

export interface UseFreightDriverManagerResult {
  freights: ManagedFreight[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  /** Total de motoristas em todos os fretes */
  totalDriversAssigned: number;
  /** Total de fretes únicos */
  totalFreights: number;
  /** Buscar frete por ID */
  getFreight: (freightId: string) => ManagedFreight | undefined;
  /** Verificar se um motorista está em um frete */
  isDriverInFreight: (freightId: string, driverId: string) => boolean;
}

// =====================================================
// STATUS VÁLIDOS
// =====================================================

const ACTIVE_FREIGHT_STATUSES = [
  'ACCEPTED',
  'LOADING',
  'LOADED',
  'IN_TRANSIT',
  'DELIVERED_PENDING_CONFIRMATION'
] as const;

const ACTIVE_ASSIGNMENT_STATUSES = [
  'ACCEPTED',
  'LOADING',
  'LOADED',
  'IN_TRANSIT',
  'DELIVERED_PENDING_CONFIRMATION'
];

// =====================================================
// HOOK PRINCIPAL
// =====================================================

export const useFreightDriverManager = ({
  companyId,
  affiliatedDriverIds = [],
  includePartialOpen = true
}: UseFreightDriverManagerOptions): UseFreightDriverManagerResult => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['freight-driver-manager', companyId, affiliatedDriverIds.sort().join(',')],
    enabled: Boolean(companyId),
    staleTime: 30_000, // 30s
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<ManagedFreight[]> => {
      if (!companyId) return [];

      // 1. Buscar todas as atribuições da transportadora + motoristas afiliados
      const orFilters: string[] = [`company_id.eq.${companyId}`];
      if (affiliatedDriverIds.length > 0) {
        orFilters.push(`driver_id.in.(${affiliatedDriverIds.join(',')})`);
      }

      const { data: assignments, error: assignmentsError } = await supabase
        .from('freight_assignments')
        .select(`
          id,
          freight_id,
          driver_id,
          status,
          agreed_price,
          accepted_at,
          company_id,
          driver:profiles_secure!freight_assignments_driver_id_fkey(
            id, full_name, profile_photo_url, rating
          )
        `)
        .or(orFilters.join(','))
        .in('status', ACTIVE_ASSIGNMENT_STATUSES)
        .order('accepted_at', { ascending: false });

      if (assignmentsError) {
        console.error('[FreightDriverManager] Erro ao buscar assignments:', assignmentsError);
        throw assignmentsError;
      }

      // 2. Coletar IDs únicos de fretes
      const freightIds = [...new Set((assignments || []).map(a => a.freight_id))];
      
      if (freightIds.length === 0) {
        return [];
      }

      // 3. Buscar dados dos fretes
      const freightStatuses = includePartialOpen 
        ? [...ACTIVE_FREIGHT_STATUSES, 'OPEN' as const]
        : [...ACTIVE_FREIGHT_STATUSES];

      const { data: freightsData, error: freightsError } = await supabase
        .from('freights')
        .select(`
          id,
          status,
          cargo_type,
          weight,
          distance_km,
          price,
          required_trucks,
          accepted_trucks,
          origin_city,
          origin_state,
          origin_address,
          destination_city,
          destination_state,
          destination_address,
          pickup_date,
          delivery_date,
          created_at,
          producer_id,
          producer:profiles!freights_producer_id_fkey(
            id, full_name, contact_phone
          )
        `)
        .in('id', freightIds)
        .in('status', freightStatuses);

      if (freightsError) {
        console.error('[FreightDriverManager] Erro ao buscar fretes:', freightsError);
        throw freightsError;
      }

      // 4. Filtrar fretes OPEN: só incluir se tiver accepted_trucks > 0
      const validFreights = (freightsData || []).filter(f => {
        if (f.status === 'OPEN') {
          return (f.accepted_trucks || 0) > 0;
        }
        return true;
      });

      // 5. Agrupar atribuições por freight_id
      const assignmentsByFreight = new Map<string, any[]>();
      (assignments || []).forEach(a => {
        const list = assignmentsByFreight.get(a.freight_id) || [];
        list.push(a);
        assignmentsByFreight.set(a.freight_id, list);
      });

      // 6. Montar resultado final
      const result: ManagedFreight[] = validFreights.map(freight => {
        const freightAssignments = assignmentsByFreight.get(freight.id) || [];
        const requiredTrucks = freight.required_trucks || 1;
        const acceptedTrucks = freightAssignments.length;

        const drivers: DriverAssignment[] = freightAssignments.map(a => ({
          id: a.id,
          driverId: a.driver_id,
          driverName: a.driver?.full_name || 'Motorista',
          driverPhoto: a.driver?.profile_photo_url,
          driverRating: a.driver?.rating,
          status: a.status,
          agreedPrice: a.agreed_price,
          acceptedAt: a.accepted_at,
          vehiclePlate: null // Podemos buscar depois se necessário
        }));

        return {
          id: freight.id,
          status: freight.status,
          cargoType: freight.cargo_type,
          weight: freight.weight,
          distanceKm: freight.distance_km,
          price: freight.price,
          requiredTrucks,
          acceptedTrucks,
          availableSlots: Math.max(0, requiredTrucks - acceptedTrucks),
          isFullyAssigned: acceptedTrucks >= requiredTrucks,
          originCity: freight.origin_city,
          originState: freight.origin_state,
          originAddress: freight.origin_address,
          destinationCity: freight.destination_city,
          destinationState: freight.destination_state,
          destinationAddress: freight.destination_address,
          pickupDate: freight.pickup_date,
          deliveryDate: freight.delivery_date,
          createdAt: freight.created_at,
          producer: freight.producer ? {
            id: freight.producer.id,
            name: freight.producer.full_name || 'Produtor',
            phone: freight.producer.contact_phone
          } : null,
          drivers,
          rawFreight: freight
        };
      });

      // Ordenar por data de criação (mais recentes primeiro)
      result.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      console.log(`[FreightDriverManager] ${result.length} fretes únicos, ${assignments?.length || 0} atribuições totais`);

      return result;
    }
  });

  // =====================================================
  // HELPERS
  // =====================================================

  const freights = query.data || [];

  const totalDriversAssigned = useMemo(() => 
    freights.reduce((sum, f) => sum + f.drivers.length, 0),
    [freights]
  );

  const getFreight = useCallback((freightId: string) => 
    freights.find(f => f.id === freightId),
    [freights]
  );

  const isDriverInFreight = useCallback((freightId: string, driverId: string) => {
    const freight = getFreight(freightId);
    return freight?.drivers.some(d => d.driverId === driverId) || false;
  }, [getFreight]);

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['freight-driver-manager', companyId] });
  }, [queryClient, companyId]);

  return {
    freights,
    isLoading: query.isLoading,
    error: query.error?.message || null,
    refetch,
    totalDriversAssigned,
    totalFreights: freights.length,
    getFreight,
    isDriverInFreight
  };
};

// =====================================================
// HOOK PARA REALTIME
// =====================================================

/**
 * Hook que adiciona subscription realtime ao FreightDriverManager
 */
export const useFreightDriverManagerRealtime = (
  options: UseFreightDriverManagerOptions
) => {
  const manager = useFreightDriverManager(options);
  const queryClient = useQueryClient();

  // Subscription para mudanças em freight_assignments
  useQuery({
    queryKey: ['freight-driver-manager-realtime', options.companyId],
    enabled: Boolean(options.companyId),
    queryFn: () => null,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity
  });

  // Setup realtime subscription
  useMemo(() => {
    if (!options.companyId) return;

    const channel = supabase
      .channel(`freight-manager-${options.companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_assignments',
          filter: `company_id=eq.${options.companyId}`
        },
        () => {
          console.log('[FreightDriverManager] Atribuição alterada, refetch...');
          queryClient.invalidateQueries({ 
            queryKey: ['freight-driver-manager', options.companyId] 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options.companyId, queryClient]);

  return manager;
};

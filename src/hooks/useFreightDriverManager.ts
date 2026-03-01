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
  /** Documento único do motorista (CPF/CNPJ) para deduplicação */
  driverDocument?: string | null;
  /** Indica se é motorista afiliado à transportadora */
  isAffiliated: boolean;
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
  /** Capacidade disponível baseada em TODOS os motoristas */
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
  /** TODOS os motoristas atribuídos (afiliados + autônomos) */
  drivers: DriverAssignment[];
  /** Apenas motoristas afiliados à transportadora */
  affiliatedDrivers: DriverAssignment[];
  /** Motoristas autônomos/externos */
  externalDrivers: DriverAssignment[];
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
  /** Verificar se um motorista está em um frete (por ID ou documento) */
  isDriverInFreight: (freightId: string, driverIdOrDocument: string) => boolean;
  /** Verificar se um documento já está atribuído a algum frete */
  isDocumentAssigned: (document: string, excludeFreightId?: string) => boolean;
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

      // 1. PRIMEIRA BUSCA: Atribuições da transportadora para identificar os fretes
      const orFilters: string[] = [`company_id.eq.${companyId}`];
      if (affiliatedDriverIds.length > 0) {
        orFilters.push(`driver_id.in.(${affiliatedDriverIds.join(',')})`);
      }

      const { data: companyAssignments, error: companyAssignmentsError } = await supabase
        .from('freight_assignments')
        .select('freight_id')
        .or(orFilters.join(','))
        .in('status', ACTIVE_ASSIGNMENT_STATUSES);

      if (companyAssignmentsError) {
        console.error('[FreightDriverManager] Erro ao buscar assignments da empresa:', companyAssignmentsError);
        throw companyAssignmentsError;
      }

      // 2. Coletar IDs únicos de fretes
      const freightIds = [...new Set((companyAssignments || []).map(a => a.freight_id))];
      
      if (freightIds.length === 0) {
        return [];
      }

      // 3. SEGUNDA BUSCA: TODOS os assignments desses fretes (não apenas da transportadora)
      // Importante: usamos profiles_secure para não depender de acesso direto a PII.
      // O CPF/CNPJ é resolvido em uma segunda query APENAS para motoristas afiliados
      // (ou assignments explicitamente marcados com company_id da transportadora).
      const { data: allAssignments, error: allAssignmentsError } = await supabase
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
        .in('freight_id', freightIds)
        .in('status', ACTIVE_ASSIGNMENT_STATUSES)
        .order('accepted_at', { ascending: false });

      if (allAssignmentsError) {
        console.error('[FreightDriverManager] Erro ao buscar todos assignments:', allAssignmentsError);
        throw allAssignmentsError;
      }

      // 4. Buscar dados dos fretes
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
          pricing_type,
          price_per_km,
          required_trucks,
          accepted_trucks,
          origin_city,
          origin_state,
          origin_address,
          origin_neighborhood,
          origin_street,
          origin_number,
          origin_complement,
          origin_zip_code,
          origin_lat,
          origin_lng,
          destination_city,
          destination_state,
          destination_address,
          destination_neighborhood,
          destination_street,
          destination_number,
          destination_complement,
          destination_zip_code,
          destination_lat,
          destination_lng,
          pickup_date,
          delivery_date,
          created_at,
          producer_id,
          service_type,
          driver_id,
          is_guest_freight,
          producer:profiles_secure!freights_producer_id_fkey(
            id, full_name, contact_phone, profile_photo_url
          )
        `)
        .in('id', freightIds)
        .in('status', freightStatuses);

      if (freightsError) {
        console.error('[FreightDriverManager] Erro ao buscar fretes:', freightsError);
        throw freightsError;
      }

      // 5. Filtrar fretes OPEN: só incluir se tiver accepted_trucks > 0
      const validFreights = (freightsData || []).filter(f => {
        if (f.status === 'OPEN') {
          return (f.accepted_trucks || 0) > 0;
        }
        return true;
      });

      // 6. Resolver CPF/CNPJ dos motoristas afiliados (para deduplicação e identificação por documento)
      const affiliatedDriverIdSet = new Set(affiliatedDriverIds);
      const affiliatedAssignmentDriverIds = [...new Set(
        (allAssignments || [])
          .filter(a => a.company_id === companyId || affiliatedDriverIdSet.has(a.driver_id))
          .map(a => a.driver_id)
          .filter(Boolean)
      )] as string[];

      const docByDriverId = new Map<string, string>();
      if (affiliatedAssignmentDriverIds.length > 0) {
        const { data: docs, error: docsError } = await supabase
          .from('profiles')
          .select('id, cpf_cnpj')
          .in('id', affiliatedAssignmentDriverIds);

        if (docsError) {
          // Não quebrar o dashboard se RLS bloquear; apenas perde dedupe por CPF
          console.warn('[FreightDriverManager] Não foi possível resolver CPF/CNPJ via SELECT (RLS):', docsError);

          // Fallback: tentar resolver via RPC SECURITY DEFINER (padrão do projeto para motoristas afiliados)
          await Promise.all(
            affiliatedAssignmentDriverIds.map(async (driverProfileId) => {
              const { data: rpcData, error: rpcError } = await supabase.rpc('get_affiliated_driver_profile', {
                p_driver_profile_id: driverProfileId,
                p_company_id: companyId,
              });

              if (rpcError) {
                // Se a RPC falhar para algum motorista, apenas não teremos dedupe por CPF para ele.
                console.warn('[FreightDriverManager] RPC get_affiliated_driver_profile falhou:', {
                  driverProfileId,
                  message: rpcError.message,
                });
                return;
              }

              const profile = Array.isArray(rpcData) ? rpcData[0] : rpcData;
              const normalized = (profile?.cpf_cnpj || '').toString().replace(/\D/g, '');
              if (driverProfileId && normalized) docByDriverId.set(driverProfileId, normalized);
            })
          );
        } else {
          (docs || []).forEach((p: any) => {
            const normalized = (p.cpf_cnpj || '').toString().replace(/\D/g, '');
            if (p.id && normalized) docByDriverId.set(p.id, normalized);
          });
        }
      }

      const affiliatedDocuments = new Set(
        affiliatedDriverIds
          .map(id => docByDriverId.get(id))
          .filter((d): d is string => Boolean(d))
      );

      // 7. Agrupar atribuições por freight_id COM DEDUPLICAÇÃO POR DOCUMENTO (CPF/CNPJ)
      const assignmentsByFreight = new Map<string, any[]>();
      const seenDocumentsPerFreight = new Map<string, Set<string>>();

      (allAssignments || []).forEach(a => {
        const freightId = a.freight_id;
        // Regra: documento é o identificador canônico do motorista (quando disponível).
        // Se não houver documento resolvível, cai no driver_id.
        const driverDoc = docByDriverId.get(a.driver_id) || a.driver_id;
        
        // Verificar se já existe motorista com mesmo documento neste frete
        const seenDocs = seenDocumentsPerFreight.get(freightId) || new Set();
        if (seenDocs.has(driverDoc)) {
          console.warn(`[FreightDriverManager] Motorista duplicado detectado (doc: ${driverDoc}) no frete ${freightId}`);
          return; // Pular duplicata
        }
        
        seenDocs.add(driverDoc);
        seenDocumentsPerFreight.set(freightId, seenDocs);
        
        const list = assignmentsByFreight.get(freightId) || [];
        list.push(a);
        assignmentsByFreight.set(freightId, list);
      });

      // 8. Montar resultado final
      
      const result: ManagedFreight[] = validFreights.map(freight => {
        const freightAssignments = assignmentsByFreight.get(freight.id) || [];
        const requiredTrucks = freight.required_trucks || 1;
        
        // Contar TODOS os motoristas (não apenas os da transportadora)
        const totalAcceptedDrivers = freightAssignments.length;

        const drivers: DriverAssignment[] = freightAssignments.map(a => {
          const doc = docByDriverId.get(a.driver_id) || null;
          const normalizedDoc = doc ? doc.replace(/\D/g, '') : null;

          // Regra pedida: afiliação e participação devem ser validadas por CPF/CNPJ.
          // Isso evita duplicações quando o mesmo motorista aparece com IDs diferentes.
          const isAffiliated =
            a.company_id === companyId ||
            affiliatedDriverIdSet.has(a.driver_id) ||
            (normalizedDoc ? affiliatedDocuments.has(normalizedDoc) : false);

          return {
            id: a.id,
            driverId: a.driver_id,
            driverName: a.driver?.full_name || 'Motorista',
            driverPhoto: a.driver?.profile_photo_url,
            driverRating: a.driver?.rating,
            status: a.status,
            agreedPrice: a.agreed_price,
            acceptedAt: a.accepted_at,
            vehiclePlate: null,
            driverDocument: normalizedDoc,
            isAffiliated
          };
        });

        // Separar motoristas afiliados e externos
        const affiliatedDrivers = drivers.filter(d => d.isAffiliated);
        const externalDrivers = drivers.filter(d => !d.isAffiliated);

        return {
          id: freight.id,
          status: freight.status,
          cargoType: freight.cargo_type,
          weight: freight.weight,
          distanceKm: freight.distance_km,
          price: freight.price,
          requiredTrucks,
          acceptedTrucks: totalAcceptedDrivers,
          availableSlots: Math.max(0, requiredTrucks - totalAcceptedDrivers),
          isFullyAssigned: totalAcceptedDrivers >= requiredTrucks,
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
          affiliatedDrivers,
          externalDrivers,
          rawFreight: freight
        };
      });

      // Ordenar por data de criação (mais recentes primeiro)
      result.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      if (import.meta.env.DEV) console.log(`[FreightDriverManager] ${result.length} fretes únicos, ${allAssignments?.length || 0} atribuições totais (deduplicadas por documento)`);

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

  /** Verifica se motorista está no frete (por ID ou documento CPF/CNPJ) */
  const isDriverInFreight = useCallback((freightId: string, driverIdOrDocument: string) => {
    const freight = getFreight(freightId);
    if (!freight) return false;
    
    const normalizedInput = driverIdOrDocument.replace(/\D/g, '');
    return freight.drivers.some(d => 
      d.driverId === driverIdOrDocument || 
      d.driverDocument === normalizedInput
    );
  }, [getFreight]);

  /** Verifica se documento já está atribuído a algum frete */
  const isDocumentAssigned = useCallback((document: string, excludeFreightId?: string) => {
    const normalizedDoc = document.replace(/\D/g, '');
    return freights.some(f => {
      if (excludeFreightId && f.id === excludeFreightId) return false;
      return f.drivers.some(d => d.driverDocument === normalizedDoc);
    });
  }, [freights]);

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
    isDriverInFreight,
    isDocumentAssigned
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
          if (import.meta.env.DEV) console.log('[FreightDriverManager] Atribuição alterada, refetch...');
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

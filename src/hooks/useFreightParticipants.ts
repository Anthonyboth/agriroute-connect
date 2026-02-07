/**
 * useFreightParticipants.ts
 * 
 * Hook CENTRALIZADO para gerenciar todos os participantes de um frete:
 * - Produtor (dono do frete)
 * - Motoristas atribuídos (via freight_assignments)
 * - Transportadora (se houver motoristas afiliados)
 * 
 * Este hook é a FONTE ÚNICA DE VERDADE para:
 * - Lista de participantes do chat
 * - Lista de motoristas visíveis no card de frete
 * - Permissões de visualização de localização
 * 
 * REGRA CRÍTICA: Apenas motoristas COM ATRIBUIÇÃO ATIVA aparecem como participantes.
 * Isso elimina o bug de motoristas não relacionados aparecerem no frete.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getUserDisplayId, maskDisplayId } from '@/lib/user-display-id';
import { isDriverStillActive, getDriverEffectiveStatus } from '@/lib/driver-effective-status';

// =====================================================
// TIPOS
// =====================================================

export interface FreightParticipant {
  id: string;
  profileId: string;
  /**
   * ✅ REGRA: ID de exibição do usuário para identificação organizada.
   * Formato: CPF formatado (057-159-091-80) ou hash (GUEST-XXXXXXXX).
   * Apenas para tracking interno, não exibido para outros usuários.
   */
  displayId: string;
  /** Versão mascarada do displayId para exibição segura */
  maskedDisplayId: string;
  type: 'producer' | 'driver' | 'company';
  name: string;
  avatarUrl?: string;
  rating?: number;
  totalRatings?: number;
  status?: string;
  /** Para motoristas: status da atribuição */
  assignmentStatus?: string;
  /** Para motoristas: preço acordado */
  agreedPrice?: number;
  /** Para motoristas: ID da transportadora (se afiliado) */
  companyId?: string;
  /** Para transportadoras: nome da empresa */
  companyName?: string;
}

export interface FreightParticipantsData {
  producer: FreightParticipant | null;
  drivers: FreightParticipant[];
  companies: FreightParticipant[];
  /** Todos os participantes (para chat) */
  allParticipants: FreightParticipant[];
  /** IDs de todos os participantes (para notificações) */
  allParticipantIds: string[];
}

interface UseFreightParticipantsOptions {
  freightId: string | null | undefined;
  /** Se deve incluir motoristas com status PENDING */
  includePending?: boolean;
  /** Atualização automática em tempo real */
  realtime?: boolean;
}

interface UseFreightParticipantsResult {
  data: FreightParticipantsData;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Verifica se um profileId é participante do frete */
  isParticipant: (profileId: string) => boolean;
  /** Busca um participante específico por profileId */
  getParticipant: (profileId: string) => FreightParticipant | null;
}

// =====================================================
// STATUS VÁLIDOS PARA PARTICIPAÇÃO
// =====================================================

const VALID_ASSIGNMENT_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'LOADING',
  'LOADED',
  'IN_TRANSIT',
  'DELIVERED_PENDING_CONFIRMATION'
];

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

export const useFreightParticipants = ({
  freightId,
  includePending = true,
  realtime = false
}: UseFreightParticipantsOptions): UseFreightParticipantsResult => {
  const [producer, setProducer] = useState<FreightParticipant | null>(null);
  const [drivers, setDrivers] = useState<FreightParticipant[]>([]);
  const [companies, setCompanies] = useState<FreightParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // =====================================================
  // FUNÇÃO PRINCIPAL DE FETCH
  // =====================================================

  const fetchParticipants = useCallback(async () => {
    if (!freightId) {
      setProducer(null);
      setDrivers([]);
      setCompanies([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Buscar dados do frete (producer_id)
      const { data: freightData, error: freightError } = await supabase
        .from('freights')
        .select('producer_id, status')
        .eq('id', freightId)
        .single();

      if (freightError) throw freightError;
      if (!freightData) throw new Error('Frete não encontrado');

      // 2. Buscar atribuições de motoristas (FONTE ÚNICA DE VERDADE)
      const statusFilter = includePending 
        ? VALID_ASSIGNMENT_STATUSES 
        : ACTIVE_ASSIGNMENT_STATUSES;

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('freight_assignments')
        .select(`
          id,
          driver_id,
          status,
          agreed_price,
          company_id,
          accepted_at
        `)
        .eq('freight_id', freightId)
        .in('status', statusFilter)
        .order('accepted_at', { ascending: true });

      if (assignmentsError) throw assignmentsError;

      // 2b. ✅ CORREÇÃO: Cross-reference com driver_trip_progress para obter status REAL
      // O sync de trip_progress → assignments pode falhar silenciosamente, deixando
      // assignment.status = 'ACCEPTED' enquanto trip_progress = 'DELIVERED'
      const driverIdsForProgress = (assignmentsData || [])
        .map(a => a.driver_id)
        .filter(Boolean);

      const tripProgressMap = new Map<string, string>();
      
      if (driverIdsForProgress.length > 0) {
        const { data: tripProgressData } = await supabase
          .from('driver_trip_progress')
          .select('driver_id, current_status')
          .eq('freight_id', freightId)
          .in('driver_id', driverIdsForProgress);

        (tripProgressData || []).forEach(tp => {
          tripProgressMap.set(tp.driver_id, tp.current_status);
        });
      }

      // 2c. Filtrar motoristas que já terminaram (trip_progress diz DELIVERED/COMPLETED/CANCELLED)
      const activeAssignments = (assignmentsData || []).filter(assignment => {
        const tripStatus = tripProgressMap.get(assignment.driver_id);
        return isDriverStillActive(assignment.status, tripStatus);
      });

      // 3. Coletar todos os IDs únicos para buscar perfis
      const allProfileIds = new Set<string>();
      allProfileIds.add(freightData.producer_id);
      
      const companyIds = new Set<string>();
      
      activeAssignments.forEach(assignment => {
        if (assignment.driver_id) {
          allProfileIds.add(assignment.driver_id);
        }
        if (assignment.company_id) {
          companyIds.add(assignment.company_id);
        }
      });

      // 4. Buscar perfis via profiles_secure (com fallback) - inclui cpf_cnpj para Display ID
      const profilesMap = new Map<string, any>();
      
      if (allProfileIds.size > 0) {
        const { data: profilesData } = await supabase
          .from('profiles_secure')
          .select('id, full_name, profile_photo_url, rating, total_ratings, status, cpf_cnpj')
          .in('id', Array.from(allProfileIds));

        (profilesData || []).forEach(p => profilesMap.set(p.id, p));

        // Fallback via Edge Function para perfis não encontrados (RLS)
        const missingIds = Array.from(allProfileIds).filter(id => !profilesMap.has(id));
        
        for (const missingId of missingIds) {
          try {
            const { data: fnData } = await supabase.functions.invoke(
              'get-participant-public-profile',
              {
                body: {
                  freight_id: freightId,
                  participant_profile_id: missingId,
                  participant_type: missingId === freightData.producer_id ? 'producer' : 'driver'
                }
              }
            );
            
            if (fnData?.success && fnData?.profile) {
              profilesMap.set(missingId, fnData.profile);
            }
          } catch (e) {
            console.warn(`[FreightParticipants] Fallback falhou para ${missingId}:`, e);
          }
        }
      }

      // 5. Buscar transportadoras
      const companiesMap = new Map<string, any>();
      
      if (companyIds.size > 0) {
        const { data: companiesData } = await supabase
          .from('transport_companies')
          .select('id, company_name, profile_id')
          .in('id', Array.from(companyIds));

        (companiesData || []).forEach(c => companiesMap.set(c.id, c));
      }

      // 6. Montar produtor - ✅ Inclui Display ID para tracking interno
      const producerProfile = profilesMap.get(freightData.producer_id);
      const producerDisplayId = getUserDisplayId({
        cpf: producerProfile?.cpf_cnpj,
        profileId: freightData.producer_id,
        isGuest: false
      });
      const producerParticipant: FreightParticipant | null = producerProfile ? {
        id: `producer-${freightData.producer_id}`,
        profileId: freightData.producer_id,
        displayId: producerDisplayId,
        maskedDisplayId: maskDisplayId(producerDisplayId),
        type: 'producer',
        name: producerProfile.full_name || 'Produtor',
        avatarUrl: producerProfile.profile_photo_url,
        rating: producerProfile.rating,
        totalRatings: producerProfile.total_ratings,
        status: producerProfile.status
      } : null;

      // 7. Montar motoristas
      const driverParticipants: FreightParticipant[] = [];
      const companyParticipants: FreightParticipant[] = [];
      const processedCompanies = new Set<string>();

      // 7. Montar motoristas - ✅ Inclui Display ID para tracking interno
      // ✅ Usa activeAssignments (filtrado por trip_progress) em vez de assignmentsData
      activeAssignments.forEach(assignment => {
        const driverProfile = profilesMap.get(assignment.driver_id);
        
        if (driverProfile) {
          const driverDisplayId = getUserDisplayId({
            cpf: driverProfile.cpf_cnpj,
            profileId: assignment.driver_id,
            isGuest: false
          });
          
          driverParticipants.push({
            id: `driver-${assignment.driver_id}`,
            profileId: assignment.driver_id,
            displayId: driverDisplayId,
            maskedDisplayId: maskDisplayId(driverDisplayId),
            type: 'driver',
            name: driverProfile.full_name || 'Motorista',
            avatarUrl: driverProfile.profile_photo_url,
            rating: driverProfile.rating,
            totalRatings: driverProfile.total_ratings,
            status: driverProfile.status,
            assignmentStatus: assignment.status,
            agreedPrice: assignment.agreed_price,
            companyId: assignment.company_id
          });
        }

        // Adicionar transportadora (apenas uma vez por empresa)
        if (assignment.company_id && !processedCompanies.has(assignment.company_id)) {
          processedCompanies.add(assignment.company_id);
          const company = companiesMap.get(assignment.company_id);
          
          if (company) {
            const companyOwnerProfile = profilesMap.get(company.profile_id);
            const companyDisplayId = getUserDisplayId({
              cpf: companyOwnerProfile?.cpf_cnpj,
              profileId: company.profile_id,
              isGuest: false
            });
            
            companyParticipants.push({
              id: `company-${company.id}`,
              profileId: company.profile_id,
              displayId: companyDisplayId,
              maskedDisplayId: maskDisplayId(companyDisplayId),
              type: 'company',
              name: company.company_name || 'Transportadora',
              avatarUrl: companyOwnerProfile?.profile_photo_url,
              companyName: company.company_name
            });
          }
        }
      });

      setProducer(producerParticipant);
      setDrivers(driverParticipants);
      setCompanies(companyParticipants);

      // ✅ Log interno com Display IDs para tracking organizado
      console.log('[FreightParticipants] Carregado:', {
        freightId,
        producer: producerParticipant ? {
          name: producerParticipant.name,
          displayId: producerParticipant.displayId
        } : null,
        drivers: driverParticipants.map(d => ({
          name: d.name,
          displayId: d.displayId,
          assignmentStatus: d.assignmentStatus
        })),
        companies: companyParticipants.map(c => ({
          name: c.companyName,
          displayId: c.displayId
        }))
      });

    } catch (err: any) {
      console.error('[FreightParticipants] Erro:', err);
      setError(err.message || 'Erro ao carregar participantes');
    } finally {
      setIsLoading(false);
    }
  }, [freightId, includePending]);

  // =====================================================
  // EFEITO PRINCIPAL
  // =====================================================

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  // =====================================================
  // REALTIME (opcional)
  // =====================================================

  useEffect(() => {
    if (!realtime || !freightId) return;

    const channel = supabase
      .channel(`freight-participants-${freightId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_assignments',
          filter: `freight_id=eq.${freightId}`
        },
        () => {
          console.log('[FreightParticipants] Atribuição alterada, refetch...');
          fetchParticipants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [freightId, realtime, fetchParticipants]);

  // =====================================================
  // DADOS COMPUTADOS
  // =====================================================

  const data = useMemo<FreightParticipantsData>(() => {
    const allParticipants: FreightParticipant[] = [];
    
    if (producer) allParticipants.push(producer);
    allParticipants.push(...drivers);
    allParticipants.push(...companies);

    return {
      producer,
      drivers,
      companies,
      allParticipants,
      allParticipantIds: allParticipants.map(p => p.profileId)
    };
  }, [producer, drivers, companies]);

  // =====================================================
  // HELPERS
  // =====================================================

  const isParticipant = useCallback((profileId: string): boolean => {
    return data.allParticipantIds.includes(profileId);
  }, [data.allParticipantIds]);

  const getParticipant = useCallback((profileId: string): FreightParticipant | null => {
    return data.allParticipants.find(p => p.profileId === profileId) || null;
  }, [data.allParticipants]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchParticipants,
    isParticipant,
    getParticipant
  };
};

// =====================================================
// HOOK SIMPLIFICADO PARA CHAT
// =====================================================

/**
 * Hook simplificado que retorna apenas os IDs dos participantes para chat.
 * Útil para verificar permissões de envio/leitura de mensagens.
 */
export const useFreightChatParticipants = (freightId: string | null | undefined) => {
  const { data, isLoading, isParticipant } = useFreightParticipants({
    freightId,
    includePending: false, // Chat só para atribuições ativas
    realtime: true
  });

  return {
    participantIds: data.allParticipantIds,
    isLoading,
    isParticipant
  };
};

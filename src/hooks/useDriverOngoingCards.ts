import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  FREIGHT_ONGOING_STATUSES,
  ASSIGNMENT_ONGOING_STATUSES,
  ONGOING_SERVICE_TYPES,
  SERVICE_ONGOING_STATUSES,
} from "@/constants/freightRules";
import { isInProgressFreight } from "@/utils/freightDateHelpers";

/**
 * ========================================================================
 * Hook exclusivo do Painel do Motorista para garantir que a aba
 * "Fretes Em Andamento" sempre tenha dados completos e consistentes.
 * ========================================================================
 *
 * Objetivos:
 * - Centralizar o fetch (evita regressões por lógica duplicada)
 * - Deduplicar fretes que também existam em freight_assignments
 * - Fornecer dados estáveis para renderização dos cards
 * 
 * Regras aplicadas (de src/constants/freightRules.ts):
 * - FREIGHT_ONGOING_STATUSES: Status que definem frete como "Em Andamento"
 * - ASSIGNMENT_ONGOING_STATUSES: Status de assignments visíveis
 * - ONGOING_SERVICE_TYPES: Tipos de serviço que aparecem na aba
 * - SERVICE_ONGOING_STATUSES: Status de serviços ativos
 * 
 * Documentado em:
 * - memory/features/freight-in-progress-status-logic-standard
 * - memory/features/driver-dashboard-ongoing-data-stability
 * - memory/architecture/freight-assignment-query-decoupling
 */

export type OngoingFreightRow = {
  id: string;
  created_at: string;
  status: string;
  updated_at?: string | null;
  cargo_type: string | null;
  price: number | null;
  /** Metadados diversos (inclui, quando disponível, price_per_truck calculado na criação) */
  metadata?: Json | null;
  /**
   * ✅ Regra (Painel do Motorista): valor unitário que o motorista deve enxergar/receber.
   * Para fretes rurais (tabela freights), isso pode vir de metadata.price_per_truck.
   * Para fretes via assignment, é preenchido com agreed_price.
   */
  driver_unit_price?: number | null;
  weight: number | null;
  distance_km: number | null;
  origin_address: string | null;
  origin_neighborhood: string | null;
  origin_street: string | null;
  origin_number: string | null;
  origin_complement: string | null;
  origin_zip_code: string | null;
  destination_address: string | null;
  destination_neighborhood: string | null;
  destination_street: string | null;
  destination_number: string | null;
  destination_complement: string | null;
  destination_zip_code: string | null;
  origin_city: string | null;
  origin_state: string | null;
  destination_city: string | null;
  destination_state: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  pickup_date: string | null;
  delivery_date: string | null;
  service_type: string | null;
  urgency: string | null;
  producer_id: string | null;
  required_trucks: number | null;
  accepted_trucks?: number | null;
  drivers_assigned?: string[] | null;
  current_lat?: number | null;
  current_lng?: number | null;
  last_location_update?: string | null;
  tracking_status?: string | null;
  producer?: {
    id: string;
    full_name: string;
    profile_photo_url?: string | null;
  } | null;
};

export type OngoingAssignmentRow = {
  id: string;
  status: string;
  agreed_price: number | null;
  accepted_at: string | null;
  company_id?: string | null;
  freight: OngoingFreightRow | null;
};

export type OngoingServiceRequestRow = {
  id: string;
  created_at: string;
  status: string;
  service_type: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  city_name: string | null;
  city_lat: number | null;
  city_lng: number | null;
  state: string | null;
  problem_description: string | null;
  estimated_price: number | null;
  urgency: string | null;
  is_emergency: boolean | null;
  accepted_at: string | null;
  additional_info: any | null;
  client_id: string | null;
  prospect_user_id?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  vehicle_info?: string | null;
  preferred_datetime?: string | null;
  // Driver location for map
  driver_lat?: number | null;
  driver_lng?: number | null;
  driver_location_updated?: string | null;
};

export const useDriverOngoingCards = (driverProfileId?: string | null) => {
  return useQuery({
    queryKey: ["driver-ongoing-cards", driverProfileId],
    enabled: Boolean(driverProfileId),
    // ✅ PERFORMANCE: Configuração otimizada para evitar polling excessivo
    // - staleTime: 5 minutos (dados são frescos por mais tempo)
    // - Sem refetchInterval (polling) - dados atualizam via:
    //   1. Ação do usuário (botão Atualizar)
    //   2. Voltar para aba (refetchOnWindowFocus)
    //   3. Realtime do Supabase (quando disponível)
    staleTime: 10 * 60 * 1000, // ✅ 10 minutos (alinhado com padrão global)
    gcTime: 15 * 60 * 1000, // 15 minutos
    refetchOnMount: true, // ✅ PERFORMANCE: Usa cache se fresh, refetch se stale
    refetchOnWindowFocus: true, // Refetch ao voltar para aba
    // ❌ PROIBIDO: refetchInterval - atualiza via focus/botão/10min global
    queryFn: async () => {
      if (!driverProfileId) {
        return {
          freights: [] as OngoingFreightRow[],
          assignments: [] as OngoingAssignmentRow[],
          serviceRequests: [] as OngoingServiceRequestRow[],
        };
      }

      // ✅ Usa constantes centralizadas de src/constants/freightRules.ts
      const freightOngoingStatuses = [...FREIGHT_ONGOING_STATUSES];
      const assignmentOngoingStatuses = [...ASSIGNMENT_ONGOING_STATUSES];

      // 1) FRETES (rurais) - SEM JOIN no produtor (RLS pode bloquear)
      const { data: directFreights, error: freErr } = await supabase
        .from("freights")
        .select(
          `
          id,
          created_at,
          updated_at,
          status,
          cargo_type,
          price,
           metadata,
          weight,
          distance_km,
          origin_address,
          origin_neighborhood, origin_street, origin_number, origin_complement, origin_zip_code,
          destination_address,
          destination_neighborhood, destination_street, destination_number, destination_complement, destination_zip_code,
          origin_city,
          origin_state,
          destination_city,
          destination_state,
          origin_lat,
          origin_lng,
          destination_lat,
          destination_lng,
          pickup_date,
          delivery_date,
          service_type,
          urgency,
          producer_id,
          required_trucks,
          accepted_trucks,
          drivers_assigned,
          current_lat,
          current_lng,
          last_location_update,
          tracking_status
        `
        )
        .eq("driver_id", driverProfileId)
        .in("status", freightOngoingStatuses)
        .order("created_at", { ascending: false });

      if (freErr) throw freErr;

      // 2) Multi-carretas (drivers_assigned) - APENAS fretes OPEN que ainda não estão em assignments
      // ✅ CORREÇÃO: Removida essa busca duplicada pois freight_assignments já cobre esses casos
      // Fretes onde o motorista está em drivers_assigned e tem status OPEN já aparecem via freight_assignments
      // Manter comentado para evitar duplicação de cards no dashboard
      const multiTruckFreights: any[] = []; // Desabilitado para evitar duplicação

      // 3) ASSIGNMENTS (freight_assignments) - busca separada para evitar problemas de RLS
      const { data: assignmentsRaw, error: asgErr } = await supabase
        .from("freight_assignments")
        .select("id, status, agreed_price, accepted_at, company_id, freight_id, driver_id")
        .eq("driver_id", driverProfileId)
        .in("status", assignmentOngoingStatuses)
        .order("accepted_at", { ascending: false });

      if (asgErr) {
        console.warn("[useDriverOngoingCards] Falha ao buscar assignments:", asgErr);
      }

      // ✅ FIX CRÍTICO: Cross-reference com driver_trip_progress e external_payments
      // Para detectar assignments que estão desincronizados (status: ACCEPTED mas já entregues/pagos)
      const assignmentFreightIds = (assignmentsRaw || []).map(a => a.freight_id).filter(Boolean);
      let effectiveAssignments = assignmentsRaw || [];

      if (assignmentFreightIds.length > 0) {
        // Buscar trip_progress para todos os fretes
        const { data: tripProgressData } = await supabase
          .from("driver_trip_progress")
          .select("freight_id, driver_id, current_status")
          .eq("driver_id", driverProfileId)
          .in("freight_id", assignmentFreightIds);

        // Buscar pagamentos terminais para este motorista
        const { data: terminalPayments } = await supabase
          .from("external_payments")
          .select("freight_id, driver_id, status")
          .eq("driver_id", driverProfileId)
          .in("freight_id", assignmentFreightIds)
          .in("status", ["paid_by_producer", "confirmed", "accepted"]);

        const tripMap = new Map(
          (tripProgressData || []).map(tp => [`${tp.freight_id}_${tp.driver_id}`, tp.current_status])
        );
        const paidSet = new Set(
          (terminalPayments || []).map(ep => `${ep.freight_id}_${ep.driver_id}`)
        );

        // Filtrar assignments já completados (trip DELIVERED/COMPLETED + pagamento terminal)
        effectiveAssignments = effectiveAssignments.filter(a => {
          const key = `${a.freight_id}_${a.driver_id || driverProfileId}`;
          const tripStatus = tripMap.get(key);
          const hasPaid = paidSet.has(key);

          // Se trip_progress mostra DELIVERED/COMPLETED E pagamento já foi feito → remover do "em andamento"
          if (tripStatus && ['DELIVERED', 'COMPLETED'].includes(tripStatus) && hasPaid) {
            console.log(`[useDriverOngoingCards] Filtrando assignment ${a.id} - trip=${tripStatus}, pago=${hasPaid}`);
            return false;
          }
          return true;
        });

        // ✅ Atualizar o status efetivo do assignment usando trip_progress como fonte de verdade
        effectiveAssignments = effectiveAssignments.map(a => {
          const key = `${a.freight_id}_${a.driver_id || driverProfileId}`;
          const tripStatus = tripMap.get(key);
          
          // Se trip_progress existe e tem status mais avançado, usar esse status na UI
          if (tripStatus && tripStatus !== a.status) {
            const statusOrder = ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED'];
            const tripIdx = statusOrder.indexOf(tripStatus);
            const assignIdx = statusOrder.indexOf(a.status);
            
            if (tripIdx > assignIdx) {
              return { ...a, status: tripStatus, _effectiveFromTrip: true };
            }
          }
          return a;
        });
      }

      // Buscar os fretes dos assignments separadamente (evita join que pode falhar por RLS)
      const filteredFreightIds = effectiveAssignments.map(a => a.freight_id).filter(Boolean);
      let assignmentFreightsMap: Record<string, OngoingFreightRow> = {};

      if (filteredFreightIds.length > 0) {
        const { data: assignmentFreights, error: afErr } = await supabase
          .from("freights")
          .select(`
            id,
            created_at,
            updated_at,
            status,
            cargo_type,
            price,
             metadata,
            weight,
            distance_km,
            origin_address,
            origin_neighborhood, origin_street, origin_number, origin_complement, origin_zip_code,
            destination_address,
            destination_neighborhood, destination_street, destination_number, destination_complement, destination_zip_code,
            origin_city,
            origin_state,
            destination_city,
            destination_state,
            origin_lat,
            origin_lng,
            destination_lat,
            destination_lng,
            pickup_date,
            delivery_date,
            service_type,
            urgency,
            producer_id,
            required_trucks,
            accepted_trucks,
            drivers_assigned,
            current_lat,
            current_lng,
            last_location_update,
            tracking_status
          `)
          .in("id", filteredFreightIds);

        if (!afErr && assignmentFreights) {
          assignmentFreightsMap = Object.fromEntries(
            assignmentFreights.map(f => [f.id, f as OngoingFreightRow])
          );
        } else if (afErr) {
          console.warn("[useDriverOngoingCards] Falha ao buscar fretes dos assignments:", afErr);
        }
      }

      // Montar assignments com dados dos fretes
      const assignments = effectiveAssignments
        .filter(a => a.freight_id && assignmentFreightsMap[a.freight_id])
        .map(a => ({
          id: a.id,
          status: a.status,
          agreed_price: a.agreed_price,
          accepted_at: a.accepted_at,
          company_id: a.company_id,
          freight: assignmentFreightsMap[a.freight_id!] || null
        }));

      // 4) SERVICE REQUESTS (Moto/Guincho/Mudança) - Usa constantes centralizadas
      const { data: svcReqs, error: svcErr } = await supabase
        .from("service_requests_secure")
        .select("*")
        .eq("provider_id", driverProfileId)
        .in("service_type", [...ONGOING_SERVICE_TYPES])
        .in("status", [...SERVICE_ONGOING_STATUSES])
        .order("accepted_at", { ascending: false })
        .limit(50);

      if (svcErr) {
        console.warn("[useDriverOngoingCards] Falha ao buscar service_requests:", svcErr);
      }

      // 5) Buscar localização atual do motorista para exibir no mapa
      const { data: driverLocation } = await supabase
        .from("driver_current_locations")
        .select("lat, lng, last_gps_update")
        .eq("driver_profile_id", driverProfileId)
        .maybeSingle();

      // Enriquecer service requests com localização do motorista
      const enrichedServiceRequests = (svcReqs || []).map(sr => ({
        ...sr,
        driver_lat: driverLocation?.lat || null,
        driver_lng: driverLocation?.lng || null,
        driver_location_updated: driverLocation?.last_gps_update || null,
      }));

      // Combina fretes diretos + multi-carretas
      const combinedFreights = [...(directFreights || []), ...(multiTruckFreights || [])] as OngoingFreightRow[];
      const uniqueFreights = combinedFreights.reduce((acc, f) => {
        if (!acc.find((x) => x.id === f.id)) acc.push(f);
        return acc;
      }, [] as OngoingFreightRow[]);

      // ✅ EVITAR DUPLICIDADE: se o frete já estiver em freight_assignments, não mostrar também em "Fretes Rurais"
      const assignmentFreightIdsSet = new Set(
        (assignments || []).map((a: any) => a?.freight?.id).filter(Boolean)
      );
      const freightsWithoutAssignmentDuplicates = uniqueFreights.filter((f) => !assignmentFreightIdsSet.has(f.id));

      // ✅ REGRA CRÍTICA: Fretes ACCEPTED com pickup_date futura são AGENDADOS, não "Em Andamento"
      // Usar isInProgressFreight para filtrar corretamente
      const freightsInProgress = freightsWithoutAssignmentDuplicates.filter((f) =>
        isInProgressFreight(f.pickup_date, f.status)
      );

      // ✅ FALLBACK: Buscar dados dos produtores via profiles_secure (evita bloqueio por RLS)
      const allFreightsForProducerLookup = [
        ...freightsInProgress,
        ...(assignments || []).map((a: any) => a.freight).filter(Boolean)
      ];
      const producerIds = [...new Set(allFreightsForProducerLookup.map(f => f.producer_id).filter(Boolean))];

      let producerMap: Record<string, { id: string; full_name: string; profile_photo_url?: string }> = {};
      if (producerIds.length > 0) {
        const { data: producers, error: prodErr } = await (supabase as any)
          .from("profiles_secure")
          .select("id, full_name, profile_photo_url, rating, total_ratings")
          .in("id", producerIds);

        if (!prodErr && producers) {
          producerMap = Object.fromEntries(producers.map((p: any) => [p.id, p]));
        } else if (prodErr) {
          console.warn("[useDriverOngoingCards] Falha ao buscar produtores:", prodErr);
        }
      }

      // Enriquecer fretes com dados do produtor
      const enrichedFreights = freightsInProgress.map(f => ({
        ...f,
        producer: f.producer_id ? producerMap[f.producer_id] || null : null,
        // ✅ REGRA: preferir o valor unitário persistido na criação (metadata.price_per_truck)
        // e, se não existir, cair para o cálculo seguro (total / carretas) apenas para exibição.
        driver_unit_price: (() => {
          const required = Math.max((f.required_trucks ?? 1) || 1, 1);
          const meta = (typeof f.metadata === 'object' && f.metadata) ? (f.metadata as any) : null;
          const metaUnit = meta && typeof meta.price_per_truck === 'number' ? meta.price_per_truck : null;
          if (typeof metaUnit === 'number' && Number.isFinite(metaUnit) && metaUnit > 0) return metaUnit;
          const base = typeof f.price === 'number' && Number.isFinite(f.price) ? f.price : 0;
          return required > 1 ? base / required : base;
        })(),
      }));

      const enrichedAssignments = (assignments || []).filter((a: any) => a?.freight).filter((a: any) => {
        // ✅ REGRA CRÍTICA: Assignments com pickup_date futura e status ACCEPTED são AGENDADOS
        const freight = a.freight;
        if (!freight) return false;
        return isInProgressFreight(freight.pickup_date, a.status);
      }).map((a: any) => ({
        ...a,
        freight: a.freight ? {
          ...a.freight,
          producer: a.freight.producer_id ? producerMap[a.freight.producer_id] || null : null,
          // ✅ Regra: no assignment, o valor unitário do motorista é o agreed_price
          driver_unit_price:
            typeof a.agreed_price === 'number' && Number.isFinite(a.agreed_price) && a.agreed_price > 0
              ? a.agreed_price
              : null,
        } : null
      }));

      return {
        freights: enrichedFreights as OngoingFreightRow[],
        assignments: enrichedAssignments as OngoingAssignmentRow[],
        serviceRequests: enrichedServiceRequests as OngoingServiceRequestRow[],
      };
    },
  });
};

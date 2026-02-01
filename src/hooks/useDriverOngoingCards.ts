import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook exclusivo do Painel do Motorista para garantir que a aba
 * "Fretes Em Andamento" sempre tenha dados completos e consistentes.
 *
 * Objetivos:
 * - Centralizar o fetch (evita regressões por lógica duplicada)
 * - Deduplicar fretes que também existam em freight_assignments
 * - Fornecer dados estáveis para renderização dos cards
 */

export type OngoingFreightRow = {
  id: string;
  created_at: string;
  status: string;
  updated_at?: string | null;
  cargo_type: string | null;
  price: number | null;
  weight: number | null;
  distance_km: number | null;
  origin_address: string | null;
  destination_address: string | null;
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
  city_name: string | null;
  state: string | null;
  problem_description: string | null;
  estimated_price: number | null;
  urgency: string | null;
  is_emergency: boolean | null;
  accepted_at: string | null;
};

export const useDriverOngoingCards = (driverProfileId?: string | null) => {
  return useQuery({
    queryKey: ["driver-ongoing-cards", driverProfileId],
    enabled: Boolean(driverProfileId),
    // ✅ Evita “cards perdidos” por cache/estado antigo
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    queryFn: async () => {
      if (!driverProfileId) {
        return {
          freights: [] as OngoingFreightRow[],
          assignments: [] as OngoingAssignmentRow[],
          serviceRequests: [] as OngoingServiceRequestRow[],
        };
      }

      const freightOngoingStatuses = [
        "ACCEPTED",
        "LOADING",
        "LOADED",
        "IN_TRANSIT",
        "DELIVERED_PENDING_CONFIRMATION",
      ] as const;

      // Status de assignments que devem aparecer na aba "Em Andamento"
      const assignmentOngoingStatuses = [
        "ACCEPTED",
        "LOADING",
        "LOADED",
        "IN_TRANSIT",
        "DELIVERED_PENDING_CONFIRMATION",
        "PENDING", // Motorista pode ter assignment pendente de aceitar
      ] as const;

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
          weight,
          distance_km,
          origin_address,
          destination_address,
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

      // 2) Multi-carretas (drivers_assigned)
      const { data: multiTruckFreights, error: multiTruckError } = await supabase
        .from("freights")
        .select(
          `
          id,
          created_at,
          updated_at,
          status,
          cargo_type,
          price,
          weight,
          distance_km,
          origin_address,
          destination_address,
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
        .contains("drivers_assigned", [driverProfileId])
        .eq("status", "OPEN")
        .order("updated_at", { ascending: false });

      if (multiTruckError) {
        console.warn("[useDriverOngoingCards] Falha ao buscar multi-carretas:", multiTruckError);
      }

      // 3) ASSIGNMENTS (freight_assignments) - busca separada para evitar problemas de RLS
      const { data: assignmentsRaw, error: asgErr } = await supabase
        .from("freight_assignments")
        .select("id, status, agreed_price, accepted_at, company_id, freight_id")
        .eq("driver_id", driverProfileId)
        .in("status", assignmentOngoingStatuses)
        .order("accepted_at", { ascending: false });

      if (asgErr) {
        console.warn("[useDriverOngoingCards] Falha ao buscar assignments:", asgErr);
      }

      // Buscar os fretes dos assignments separadamente (evita join que pode falhar por RLS)
      const assignmentFreightIds = (assignmentsRaw || []).map(a => a.freight_id).filter(Boolean);
      let assignmentFreightsMap: Record<string, OngoingFreightRow> = {};

      if (assignmentFreightIds.length > 0) {
        const { data: assignmentFreights, error: afErr } = await supabase
          .from("freights")
          .select(`
            id,
            created_at,
            updated_at,
            status,
            cargo_type,
            price,
            weight,
            distance_km,
            origin_address,
            destination_address,
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
          .in("id", assignmentFreightIds);

        if (!afErr && assignmentFreights) {
          assignmentFreightsMap = Object.fromEntries(
            assignmentFreights.map(f => [f.id, f as OngoingFreightRow])
          );
        } else if (afErr) {
          console.warn("[useDriverOngoingCards] Falha ao buscar fretes dos assignments:", afErr);
        }
      }

      // Montar assignments com dados dos fretes
      const assignments = (assignmentsRaw || [])
        .filter(a => a.freight_id && assignmentFreightsMap[a.freight_id])
        .map(a => ({
          id: a.id,
          status: a.status,
          agreed_price: a.agreed_price,
          accepted_at: a.accepted_at,
          company_id: a.company_id,
          freight: assignmentFreightsMap[a.freight_id!] || null
        }));

      // 4) SERVICE REQUESTS (Moto/Guincho/Mudança)
      const { data: svcReqs, error: svcErr } = await supabase
        .from("service_requests_secure")
        .select("*")
        .eq("provider_id", driverProfileId)
        .in("service_type", ["GUINCHO", "MUDANCA", "FRETE_URBANO", "FRETE_MOTO"])
        .in("status", ["ACCEPTED", "ON_THE_WAY", "IN_PROGRESS"])
        .order("accepted_at", { ascending: false })
        .limit(50);

      if (svcErr) {
        console.warn("[useDriverOngoingCards] Falha ao buscar service_requests:", svcErr);
      }

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

      // ✅ FALLBACK: Buscar dados dos produtores via profiles_secure (evita bloqueio por RLS)
      const allFreightsForProducerLookup = [
        ...freightsWithoutAssignmentDuplicates,
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
      const enrichedFreights = freightsWithoutAssignmentDuplicates.map(f => ({
        ...f,
        producer: f.producer_id ? producerMap[f.producer_id] || null : null
      }));

      const enrichedAssignments = (assignments || []).filter((a: any) => a?.freight).map((a: any) => ({
        ...a,
        freight: a.freight ? {
          ...a.freight,
          producer: a.freight.producer_id ? producerMap[a.freight.producer_id] || null : null
        } : null
      }));

      return {
        freights: enrichedFreights as OngoingFreightRow[],
        assignments: enrichedAssignments as OngoingAssignmentRow[],
        serviceRequests: (svcReqs || []) as OngoingServiceRequestRow[],
      };
    },
  });
};

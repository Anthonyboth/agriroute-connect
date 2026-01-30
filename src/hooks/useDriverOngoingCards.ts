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
    contact_phone: string | null;
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

      // 1) FRETES (rurais) com JOIN no produtor
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
          tracking_status,
          producer:profiles!freights_producer_id_fkey(
            id,
            full_name,
            contact_phone
          )
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
          tracking_status,
          producer:profiles!freights_producer_id_fkey(
            id,
            full_name,
            contact_phone
          )
        `
        )
        .contains("drivers_assigned", [driverProfileId])
        .eq("status", "OPEN")
        .gt("accepted_trucks", 0)
        .order("updated_at", { ascending: false });

      if (multiTruckError) {
        // Não quebrar a tela por esse fetch (é um “extra”)
        console.warn("[useDriverOngoingCards] Falha ao buscar multi-carretas:", multiTruckError);
      }

      // 3) ASSIGNMENTS (freight_assignments)
      const { data: assignments, error: asgErr } = await supabase
        .from("freight_assignments")
        .select(
          `
          id,
          status,
          agreed_price,
          accepted_at,
          company_id,
          freight:freights(
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
            tracking_status,
            producer:profiles!freights_producer_id_fkey(
              id,
              full_name,
              contact_phone
            )
          )
        `
        )
        .eq("driver_id", driverProfileId)
        .in("status", freightOngoingStatuses)
        .order("accepted_at", { ascending: false });

      if (asgErr) {
        console.warn("[useDriverOngoingCards] Falha ao buscar assignments:", asgErr);
      }

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

      // ✅ EVITAR DUPLICIDADE: se o frete já estiver em freight_assignments, não mostrar também em “Fretes Rurais”
      const assignmentFreightIds = new Set(
        (assignments || []).map((a: any) => a?.freight?.id).filter(Boolean)
      );
      const freightsWithoutAssignmentDuplicates = uniqueFreights.filter((f) => !assignmentFreightIds.has(f.id));

      return {
        freights: freightsWithoutAssignmentDuplicates,
        assignments: (assignments || []).filter((a: any) => a?.freight) as OngoingAssignmentRow[],
        serviceRequests: (svcReqs || []) as OngoingServiceRequestRow[],
      };
    },
  });
};

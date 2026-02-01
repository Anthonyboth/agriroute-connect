/**
 * Hook centralizado para provisionamento e gestão do fluxo de Motorista Afiliado.
 *
 * Objetivo principal (P0): evitar que o usuário exista no auth.users sem ter registro em public.profiles,
 * o que impede o login (fase LOADING_PROFILE).
 *
 * Estratégia: chamar uma Edge Function com validação e rate limit para criar/atualizar o perfil
 * e garantir o vínculo em company_drivers de forma idempotente.
 */

import { useMutation } from './useAsyncOperation';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { useAuth } from './useAuth';
import { useQuery } from '@tanstack/react-query';

const ProvisionAffiliatedDriverInputSchema = z.object({
  companyId: z.string().uuid(),
  fullName: z.string().min(2).max(200),
  cpfCnpj: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length === 11 || v.length === 14, 'CPF/CNPJ inválido'),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export type ProvisionAffiliatedDriverInput = z.infer<typeof ProvisionAffiliatedDriverInputSchema>;

export interface ProvisionAffiliatedDriverResult {
  profileId: string;
  companyDriverId?: string;
  profileStatus?: string;
  companyDriverStatus?: string;
}

export interface DriverAffiliation {
  id: string;
  company_id: string;
  driver_profile_id: string;
  status: string | null;
  affiliation_type: string | null;
  can_accept_freights: boolean | null;
  can_manage_vehicles: boolean | null;
  company?: {
    id: string;
    company_name: string | null;
    company_cnpj: string | null;
  };
}

export interface DriverVehicleAssignment {
  id: string;
  company_id: string;
  driver_profile_id: string;
  vehicle_id: string;
  is_primary: boolean | null;
  removed_at: string | null;
  vehicle?: {
    id: string;
    license_plate: string;
    vehicle_type?: string | null;
    max_capacity_tons?: number | null;
    axle_count?: number | null;
  };
}

interface UseAffiliatedDriverManagerParams {
  /** Quando informado, carrega os vínculos de veículos desta transportadora para o motorista logado */
  companyId?: string | null;
}

export const useAffiliatedDriverManager = (params?: UseAffiliatedDriverManagerParams) => {
  const { profile } = useAuth();
  const companyId = params?.companyId ?? null;

  const provisionMutation = useMutation<ProvisionAffiliatedDriverResult, [ProvisionAffiliatedDriverInput]>(
    async (input) => {
      const parsed = ProvisionAffiliatedDriverInputSchema.parse(input);

      const { data, error } = await supabase.functions.invoke('provision-affiliated-driver', {
        body: {
          company_id: parsed.companyId,
          full_name: parsed.fullName,
          cpf_cnpj: parsed.cpfCnpj,
          phone: parsed.phone,
          email: parsed.email,
        },
      });

      if (error) throw error;
      return data as ProvisionAffiliatedDriverResult;
    },
    {
      // P0: tolerar latência/retry de Edge Functions sem duplicar execução no backend (idempotente lá)
      maxRetries: 2,
      timeout: 15000,
    }
  );

  const affiliationsQuery = useQuery({
    queryKey: ['affiliated-driver', 'affiliations', profile?.id],
    enabled: !!profile?.id,
    queryFn: async (): Promise<DriverAffiliation[]> => {
      const { data, error } = await supabase
        .from('company_drivers')
        .select(
          `
          id,
          company_id,
          driver_profile_id,
          status,
          affiliation_type,
          can_accept_freights,
          can_manage_vehicles,
          company:transport_companies!company_drivers_company_id_fkey(
            id,
            company_name,
            company_cnpj
          )
        `
        )
        .eq('driver_profile_id', profile!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as any;
    },
  });

  const vehicleAssignmentsQuery = useQuery({
    queryKey: ['affiliated-driver', 'vehicle-assignments', profile?.id, companyId],
    enabled: !!profile?.id && !!companyId,
    queryFn: async (): Promise<DriverVehicleAssignment[]> => {
      const { data, error } = await supabase
        .from('company_vehicle_assignments')
        .select(
          `
          id,
          company_id,
          driver_profile_id,
          vehicle_id,
          is_primary,
          removed_at,
          vehicle:vehicles!company_vehicle_assignments_vehicle_id_fkey(
            id,
            license_plate,
            vehicle_type,
            max_capacity_tons,
            axle_count
          )
        `
        )
        .eq('driver_profile_id', profile!.id)
        .eq('company_id', companyId!)
        .is('removed_at', null)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return (data || []) as any;
    },
  });

  return {
    provisionAffiliatedDriver: provisionMutation.execute,
    isProvisioning: provisionMutation.isLoading,
    provisionError: provisionMutation.error,
    provisionResult: provisionMutation.data,
    resetProvision: provisionMutation.reset,

    // Leitura centralizada
    affiliationsQuery,
    vehicleAssignmentsQuery,
  };
};

import { useAuth } from './useAuth';
import { useCompanyDriver } from './useCompanyDriver';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export interface DriverPermissions {
  isAffiliated: boolean;
  canAcceptFreights: boolean;
  canManageVehicles: boolean;
  companyId: string | null;
  companyName: string | null;
  mustUseChat: boolean; // true se afiliado MAS sem can_accept_freights
  hasVehicle: boolean; // true se tem pelo menos 1 veículo cadastrado
  vehicleCheckLoading: boolean;
}

export const useDriverPermissions = (): DriverPermissions => {
  const { profile } = useAuth();
  const { companyDriver, canAcceptFreights: companyCanAccept, canManageVehicles } = useCompanyDriver();
  
  // ✅ PHASE 3: Migrar verificação de veículo para React Query com cache
  const isAutonomous = (profile?.role === 'MOTORISTA' || profile?.role === 'MOTORISTA_AFILIADO') && !companyDriver;
  
  const { data: vehicleCount = 0, isLoading: vehicleCheckLoading } = useQuery({
    queryKey: ['driver-vehicle-count', profile?.id],
    queryFn: async () => {
      if (!profile?.id || !isAutonomous) return 0;
      
      const { count, error } = await supabase
        .from('vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('driver_id', profile.id);
      
      if (error) {
        if (import.meta.env.DEV) {
          console.error('Erro ao verificar veículos:', error);
        }
        return 0;
      }
      
      return count || 0;
    },
    enabled: !!profile?.id && isAutonomous,
    staleTime: 5 * 60 * 1000, // 5 minutos de cache
    gcTime: 10 * 60 * 1000, // 10 minutos de garbage collection
    refetchOnWindowFocus: false,
  });
  
  const hasVehicle = isAutonomous ? vehicleCount > 0 : true; // Afiliados usam veículos da empresa
  
  // ✅ CRÍTICO: Verificar se é AFILIADO (não apenas motorista de empresa)
  const isAffiliatedDriver = companyDriver?.affiliation_type === 'AFFILIATED';
  
  // ✅ Motorista autônomo (sem vínculo) SEMPRE pode aceitar fretes
  // ADICIONADO: Verificação explícita de profile?.id
  const isIndependentDriver = !!profile?.id && !companyDriver && (profile?.role === 'MOTORISTA' || profile?.role === 'MOTORISTA_AFILIADO');
  
  // ✅ Para motorista de empresa, respeitar flag can_accept_freights
  // Para motorista autônomo: pode aceitar se tiver veículo cadastrado
  const canAccept = isIndependentDriver ? hasVehicle : !!companyCanAccept;
  
  return {
    isAffiliated: isAffiliatedDriver,
    canAcceptFreights: canAccept,
    canManageVehicles,
    companyId: companyDriver?.company_id || null,
    companyName: companyDriver?.company?.company_name || null,
    mustUseChat: isAffiliatedDriver && !canAccept,
    hasVehicle,
    vehicleCheckLoading: isAutonomous ? vehicleCheckLoading : false,
  };
};
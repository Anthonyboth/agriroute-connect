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
  
  const { data: vehicleCount = 0, isLoading: vehicleCheckLoading, refetch: refetchVehicleCount } = useQuery({
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
    // ✅ AJUSTADO: Cache moderado para permitir atualização após cadastro de veículo
    staleTime: 30 * 1000, // 30 segundos - permite atualização rápida após cadastro
    gcTime: 5 * 60 * 1000, // 5 minutos de garbage collection
    refetchOnMount: true, // ✅ Refetch ao montar para pegar veículos recém cadastrados
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  
  const hasVehicle = isAutonomous ? vehicleCount > 0 : true; // Afiliados usam veículos da empresa
  
  // ✅ SIMPLIFICADO: Verificar se é afiliado (apenas para info, não bloqueia propostas)
  const isAffiliatedDriver = companyDriver?.affiliation_type === 'AFFILIATED';
  
  // ✅ REGRA NOVA: TODOS os motoristas podem enviar propostas
  // Independente de ser autônomo, afiliado, de empresa, etc.
  // A única verificação é se tem perfil de motorista
  const isDriver = !!profile?.id && ['MOTORISTA', 'MOTORISTA_AFILIADO'].includes(profile?.role || '');
  
  // ✅ TODOS os motoristas podem aceitar fretes agora
  // Removida a restrição de afiliação e can_accept_freights
  const canAccept = isDriver;
  
  return {
    isAffiliated: isAffiliatedDriver,
    // ✅ SEMPRE true para motoristas - sem restrições de proposta
    canAcceptFreights: canAccept,
    canManageVehicles,
    companyId: companyDriver?.company_id || null,
    companyName: companyDriver?.company?.company_name || null,
    // ✅ mustUseChat agora é sempre false - todos podem propor diretamente
    mustUseChat: false,
    hasVehicle,
    vehicleCheckLoading: isAutonomous ? vehicleCheckLoading : false,
  };
};
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useCompanyDriver } from './useCompanyDriver';
import { supabase } from '@/integrations/supabase/client';

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
  
  const [hasVehicle, setHasVehicle] = useState(false);
  const [vehicleCheckLoading, setVehicleCheckLoading] = useState(true);
  
  // Verificar se motorista autônomo tem veículo cadastrado
  useEffect(() => {
    const checkVehicle = async () => {
      if (!profile?.id) {
        setVehicleCheckLoading(false);
        return;
      }
      
      // Só verificar para motoristas autônomos (não afiliados)
      const isAutonomous = (profile?.role === 'MOTORISTA' || profile?.role === 'MOTORISTA_AFILIADO') && !companyDriver;
      
      if (!isAutonomous) {
        setHasVehicle(true); // Afiliados usam veículos da empresa
        setVehicleCheckLoading(false);
        return;
      }
      
      try {
        const { count, error } = await supabase
          .from('vehicles')
          .select('id', { count: 'exact', head: true })
          .eq('driver_id', profile.id);
        
        if (error) {
          console.error('Erro ao verificar veículos:', error);
          setHasVehicle(false);
        } else {
          setHasVehicle((count || 0) > 0);
        }
      } catch (error) {
        console.error('Erro ao verificar veículos:', error);
        setHasVehicle(false);
      } finally {
        setVehicleCheckLoading(false);
      }
    };
    
    checkVehicle();
  }, [profile?.id, profile?.role, companyDriver]);
  
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
    vehicleCheckLoading,
  };
};
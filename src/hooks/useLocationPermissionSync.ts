import { useState, useEffect, useCallback } from 'react';
import { checkPermissionSafe } from '@/utils/location';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Hook que sincroniza a permissão de localização real do dispositivo 
 * com o campo location_enabled no banco de dados.
 * 
 * Resolve o problema onde o banco indica "desativado" mas o dispositivo
 * tem a permissão concedida.
 */
export function useLocationPermissionSync() {
  const { profile, refreshProfile } = useAuth();
  const [isDeviceLocationEnabled, setIsDeviceLocationEnabled] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);

  // Verificar permissão real do dispositivo
  const checkDevicePermission = useCallback(async () => {
    try {
      const granted = await checkPermissionSafe();
      setIsDeviceLocationEnabled(granted);
      return granted;
    } catch (error) {
      console.error('Erro ao verificar permissão de localização:', error);
      setIsDeviceLocationEnabled(false);
      return false;
    }
  }, []);

  // Sincronizar banco com estado real do dispositivo
  const syncWithDatabase = useCallback(async (deviceEnabled: boolean) => {
    if (!profile?.id) return;
    
    // Só sincroniza se houver divergência
    const dbEnabled = profile.location_enabled === true;
    if (dbEnabled === deviceEnabled) {
      setHasSynced(true);
      return;
    }

    setIsSyncing(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ location_enabled: deviceEnabled })
        .eq('id', profile.id);

      if (error) {
        console.error('Erro ao sincronizar location_enabled:', error);
      } else {
        console.log(`✅ location_enabled sincronizado: ${deviceEnabled}`);
        // Atualizar o perfil local
        refreshProfile?.();
      }
    } catch (error) {
      console.error('Erro ao sincronizar permissão:', error);
    } finally {
      setIsSyncing(false);
      setHasSynced(true);
    }
  }, [profile?.id, profile?.location_enabled, refreshProfile]);

  // Executar verificação e sincronização na montagem
  useEffect(() => {
    if (!profile?.id || hasSynced) return;

    const run = async () => {
      const deviceEnabled = await checkDevicePermission();
      await syncWithDatabase(deviceEnabled);
    };

    run();
  }, [profile?.id, hasSynced, checkDevicePermission, syncWithDatabase]);

  return {
    // A localização está ativa? (combinação de dispositivo + banco sincronizado)
    isLocationEnabled: isDeviceLocationEnabled ?? (profile?.location_enabled === true),
    // Permissão real do dispositivo
    isDeviceLocationEnabled,
    // Valor no banco (pode estar desatualizado)
    isDatabaseLocationEnabled: profile?.location_enabled === true,
    // Estado de sincronização
    isSyncing,
    hasSynced,
    // Funções utilitárias
    checkDevicePermission,
    forceSync: () => {
      setHasSynced(false);
      return checkDevicePermission().then(syncWithDatabase);
    }
  };
}

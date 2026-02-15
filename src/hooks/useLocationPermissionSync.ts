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
        if (import.meta.env.DEV) console.log(`✅ location_enabled sincronizado: ${deviceEnabled}`);
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

  // Verificar se há evidência recente de GPS ativo no banco
  const hasRecentGpsEvidence = (() => {
    const lastUpdate = (profile as any)?.last_gps_update;
    if (!lastUpdate) return false;
    const elapsed = Date.now() - new Date(lastUpdate).getTime();
    return elapsed < 10 * 60 * 1000; // 10 minutos
  })();

  // Executar verificação e sincronização na montagem
  useEffect(() => {
    if (!profile?.id || hasSynced) return;

    const run = async () => {
      let deviceEnabled = await checkDevicePermission();

      // Fallback: se checkPermission retornou false mas o banco tem GPS recente,
      // considerar como ativo (falso negativo do Capacitor)
      if (!deviceEnabled && hasRecentGpsEvidence) {
        if (import.meta.env.DEV) console.log('[GPS] checkPermission=false mas banco tem GPS recente — considerando ativo');
        deviceEnabled = true;
        setIsDeviceLocationEnabled(true);
      }

      await syncWithDatabase(deviceEnabled);
    };

    run();
  }, [profile?.id, hasSynced, hasRecentGpsEvidence, checkDevicePermission, syncWithDatabase]);

  return {
    // A localização está ativa? (combinação de dispositivo + banco sincronizado + evidência GPS)
    isLocationEnabled: (isDeviceLocationEnabled ?? (profile?.location_enabled === true)) || hasRecentGpsEvidence,
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

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { showGPSToast } from '@/utils/gpsToastGuard';
import { Navigation, MapPin, Power, PowerOff, Info, AlertTriangle, Ban, Clock, FileWarning, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useActiveFreight } from '@/hooks/useActiveFreight';
import { checkPermissionSafe, requestPermissionSafe, watchPositionSafe, getCurrentPositionSafe, isNative } from '@/utils/location';
import { startForegroundService, stopForegroundService, isForegroundServiceRunning } from '@/utils/foregroundService';
import { supabase } from '@/integrations/supabase/client';
import { useAppStateTracking } from '@/hooks/useAppStateTracking';
import { BackgroundTrackingDisclosureModal } from '@/components/BackgroundTrackingDisclosureModal';
import { GPSPermissionDeniedDialog } from '@/components/GPSPermissionDeniedDialog';

export const UnifiedTrackingControl = () => {
  const { profile } = useAuth();
  const { hasActiveFreight, activeFreightId, activeFreightType } = useActiveFreight();
  const [watchId, setWatchId] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [hasUserGesture, setHasUserGesture] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [showDisclosureModal, setShowDisclosureModal] = useState(false);
  const [pendingAutoStart, setPendingAutoStart] = useState(false);
  const [backgroundEnabled, setBackgroundEnabled] = useState(true);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [gpsLost, setGpsLost] = useState(false); // GPS desligado durante rastreio
  const consecutiveErrorsRef = useRef(0);

  // Evitar spam de toasts de geolocalização (timeouts são comuns em PWA/indoor)
  const lastGeoErrorRef = useRef<{ code?: number; at: number }>({ at: 0 });
  // Prevent double start
  const isStartingRef = useRef(false);

  // Note: buttonClicked listener is iOS-only in the plugin.
  // On Android, tapping the notification opens the app directly.

  // Background pause handler — only called if FGS is NOT running
  const handleBackgroundPause = useCallback(() => {
    if (watchId && !isForegroundServiceRunning()) {
      if (typeof watchId.clear === 'function') {
        watchId.clear();
      }
      setWatchId(null);
      setIsTracking(false);
      setBackgroundEnabled(false);
      toast.info('Rastreamento pausado', {
        description: 'Foreground Service não disponível. Mantenha o app aberto.',
        duration: 8000,
      });
    }
  }, [watchId]);

  useAppStateTracking(isTracking, handleBackgroundPause, backgroundEnabled);

  // Registrar user gesture para auto-tracking
  useEffect(() => {
    const handleUserGesture = () => {
      setHasUserGesture(true);
      document.removeEventListener('click', handleUserGesture);
      document.removeEventListener('touchstart', handleUserGesture);
    };

    document.addEventListener('click', handleUserGesture, { once: true });
    document.addEventListener('touchstart', handleUserGesture, { once: true });

    return () => {
      document.removeEventListener('click', handleUserGesture);
      document.removeEventListener('touchstart', handleUserGesture);
    };
  }, []);

  // Reset hasAutoOpened when active freight changes (new freight accepted or withdrawal)
  const prevFreightIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeFreightId !== prevFreightIdRef.current) {
      prevFreightIdRef.current = activeFreightId ?? null;
      if (activeFreightId && hasAutoOpened) {
        setHasAutoOpened(false);
      }
    }
  }, [activeFreightId, hasAutoOpened]);

  // Auto-abrir disclosure OBRIGATÓRIO quando há frete ativo (sem esperar gesto do usuário)
  useEffect(() => {
    if (
      profile &&
      ['MOTORISTA', 'MOTORISTA_AFILIADO'].includes(profile.role) &&
      hasActiveFreight &&
      !hasAutoOpened
    ) {
      setHasAutoOpened(true);
      sessionStorage.setItem('tracking_modal_shown', '1');

      // Se disclosure ainda não foi aceito nesta sessão, forçar exibição
      if (!sessionStorage.getItem('tracking_disclosure_accepted') && !isTracking) {
        setPendingAutoStart(true);
        setShowDisclosureModal(true);
      } else if (!isTracking && !isStartingRef.current) {
        // Disclosure já aceito — iniciar automaticamente após primeiro gesto
        if (hasUserGesture) {
          executeStartTracking(true);
        } else {
          setIsModalOpen(true);
        }
      }
    }
  }, [profile, hasAutoOpened, hasActiveFreight, hasUserGesture, isTracking]);

  // Auto-tracking quando houver frete ativo + gesto do usuário (pós-disclosure)
  useEffect(() => {
    if (!profile?.id) return;

    if (hasActiveFreight && activeFreightId && hasUserGesture && !isTracking && !isStartingRef.current) {
      if (sessionStorage.getItem('tracking_disclosure_accepted')) {
        executeStartTracking(true);
      }
    }

    // Auto-stop: quando motorista reporta entrega, hasActiveFreight → false
    if (!hasActiveFreight && isTracking) {
      console.log('[UnifiedTrackingControl] Frete não mais ativo — parando rastreamento automaticamente');
      executeStopTracking(true);
      toast.info('Rastreamento encerrado automaticamente', {
        description: 'Entrega reportada — localização não é mais compartilhada.'
      });
    }
  }, [hasActiveFreight, activeFreightId, profile?.id, hasUserGesture, isTracking]);

  const handleGeolocationError = (error: any) => {
    const code = error?.code;
    const message = error?.message || '';
    console.error('Erro no rastreamento:', { code, message, raw: error });

    const now = Date.now();
    const last = lastGeoErrorRef.current;
    
    // Critical errors: GPS permission revoked (1) or position unavailable (2)
    if (code === 1 || code === 2) {
      consecutiveErrorsRef.current++;
      
      // After 2+ consecutive critical errors, mark GPS as lost
      if (consecutiveErrorsRef.current >= 2 && isTracking) {
        console.warn('[GPS] 🔴 GPS LOST — setting gpsLost=true, stopping tracking state');
        setGpsLost(true);
        setIsTracking(false);
        
        // Stop the foreground service since we can't track
        if (isNative()) {
          stopForegroundService().catch(() => {});
        }
        
        // Log incident for active freight
        if (profile?.id && activeFreightId) {
          supabase.from('incident_logs').insert({
            freight_id: activeFreightId,
            incident_type: 'GPS_DISABLED',
            description: 'GPS do dispositivo foi desativado durante frete ativo',
            user_id: profile.id,
            severity: 'HIGH',
            auto_generated: true
          }).then(() => {
            console.log('[GPS] Incident logged: GPS disabled during active freight');
          });
        }
        
        toast.error('⚠️ GPS Desativado!', {
          description: 'A localização do seu celular foi desligada. Ative o GPS para continuar o rastreamento.',
          duration: 15000,
          id: 'gps-lost-critical',
        });
        return;
      }
    } else {
      // Timeout (code 3) — don't count as critical
      if (code !== 3) {
        consecutiveErrorsRef.current++;
      }
    }

    // Deduplicate toast display
    if (now - last.at < 10_000 && last.code === code) return;
    lastGeoErrorRef.current = { code, at: now };
    
    if (code) {
      switch (code) {
        case 1: showGPSToast('NO_PERMISSION'); break;
        case 2: showGPSToast('GPS_UNAVAILABLE'); break;
        case 3: showGPSToast('GPS_TIMEOUT'); break;
        default: showGPSToast('GPS_ERROR'); break;
      }
    } else if (message) {
      showGPSToast('GPS_ERROR');
    }
  };

  // GPS Health Check — periodic probe every 15s while tracking is active
  useEffect(() => {
    if (!isTracking || gpsLost) return;

    const healthCheckInterval = setInterval(async () => {
      try {
        const pos = await getCurrentPositionSafe(1); // 1 retry only
        if (pos?.coords) {
          // GPS is working — reset error counter
          consecutiveErrorsRef.current = 0;
          if (gpsLost) {
            setGpsLost(false);
            toast.success('GPS restaurado', {
              description: 'Localização sendo capturada normalmente.',
              duration: 4000,
              id: 'gps-restored',
            });
          }
        }
      } catch {
        consecutiveErrorsRef.current++;
        console.warn('[GPS-Health] Probe failed, consecutive errors:', consecutiveErrorsRef.current);
        
        if (consecutiveErrorsRef.current >= 3 && isTracking) {
          console.warn('[GPS-Health] 🔴 GPS confirmed LOST after 3 failed probes');
          setGpsLost(true);
          setIsTracking(false);
          
          if (isNative()) {
            stopForegroundService().catch(() => {});
          }
          
          toast.error('⚠️ GPS Desativado!', {
            description: 'A localização do seu celular está desligada. Ative o GPS nas configurações.',
            duration: 15000,
            id: 'gps-lost-critical',
          });
        }
      }
    }, 15_000); // Every 15 seconds

    return () => clearInterval(healthCheckInterval);
  }, [isTracking, gpsLost]);

  // GPS Recovery Check — when gpsLost, try to recover every 10s
  useEffect(() => {
    if (!gpsLost || !hasActiveFreight) return;

    const recoveryInterval = setInterval(async () => {
      try {
        const pos = await getCurrentPositionSafe(1);
        if (pos?.coords) {
          console.log('[GPS-Recovery] ✅ GPS restored! Restarting tracking...');
          setGpsLost(false);
          consecutiveErrorsRef.current = 0;
          toast.success('GPS restaurado!', {
            description: 'Reiniciando rastreamento automaticamente.',
            duration: 5000,
            id: 'gps-restored',
          });
          // Auto-restart tracking
          executeStartTracking(true);
        }
      } catch {
        // Still lost — keep waiting
      }
    }, 10_000);

    return () => clearInterval(recoveryInterval);
  }, [gpsLost, hasActiveFreight]);

  // Handle disclosure modal accept
  const handleDisclosureAccept = () => {
    sessionStorage.setItem('tracking_disclosure_accepted', '1');
    setShowDisclosureModal(false);
    if (pendingAutoStart) {
      setPendingAutoStart(false);
      executeStartTracking(true);
    } else {
      executeStartTracking(false);
    }
  };

  const handleDisclosureCancel = () => {
    setShowDisclosureModal(false);
    setPendingAutoStart(false);
  };

  // User clicks "Iniciar" button
  const handleStartClick = () => {
    if (isTracking) return;
    // Show disclosure if not accepted this session
    if (!sessionStorage.getItem('tracking_disclosure_accepted')) {
      setShowDisclosureModal(true);
    } else {
      executeStartTracking(false);
    }
  };

  const executeStartTracking = async (isAuto = false) => {
    if (isTracking || isStartingRef.current) return;
    isStartingRef.current = true;

    try {
      const hasPermission = await checkPermissionSafe();
      if (!hasPermission) {
        const granted = await requestPermissionSafe();
        if (!granted) {
          console.warn('[GPS] Permission denied (OS-PLUG-GLOC-0003) — showing settings dialog');
          setShowPermissionDialog(true);
          isStartingRef.current = false;
          return;
        }
      }

      const delay = isAuto ? 3000 : 0;
      
      setTimeout(async () => {
        try {
          // First reading
          const initial = await getCurrentPositionSafe(3);
          await updateLocation(initial.coords);
        } catch (e) {
          handleGeolocationError(e);
        }

        // Start Android Foreground Service BEFORE watchPosition
        if (isNative()) {
          console.log('[FGS] Starting foreground service before watchPosition...');
          const fgsStarted = await startForegroundService();
          setBackgroundEnabled(fgsStarted);
          if (!fgsStarted) {
            console.warn('[FGS] start failed — background tracking will not work');
            showGPSToast('FGS_DENIED');
          }
        }

        console.log('[GPS] Starting watchPosition...');
        const handle = watchPositionSafe(
          (coords) => updateLocation(coords),
          (error) => handleGeolocationError(error)
        );
        console.log('[GPS] watch started');

        setWatchId(handle);
        setIsTracking(true);
        isStartingRef.current = false;

        if (!isAuto) {
          toast.success('Rastreamento ativado', {
            description: isNative() ? 'Rastreio continua em segundo plano.' : undefined
          });
        }
      }, delay);

    } catch (error) {
      console.error('Erro ao iniciar tracking:', error);
      handleGeolocationError(error);
      isStartingRef.current = false;
    }
  };

  const handleStopRequest = () => {
    if (hasActiveFreight) {
      setShowPenaltyModal(true);
      return;
    }
    executeStopTracking();
  };

  const executeStopTracking = async (silent?: boolean) => {
    console.log('[GPS] Stopping tracking...');
    if (watchId) {
      if (typeof watchId.clear === 'function') {
        watchId.clear();
        console.log('[GPS] watch stopped');
      }
    }
    // Always try to stop FGS
    if (isNative()) {
      console.log('[FGS] Stopping foreground service...');
      await stopForegroundService();
    }
    setWatchId(null);
    setIsTracking(false);
    setShowPenaltyModal(false);
    isStartingRef.current = false;
    if (!silent) {
      toast.info('Rastreamento pausado');
    }
  };

  const confirmStopWithPenalty = () => {
    if (profile?.id && activeFreightId) {
      supabase.from('incident_logs').insert({
        freight_id: activeFreightId,
        incident_type: 'GPS_DISABLED',
        description: 'Motorista desativou rastreamento manualmente durante frete ativo',
        user_id: profile.id,
        severity: 'HIGH',
        auto_generated: false
      }).then(() => {
        if (import.meta.env.DEV) console.log('[UnifiedTrackingControl] Incident logged for GPS disable');
      });
    }
    executeStopTracking(true);
    toast.warning('Incidente registrado: rastreamento desativado durante frete ativo');
  };

  const updateLocation = async (coords: GeolocationCoordinates) => {
    if (!profile?.id) return;
    
    // GPS is working — reset error counter and gpsLost state
    consecutiveErrorsRef.current = 0;
    if (gpsLost) setGpsLost(false);

    try {
      const timestamp = new Date().toISOString();

      await supabase
        .from('driver_current_locations')
        .upsert(
          {
            driver_profile_id: profile.id,
            lat: coords.latitude,
            lng: coords.longitude,
            last_gps_update: timestamp,
            updated_at: timestamp,
          },
          { onConflict: 'driver_profile_id' }
        );

      await supabase
        .from('profiles')
        .update({
          current_location_lat: coords.latitude,
          current_location_lng: coords.longitude,
          last_gps_update: timestamp
        })
        .eq('id', profile.id);

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erro ao atualizar localização:', error);
    }
  };

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  if (!profile || !['MOTORISTA', 'MOTORISTA_AFILIADO'].includes(profile.role)) {
    return null;
  }

  // Não mostrar controle de rastreamento se não há frete ativo
  if (!hasActiveFreight) {
    return null;
  }

  return (
    <>
      {/* GPS Permission Denied Dialog — guides user to device settings */}
      <GPSPermissionDeniedDialog 
        open={showPermissionDialog} 
        onOpenChange={setShowPermissionDialog} 
      />

      {/* Disclosure Modal (Google Play compliance) */}
      <BackgroundTrackingDisclosureModal
        open={showDisclosureModal}
        onAccept={handleDisclosureAccept}
        onCancel={handleDisclosureCancel}
      />

      {/* Versão compacta (sempre visível) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-card rounded-lg border mb-4">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={toggleModal}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && toggleModal()}
        >
          <Navigation className={`h-5 w-5 flex-shrink-0 ${isTracking ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
          <span className="font-medium text-sm">Rastreamento</span>
          <Info className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        </div>
        
        <div className="flex items-center gap-3 flex-shrink-0">
          <Badge variant={isTracking ? "default" : "secondary"} className="text-xs whitespace-nowrap">
            {isTracking ? (
              <>
                <MapPin className="h-3 w-3 mr-1 animate-pulse" />
                Ativo
              </>
            ) : (
              <>
                <PowerOff className="h-3 w-3 mr-1" />
                Pausado
              </>
            )}
          </Badge>
          
          <Button
            onClick={isTracking ? handleStopRequest : handleStartClick}
            variant={isTracking ? "destructive" : "default"}
            size="sm"
            className="whitespace-nowrap"
          >
            {isTracking ? (
              <>
                <PowerOff className="h-4 w-4 mr-1" />
                Parar
              </>
            ) : (
              <>
                <Power className="h-4 w-4 mr-1" />
                Iniciar
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Modal com detalhes */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5" />
              Rastreamento de Localização
            </DialogTitle>
            <DialogDescription>
              Controle quando sua localização é compartilhada para segurança do frete.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Status atual */}
            <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
              <span className="text-sm font-medium">Status atual:</span>
              <Badge variant={isTracking ? "default" : "secondary"}>
                {isTracking ? '🟢 Ativo' : '⚪ Pausado'}
              </Badge>
            </div>

            {lastUpdate && isTracking && (
              <p className="text-xs text-muted-foreground text-center">
                Última atualização: {lastUpdate.toLocaleTimeString()}
              </p>
            )}

            {/* Informações */}
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Rastreamento com Segundo Plano</AlertTitle>
              <AlertDescription className="text-xs">
                Quando ativo, o rastreamento <strong>continua funcionando</strong> mesmo com o app minimizado
                ou tela bloqueada, garantindo segurança da carga durante toda a viagem.
                Uma notificação persistente silenciosa será exibida.
              </AlertDescription>
            </Alert>

            <Alert variant="default">
              <Info className="h-4 w-4" />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription className="text-xs">
                O rastreamento é encerrado automaticamente ao finalizar a viagem.
                Nenhum dado é coletado fora do período do frete.
              </AlertDescription>
            </Alert>

            {!hasActiveFreight && (
              <p className="text-sm text-muted-foreground text-center bg-secondary/20 p-3 rounded-lg">
                ℹ️ Nenhum frete ativo no momento. O rastreamento não é obrigatório.
              </p>
            )}

            {/* Botão de ação */}
            <Button
              onClick={isTracking ? handleStopRequest : handleStartClick}
              variant={isTracking ? "destructive" : "default"}
              className="w-full"
            >
              {isTracking ? (
                <>
                  <PowerOff className="h-4 w-4 mr-2" />
                  Parar Rastreamento
                </>
              ) : (
                <>
                  <Power className="h-4 w-4 mr-2" />
                  Iniciar Rastreamento
                </>
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsModalOpen(false)}
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Penalidade por desativar rastreamento durante frete ativo */}
      <Dialog open={showPenaltyModal} onOpenChange={setShowPenaltyModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Atenção: Rastreamento Obrigatório
            </DialogTitle>
            <DialogDescription>
              Durante um frete em andamento, o rastreamento é obrigatório por questões de segurança e compliance.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <Alert variant="destructive">
              <FileWarning className="h-4 w-4" />
              <AlertTitle>Desativar o rastreamento pode resultar em:</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <Ban className="h-3 w-3 flex-shrink-0" />
                    <span>Multa de R$ 50,00</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="h-3 w-3 flex-shrink-0" />
                    <span>Suspensão temporária da conta</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <FileWarning className="h-3 w-3 flex-shrink-0" />
                    <span>Registro de incidente no histórico</span>
                  </li>
                </ul>
              </AlertDescription>
            </Alert>

            <p className="text-sm text-muted-foreground text-center">
              O produtor e a plataforma dependem da sua localização para garantir a segurança da carga.
            </p>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="default" 
              onClick={() => setShowPenaltyModal(false)}
              className="w-full sm:w-auto"
            >
              <Navigation className="h-4 w-4 mr-2" />
              Manter Ativo
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmStopWithPenalty}
              className="w-full sm:w-auto"
            >
              <PowerOff className="h-4 w-4 mr-2" />
              Desativar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
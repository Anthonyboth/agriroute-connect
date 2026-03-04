import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Navigation, MapPin, Power, PowerOff, Info, AlertTriangle, Ban, Clock, FileWarning } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useActiveFreight } from '@/hooks/useActiveFreight';
import { checkPermissionSafe, requestPermissionSafe, watchPositionSafe, getCurrentPositionSafe, isNative } from '@/utils/location';
import { startForegroundService, stopForegroundService } from '@/utils/foregroundService';
import { supabase } from '@/integrations/supabase/client';

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

  // Evitar spam de toasts de geolocalização (timeouts são comuns em PWA/indoor)
  const lastGeoErrorRef = useRef<{ code?: number; at: number }>({ at: 0 });

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

  // Auto-abrir modal APENAS com frete ativo + 1x por sessão
  useEffect(() => {
    if (
      profile &&
      ['MOTORISTA', 'MOTORISTA_AFILIADO'].includes(profile.role) &&
      hasActiveFreight &&
      !hasAutoOpened &&
      !sessionStorage.getItem('tracking_modal_shown')
    ) {
      setIsModalOpen(true);
      setHasAutoOpened(true);
      sessionStorage.setItem('tracking_modal_shown', '1');
    }
  }, [profile, hasAutoOpened, hasActiveFreight]);

  // Auto-tracking quando houver frete ativo + auto-stop quando não há mais
  useEffect(() => {
    if (!profile?.id) return;

    if (hasActiveFreight && activeFreightId && hasUserGesture && !isTracking) {
      startTracking(true);
    }

    // ✅ Auto-stop: quando motorista reporta entrega, hasActiveFreight → false
    if (!hasActiveFreight && isTracking) {
      console.log('[UnifiedTrackingControl] Frete não mais ativo — parando rastreamento automaticamente');
      executeStopTracking(true);
      toast.info('Rastreamento encerrado automaticamente', {
        description: 'Entrega reportada — localização não é mais compartilhada.'
      });
    }

    return () => {
      // Cleanup handled by stopTracking
    };
  }, [hasActiveFreight, activeFreightId, profile?.id, hasUserGesture, isTracking]);

  const handleGeolocationError = (error: any) => {
    // GeolocationPositionError possui props não-enumeráveis (aparece como {})
    const code = error?.code;
    const message = error?.message;
    console.error('Erro no rastreamento:', { code, message, raw: error });

    // Debounce de 10s para não travar UX com toasts repetidos
    const now = Date.now();
    const last = lastGeoErrorRef.current;
    if (now - last.at < 10_000 && last.code === code) return;
    lastGeoErrorRef.current = { code, at: now };
    
    if (code) {
      switch (code) {
        case 1:
          toast.error('Permissão de localização negada', {
            description: 'Ative nas configurações do dispositivo.'
          });
          break;
        case 2:
          toast.error('Localização indisponível', {
            description: 'Verifique se o GPS está ativado.'
          });
          break;
        case 3:
          // Timeout é recuperável: manter tracking e avisar sem bloquear
          toast.warning('GPS demorando para responder', {
            description: 'Se estiver em local fechado, mova-se para uma área aberta e tente novamente.'
          });
          break;
        default:
          toast.error('Erro ao rastrear localização');
      }
    } else if (message) {
      toast.error('Erro ao rastrear localização', { description: message });
    }
  };

  const startTracking = async (isAuto = false) => {
    if (isTracking) return;

    try {
      const hasPermission = await checkPermissionSafe();
      if (!hasPermission) {
        const granted = await requestPermissionSafe();
        if (!granted) {
          toast.error('Permissão de localização negada');
          return;
        }
      }

      const delay = isAuto ? 3000 : 0;
      
      setTimeout(async () => {
        try {
          // ✅ Primeira leitura com retries/timeout maior (reduz ocorrência de timeout do watchPosition)
          const initial = await getCurrentPositionSafe(3);
          await updateLocation(initial.coords);
        } catch (e) {
          // Não bloquear o tracking: o watchPosition pode recuperar depois
          handleGeolocationError(e);
        }

        // ✅ Start Android Foreground Service BEFORE watchPosition
        if (isNative()) {
          await startForegroundService();
        }

        const handle = watchPositionSafe(
          (coords) => updateLocation(coords),
          (error) => handleGeolocationError(error)
        );

        setWatchId(handle);
        setIsTracking(true);

        if (!isAuto) {
          toast.success('Rastreamento ativado');
        }
      }, delay);

    } catch (error) {
      console.error('Erro ao iniciar tracking:', error);
      handleGeolocationError(error);
    }
  };

  const handleStopRequest = () => {
    // Se tem frete ativo, mostrar modal de penalidade antes
    if (hasActiveFreight) {
      setShowPenaltyModal(true);
      return;
    }
    executeStopTracking();
  };

  const executeStopTracking = async (silent?: boolean) => {
    if (watchId) {
      if (typeof watchId.clear === 'function') {
        watchId.clear();
      }
      // ✅ Stop Android Foreground Service
      if (isNative()) {
        await stopForegroundService();
      }
      setWatchId(null);
      setIsTracking(false);
      setShowPenaltyModal(false);
      if (!silent) {
        toast.info('Rastreamento pausado');
      }
    }
  };

  const confirmStopWithPenalty = () => {
    // Registrar incidente no banco
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

    try {
      const timestamp = new Date().toISOString();

      // ✅ Persistir na tabela dedicada (fonte principal para mapas)
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

      // ✅ Atualizar profiles (fallback)
      await supabase
        .from('profiles')
        .update({
          current_location_lat: coords.latitude,
          current_location_lng: coords.longitude,
          last_gps_update: timestamp
        })
        .eq('id', profile.id);

      // ❌ REMOVIDO: Atualização direta na tabela freights
      // Isso causava erro "Data de coleta deve ser futura" devido ao trigger validate_freight_input
      // A localização agora é lida de driver_current_locations pelo hook useFreightRealtimeLocation

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

  return (
    <>
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
            onClick={isTracking ? handleStopRequest : () => startTracking(false)}
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
              <Navigation className="h-4 w-4" />
              <AlertTitle>Rastreamento Automático</AlertTitle>
              <AlertDescription className="text-xs">
                Quando você tem um frete ativo, o rastreamento é iniciado automaticamente 
                para segurança e tracking do frete. Ele será encerrado quando o frete for concluído.
              </AlertDescription>
            </Alert>

            <Alert variant="default">
              <Info className="h-4 w-4" />
              <AlertTitle>Rastreamento Manual</AlertTitle>
              <AlertDescription className="text-xs">
                Você pode controlar manualmente quando sua localização é compartilhada. 
                O rastreamento só é necessário quando você tem um frete ativo.
              </AlertDescription>
            </Alert>

            {!hasActiveFreight && (
              <p className="text-sm text-muted-foreground text-center bg-secondary/20 p-3 rounded-lg">
                ℹ️ Nenhum frete ativo no momento. O rastreamento não é obrigatório.
              </p>
            )}

            {/* Botão de ação */}
            <Button
              onClick={isTracking ? handleStopRequest : () => startTracking(false)}
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

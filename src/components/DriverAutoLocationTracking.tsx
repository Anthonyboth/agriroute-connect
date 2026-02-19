/**
 * DriverAutoLocationTracking (v3 — Arquitetura Robusta)
 *
 * Componente de rastreamento automático de localização para motoristas com frete ativo.
 * Usa a nova camada de hooks modulares:
 *   - useLocationSecurityMonitor: captura e status
 *   - useLocationPersistence: salva no banco 1x/min
 *   - useLocationFraudSignals: sinais antifraude
 *   - locationAlertManager: controle de spam de alertas
 *
 * GARANTIAS:
 *   ✅ Zero falso positivo de "GPS desligado"
 *   ✅ Zero spam de notificações
 *   ✅ Funciona em Android Chrome, WebView e Capacitor
 *   ✅ Salva no banco 1x/min com dedupe por distância
 *   ✅ Antifraude recebe sinais consistentes
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useActiveFreight } from '@/hooks/useActiveFreight';
import { isNative } from '@/utils/location';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Navigation, AlertTriangle, WifiOff } from 'lucide-react';
import { GPSPermissionDeniedDialog } from '@/components/GPSPermissionDeniedDialog';
import { useLocationSecurityMonitor } from '@/hooks/location/useLocationSecurityMonitor';
import { useLocationPersistence } from '@/hooks/location/useLocationPersistence';
import { useLocationFraudSignals } from '@/hooks/location/useLocationFraudSignals';
import { LocationDebugPanel } from '@/components/debug/LocationDebugPanel';
import { useState } from 'react';

const DRIVER_ROLES = ['MOTORISTA', 'MOTORISTA_AFILIADO', 'GUINCHO', 'MOTO_FRETE'];

// Status de frete que requerem tracking ativo
const ACTIVE_FREIGHT_STATUSES = ['LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'];

export const DriverAutoLocationTracking = () => {
  const { profile } = useAuth();
  const { hasActiveFreight, activeFreightId } = useActiveFreight();
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [hasUserGesture, setHasUserGesture] = useState(false);

  const isDriver = profile && DRIVER_ROLES.includes(profile.role);

  // ── Hooks de localização ──────────────────────────────────────────────────
  const {
    status,
    coords,
    permission,
    lastFixAt,
    start,
    stop,
    requestPermission,
    debug,
  } = useLocationSecurityMonitor();

  const { persist, lastSentAt } = useLocationPersistence({
    driverProfileId: profile?.id ?? null,
    freightId: activeFreightId ?? null,
  });

  const { analyze } = useLocationFraudSignals({
    freightId: activeFreightId ?? null,
    driverProfileId: profile?.id ?? null,
  });

  // ── Capturar primeiro gesto do usuário (web) ──────────────────────────────
  useEffect(() => {
    if (isNative()) {
      setHasUserGesture(true);
      return;
    }
    const handle = () => setHasUserGesture(true);
    document.addEventListener('click', handle, { once: true });
    document.addEventListener('touchstart', handle, { once: true });
    return () => {
      document.removeEventListener('click', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, []);

  // ── Iniciar/parar tracking conforme frete ativo ───────────────────────────
  const isTrackingRef = useRef(false);

  useEffect(() => {
    const shouldTrack = !!(
      isDriver &&
      profile?.id &&
      hasActiveFreight &&
      activeFreightId &&
      (isNative() || hasUserGesture)
    );

    if (shouldTrack && !isTrackingRef.current) {
      isTrackingRef.current = true;
      start();
    } else if (!shouldTrack && isTrackingRef.current) {
      isTrackingRef.current = false;
      stop();
    }

    return () => {
      if (isTrackingRef.current) {
        isTrackingRef.current = false;
        stop();
      }
    };
  }, [isDriver, profile?.id, hasActiveFreight, activeFreightId, hasUserGesture, start, stop]);

  // ── Persistir e analisar fraude quando coordenadas chegarem ──────────────
  const lastPersistedRef = useRef<number>(0);

  useEffect(() => {
    if (!coords || !hasActiveFreight || !profile?.id) return;

    const now = Date.now();
    // Garantir mínimo de 60s entre chamadas de persist (o hook já tem throttle interno)
    if (now - lastPersistedRef.current < 60_000) return;
    lastPersistedRef.current = now;

    // Persistir no banco
    persist(coords);

    // Analisar sinais antifraude
    analyze(coords);
  }, [coords, hasActiveFreight, profile?.id, persist, analyze]);

  // ── Exibir dialog de permissão quando necessário ──────────────────────────
  useEffect(() => {
    if (status === 'NO_PERMISSION') {
      setShowPermissionDialog(true);
    }
  }, [status]);

  // ── Render ────────────────────────────────────────────────────────────────

  // Sempre renderizar o dialog (para casos sem frete ativo também)
  const dialogEl = (
    <GPSPermissionDeniedDialog
      open={showPermissionDialog}
      onOpenChange={setShowPermissionDialog}
    />
  );

  // Se não é motorista ou não tem frete ativo → só o dialog
  if (!isDriver || !hasActiveFreight || !profile) {
    return dialogEl;
  }

  const isTracking = status === 'OK' || status === 'LOW_ACCURACY';
  const isError = status === 'NO_PERMISSION' || status === 'GPS_OFF';

  return (
    <>
      {isTracking && (
        <Alert className="mb-4">
          <Navigation className="h-4 w-4 animate-pulse" />
          <AlertTitle>Rastreamento Automático Ativo</AlertTitle>
          <AlertDescription>
            Sua localização está sendo rastreada para segurança do frete.
            {status === 'LOW_ACCURACY' && ' (Sinal fraco — tente se mover para área aberta.)'}
          </AlertDescription>
        </Alert>
      )}

      {status === 'UNAVAILABLE' && (
        <Alert variant="default" className="mb-4">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Localização indisponível</AlertTitle>
          <AlertDescription>
            Aguardando sinal GPS. Verifique se está em área aberta.
          </AlertDescription>
        </Alert>
      )}

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {status === 'NO_PERMISSION' ? 'Permissão de localização negada' : 'GPS desligado'}
          </AlertTitle>
          <AlertDescription>
            {status === 'NO_PERMISSION'
              ? 'Ative a permissão de localização nas configurações do dispositivo.'
              : 'Ative o GPS (serviços de localização) nas configurações do dispositivo.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Painel de debug — apenas DEV */}
      {import.meta.env.DEV && (
        <LocationDebugPanel
          status={status}
          permission={permission}
          lastFixAt={lastFixAt}
          coords={coords}
          debug={debug}
          lastSentAt={lastSentAt}
        />
      )}

      {dialogEl}
    </>
  );
};

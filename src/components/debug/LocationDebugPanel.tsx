/**
 * LocationDebugPanel
 *
 * Painel interno de debug de localização (apenas DEV ou flag ativa).
 * Mostra: status, permissão, accuracy, último fix, timers, plataforma.
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LocationStatus, PermissionState, LocationDebugInfo, LocationCoords } from '@/hooks/location/useLocationSecurityMonitor';

interface LocationDebugPanelProps {
  status: LocationStatus;
  permission: PermissionState;
  lastFixAt: string | null;
  coords: LocationCoords | null;
  debug: LocationDebugInfo;
  lastSentAt?: string | null;
}

const statusColor: Record<LocationStatus, string> = {
  IDLE: 'secondary',
  OK: 'default',
  LOW_ACCURACY: 'outline',
  TIMEOUT: 'outline',
  UNAVAILABLE: 'outline',
  NO_PERMISSION: 'destructive',
  GPS_OFF: 'destructive',
  BACKGROUND_RESTRICTED: 'destructive',
} as const;

export const LocationDebugPanel = ({
  status,
  permission,
  lastFixAt,
  coords,
  debug,
  lastSentAt,
}: LocationDebugPanelProps) => {
  if (!import.meta.env.DEV) return null;

  return (
    <Card className="border-dashed border-warning/50 bg-warning/5 text-xs font-mono">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-xs font-semibold text-foreground/70">
          🛰️ GPS Debug Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-3 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-28">Status:</span>
          <Badge variant={statusColor[status] as any}>{status}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-28">Permission:</span>
          <Badge variant={permission === 'granted' ? 'default' : 'destructive'}>{permission}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-28">Platform:</span>
          <span>{debug.platform} {debug.isCapacitor ? '(Capacitor)' : '(Web)'} {debug.isAndroid ? '🤖' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-28">Watch ativo:</span>
          <Badge variant={debug.watchActive ? 'default' : 'secondary'}>{debug.watchActive ? 'SIM' : 'NÃO'}</Badge>
        </div>
        {coords && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-28">Coords:</span>
              <span>{coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-28">Accuracy:</span>
              <span className={coords.accuracy > 150 ? 'text-orange-500' : 'text-green-600'}>
                {coords.accuracy.toFixed(0)}m
              </span>
            </div>
          </>
        )}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-28">Último fix:</span>
          <span>{lastFixAt ? new Date(lastFixAt).toLocaleTimeString('pt-BR') : '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-28">Último envio:</span>
          <span>{lastSentAt ? new Date(lastSentAt).toLocaleTimeString('pt-BR') : '—'}</span>
        </div>
        {debug.lastErrorCode !== null && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-28">Último erro:</span>
            <span className="text-destructive">
              Código {debug.lastErrorCode}: {debug.lastErrorMessage ?? ''}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-28">Erros consec.:</span>
          <span className={debug.consecutiveErrors > 3 ? 'text-destructive' : ''}>
            {debug.consecutiveErrors}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

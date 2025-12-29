import React from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Wifi, WifiOff, RefreshCw, Cloud, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OfflineIndicatorProps {
  compact?: boolean;
  showSyncButton?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ 
  compact = false, 
  showSyncButton = true 
}) => {
  const { 
    isOnline, 
    isSyncing, 
    syncQueueCount, 
    lastSyncAt, 
    processSyncQueue 
  } = useOfflineSync();

  if (isOnline && syncQueueCount === 0 && compact) {
    return null; // Don't show anything when online and no pending items in compact mode
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              {isOnline ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-amber-500" />
              )}
              {syncQueueCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {syncQueueCount}
                </Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isOnline ? 'Online' : 'Offline'}
              {syncQueueCount > 0 && ` • ${syncQueueCount} ação(ões) pendente(s)`}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
      isOnline 
        ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
        : 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
    }`}>
      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
        isOnline 
          ? 'bg-green-100 dark:bg-green-900' 
          : 'bg-amber-100 dark:bg-amber-900'
      }`}>
        {isOnline ? (
          <Cloud className="h-5 w-5 text-green-600 dark:text-green-400" />
        ) : (
          <CloudOff className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${
          isOnline 
            ? 'text-green-800 dark:text-green-200' 
            : 'text-amber-800 dark:text-amber-200'
        }`}>
          {isOnline ? 'Conectado' : 'Modo Offline'}
        </p>
        <p className="text-xs text-muted-foreground">
          {syncQueueCount > 0 
            ? `${syncQueueCount} ação(ões) aguardando sincronização`
            : isOnline
              ? lastSyncAt 
                ? `Última sincronização: ${lastSyncAt.toLocaleTimeString('pt-BR')}`
                : 'Dados sincronizados'
              : 'Suas alterações serão sincronizadas quando a conexão voltar'
          }
        </p>
      </div>

      {showSyncButton && isOnline && syncQueueCount > 0 && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => processSyncQueue()}
          disabled={isSyncing}
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
        </Button>
      )}
    </div>
  );
};

// Banner version for displaying at top of page
export const OfflineBanner: React.FC = () => {
  const { isOnline, syncQueueCount } = useOfflineSync();

  if (isOnline && syncQueueCount === 0) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 py-2 px-4 text-center text-sm font-medium ${
      isOnline 
        ? 'bg-blue-500 text-white' 
        : 'bg-amber-500 text-white'
    }`}>
      {isOnline ? (
        <>
          <RefreshCw className="h-4 w-4 inline-block mr-2 animate-spin" />
          Sincronizando {syncQueueCount} alteração(ões)...
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 inline-block mr-2" />
          Você está offline. Suas alterações serão salvas localmente.
        </>
      )}
    </div>
  );
};

/**
 * Hook para monitorar estado de conexão de rede
 * Fornece informações detalhadas sobre conectividade
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

interface NetworkState {
  /** Se está online */
  isOnline: boolean;
  /** Se a conexão está lenta */
  isSlowConnection: boolean;
  /** Tipo de conexão (wifi, cellular, etc) */
  connectionType: string | null;
  /** Downlink efetivo em Mbps */
  downlink: number | null;
  /** RTT estimado em ms */
  rtt: number | null;
  /** Se está em modo de economia de dados */
  saveData: boolean;
  /** Timestamp da última verificação */
  lastCheck: Date | null;
  /** Latência para o servidor em ms */
  serverLatency: number | null;
}

interface NetworkMonitorOptions {
  /** URL para testar conectividade */
  pingUrl?: string;
  /** Intervalo de verificação em ms */
  checkIntervalMs?: number;
  /** Mostrar toasts de mudança de conexão */
  showToasts?: boolean;
  /** Limite de RTT para considerar lento em ms */
  slowThresholdMs?: number;
  /** Callback quando fica offline */
  onOffline?: () => void;
  /** Callback quando fica online */
  onOnline?: () => void;
  /** Callback quando conexão fica lenta */
  onSlowConnection?: () => void;
}

export function useNetworkMonitor(options: NetworkMonitorOptions = {}) {
  const {
    pingUrl = '/api/ping',
    checkIntervalMs = 30000,
    showToasts = true,
    slowThresholdMs = 3000,
    onOffline,
    onOnline,
    onSlowConnection,
  } = options;

  const [state, setState] = useState<NetworkState>({
    isOnline: navigator.onLine,
    isSlowConnection: false,
    connectionType: null,
    downlink: null,
    rtt: null,
    saveData: false,
    lastCheck: null,
    serverLatency: null,
  });

  const wasOnlineRef = useRef(navigator.onLine);
  const wasSlowRef = useRef(false);
  const mountedRef = useRef(true);

  // Atualizar informações de conexão
  const updateConnectionInfo = useCallback(() => {
    const connection = (navigator as any).connection || 
                       (navigator as any).mozConnection || 
                       (navigator as any).webkitConnection;

    if (connection) {
      setState(prev => ({
        ...prev,
        connectionType: connection.effectiveType || connection.type || null,
        downlink: connection.downlink || null,
        rtt: connection.rtt || null,
        saveData: connection.saveData || false,
        isSlowConnection: (connection.rtt || 0) > slowThresholdMs || 
                          connection.effectiveType === 'slow-2g' ||
                          connection.effectiveType === '2g',
      }));
    }
  }, [slowThresholdMs]);

  // Verificar latência com o servidor
  const checkServerLatency = useCallback(async () => {
    if (!navigator.onLine) return;

    try {
      const start = performance.now();
      const response = await fetch(pingUrl, { 
        method: 'HEAD',
        cache: 'no-store',
      });
      const latency = performance.now() - start;

      if (mountedRef.current) {
        const isSlow = latency > slowThresholdMs;
        
        setState(prev => ({
          ...prev,
          serverLatency: Math.round(latency),
          lastCheck: new Date(),
          isSlowConnection: isSlow || prev.isSlowConnection,
        }));

        // Notificar conexão lenta
        if (isSlow && !wasSlowRef.current) {
          wasSlowRef.current = true;
          onSlowConnection?.();
          
          if (showToasts) {
            toast({
              title: 'Conexão lenta',
              description: 'Sua conexão está lenta. Algumas operações podem demorar mais.',
              variant: 'destructive',
            });
          }
        } else if (!isSlow && wasSlowRef.current) {
          wasSlowRef.current = false;
        }
      }
    } catch (error) {
      // Ignorar erros de ping - pode ser endpoint inexistente
      console.log('[useNetworkMonitor] Ping falhou:', error);
    }
  }, [pingUrl, slowThresholdMs, showToasts, onSlowConnection]);

  // Handlers de eventos de rede
  useEffect(() => {
    const handleOnline = () => {
      if (!mountedRef.current) return;
      
      setState(prev => ({ ...prev, isOnline: true }));
      updateConnectionInfo();
      
      if (!wasOnlineRef.current) {
        wasOnlineRef.current = true;
        onOnline?.();
        
        if (showToasts) {
          toast({
            title: 'Conexão restaurada',
            description: 'Você está online novamente.',
          });
        }
      }
    };

    const handleOffline = () => {
      if (!mountedRef.current) return;
      
      setState(prev => ({ 
        ...prev, 
        isOnline: false, 
        serverLatency: null 
      }));
      
      if (wasOnlineRef.current) {
        wasOnlineRef.current = false;
        onOffline?.();
        
        if (showToasts) {
          toast({
            title: 'Sem conexão',
            description: 'Você está offline. Algumas funcionalidades podem não funcionar.',
            variant: 'destructive',
          });
        }
      }
    };

    const handleConnectionChange = () => {
      if (mountedRef.current) {
        updateConnectionInfo();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // Verificação inicial
    updateConnectionInfo();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, [updateConnectionInfo, showToasts, onOnline, onOffline]);

  // Verificação periódica de latência
  useEffect(() => {
    mountedRef.current = true;

    if (checkIntervalMs > 0) {
      checkServerLatency();
      const interval = setInterval(checkServerLatency, checkIntervalMs);
      
      return () => {
        mountedRef.current = false;
        clearInterval(interval);
      };
    }

    return () => {
      mountedRef.current = false;
    };
  }, [checkIntervalMs, checkServerLatency]);

  // Função para forçar verificação
  const forceCheck = useCallback(async () => {
    updateConnectionInfo();
    await checkServerLatency();
  }, [updateConnectionInfo, checkServerLatency]);

  return {
    ...state,
    forceCheck,
  };
}

/**
 * Hook simplificado apenas para status online/offline
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

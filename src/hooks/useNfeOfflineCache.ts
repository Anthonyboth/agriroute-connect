import { useState, useCallback, useEffect } from 'react';

export interface NfeOfflineItem {
  accessKey: string;
  scannedAt: string;
  freightId?: string;
  status: 'pending' | 'syncing' | 'synced' | 'error';
  errorMessage?: string;
}

const STORAGE_KEY = 'agriroute_nfe_offline_cache';

export function useNfeOfflineCache() {
  const [items, setItems] = useState<NfeOfflineItem[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Carregar do localStorage ao iniciar
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setItems(parsed);
      } catch (err) {
        console.error('[NfeOfflineCache] Erro ao carregar cache:', err);
      }
    }
  }, []);

  // Monitorar status de conexão
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

  // Persistir no localStorage
  const persistItems = useCallback((newItems: NfeOfflineItem[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
    setItems(newItems);
  }, []);

  // Salvar chave offline
  const saveKey = useCallback((accessKey: string, freightId?: string) => {
    // Verificar se já existe
    if (items.some(item => item.accessKey === accessKey)) {
      console.log('[NfeOfflineCache] Chave já existe no cache:', accessKey);
      return false;
    }

    const newItem: NfeOfflineItem = {
      accessKey,
      scannedAt: new Date().toISOString(),
      freightId,
      status: 'pending',
    };

    const newItems = [...items, newItem];
    persistItems(newItems);
    console.log('[NfeOfflineCache] Chave salva:', accessKey);
    return true;
  }, [items, persistItems]);

  // Remover chave
  const removeKey = useCallback((accessKey: string) => {
    const newItems = items.filter(item => item.accessKey !== accessKey);
    persistItems(newItems);
    console.log('[NfeOfflineCache] Chave removida:', accessKey);
  }, [items, persistItems]);

  // Atualizar status de um item
  const updateItemStatus = useCallback((
    accessKey: string, 
    status: NfeOfflineItem['status'], 
    errorMessage?: string
  ) => {
    const newItems = items.map(item => 
      item.accessKey === accessKey 
        ? { ...item, status, errorMessage } 
        : item
    );
    persistItems(newItems);
  }, [items, persistItems]);

  // Limpar itens sincronizados
  const clearSynced = useCallback(() => {
    const newItems = items.filter(item => item.status !== 'synced');
    persistItems(newItems);
    console.log('[NfeOfflineCache] Itens sincronizados removidos');
  }, [items, persistItems]);

  // Obter apenas pendentes
  const getPendingItems = useCallback(() => {
    return items.filter(item => item.status === 'pending' || item.status === 'error');
  }, [items]);

  // Contar pendentes
  const pendingCount = items.filter(item => item.status === 'pending' || item.status === 'error').length;

  return {
    items,
    isOnline,
    pendingCount,
    saveKey,
    removeKey,
    updateItemStatus,
    clearSynced,
    getPendingItems,
  };
}

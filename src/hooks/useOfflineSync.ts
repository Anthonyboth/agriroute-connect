import { useState, useEffect, useCallback } from 'react';

interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  retries: number;
}

const DB_NAME = 'agriroute-offline';
const DB_VERSION = 1;
const SYNC_QUEUE_STORE = 'sync_queue';
const CACHE_STORE = 'cache';

// IndexedDB wrapper
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        const cacheStore = db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
        cacheStore.createIndex('expires', 'expires', { unique: false });
      }
    };
  });
};

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[useOfflineSync] Network online - triggering sync');
      processSyncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('[useOfflineSync] Network offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load queue count on mount
  useEffect(() => {
    loadQueueCount();
  }, []);

  const loadQueueCount = async () => {
    try {
      const db = await openDB();
      const tx = db.transaction(SYNC_QUEUE_STORE, 'readonly');
      const store = tx.objectStore(SYNC_QUEUE_STORE);
      const request = store.count();
      
      request.onsuccess = () => {
        setSyncQueueCount(request.result);
      };
    } catch (error) {
      console.error('[useOfflineSync] Error loading queue count:', error);
    }
  };

  // Add action to sync queue
  const queueAction = useCallback(async (type: string, payload: any): Promise<string> => {
    const action: OfflineAction = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
      retries: 0,
    };

    try {
      const db = await openDB();
      const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(SYNC_QUEUE_STORE);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.add(action);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log('[useOfflineSync] Action queued:', action.id);
      await loadQueueCount();

      // If online, try to sync immediately
      if (navigator.onLine) {
        processSyncQueue();
      }

      return action.id;
    } catch (error) {
      console.error('[useOfflineSync] Error queuing action:', error);
      throw error;
    }
  }, []);

  // Process sync queue
  const processSyncQueue = useCallback(async () => {
    if (isSyncing || !navigator.onLine) return;

    setIsSyncing(true);
    console.log('[useOfflineSync] Processing sync queue...');

    try {
      const db = await openDB();
      const tx = db.transaction(SYNC_QUEUE_STORE, 'readonly');
      const store = tx.objectStore(SYNC_QUEUE_STORE);
      
      const actions: OfflineAction[] = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      console.log(`[useOfflineSync] Found ${actions.length} actions to sync`);

      for (const action of actions) {
        try {
          await processAction(action);
          await removeFromQueue(action.id);
        } catch (error) {
          console.error(`[useOfflineSync] Failed to process action ${action.id}:`, error);
          
          // Increment retry count
          if (action.retries < 3) {
            await updateActionRetries(action.id, action.retries + 1);
          } else {
            // Remove after max retries
            await removeFromQueue(action.id);
            console.error(`[useOfflineSync] Max retries exceeded for action ${action.id}`);
          }
        }
      }

      setLastSyncAt(new Date());
      await loadQueueCount();
    } catch (error) {
      console.error('[useOfflineSync] Error processing sync queue:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  // Process individual action
  const processAction = async (action: OfflineAction): Promise<void> => {
    // This should be extended to handle different action types
    console.log('[useOfflineSync] Processing action:', action.type, action.id);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // For now, just log - actual implementation would call Supabase
    console.log('[useOfflineSync] Action processed:', action.id);
  };

  const removeFromQueue = async (id: string) => {
    const db = await openDB();
    const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    store.delete(id);
  };

  const updateActionRetries = async (id: string, retries: number) => {
    const db = await openDB();
    const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    
    const request = store.get(id);
    request.onsuccess = () => {
      const action = request.result;
      if (action) {
        action.retries = retries;
        store.put(action);
      }
    };
  };

  // Cache data for offline use
  const cacheData = useCallback(async (key: string, data: any, ttlMs: number = 24 * 60 * 60 * 1000) => {
    try {
      const db = await openDB();
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      const store = tx.objectStore(CACHE_STORE);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put({
          key,
          data,
          expires: Date.now() + ttlMs,
          cached_at: Date.now(),
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log('[useOfflineSync] Data cached:', key);
    } catch (error) {
      console.error('[useOfflineSync] Error caching data:', error);
    }
  }, []);

  // Get cached data
  const getCachedData = useCallback(async <T>(key: string): Promise<T | null> => {
    try {
      const db = await openDB();
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const store = tx.objectStore(CACHE_STORE);
      
      const result = await new Promise<any>((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!result) return null;
      
      // Check if expired
      if (result.expires < Date.now()) {
        // Delete expired cache
        const deleteTx = db.transaction(CACHE_STORE, 'readwrite');
        deleteTx.objectStore(CACHE_STORE).delete(key);
        return null;
      }

      return result.data as T;
    } catch (error) {
      console.error('[useOfflineSync] Error getting cached data:', error);
      return null;
    }
  }, []);

  // Clear all cached data
  const clearCache = useCallback(async () => {
    try {
      const db = await openDB();
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      tx.objectStore(CACHE_STORE).clear();
      console.log('[useOfflineSync] Cache cleared');
    } catch (error) {
      console.error('[useOfflineSync] Error clearing cache:', error);
    }
  }, []);

  return {
    isOnline,
    isSyncing,
    syncQueueCount,
    lastSyncAt,
    queueAction,
    processSyncQueue,
    cacheData,
    getCachedData,
    clearCache,
  };
};

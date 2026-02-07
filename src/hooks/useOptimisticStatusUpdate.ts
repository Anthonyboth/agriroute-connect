/**
 * useOptimisticStatusUpdate.ts
 * 
 * Hook para atualizações otimistas de status em listas de itens.
 * Atualiza a UI IMEDIATAMENTE após ação do usuário, sem esperar refetch do banco.
 * O refetch em background garante consistência eventual.
 * 
 * Uso: ServiceProviderDashboard, DriverDashboard, ProducerDashboard
 */

import { useCallback, useRef } from 'react';

interface OptimisticUpdateOptions<T> {
  /** Setter do state React da lista */
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  /** Campo identificador (default: 'id') */
  idField?: keyof T;
  /** Função de refetch em background (opcional) */
  backgroundRefetch?: () => void;
  /** Delay antes do background refetch em ms (default: 300) */
  refetchDelay?: number;
}

export function useOptimisticStatusUpdate<T extends Record<string, any>>({
  setItems,
  idField = 'id' as keyof T,
  backgroundRefetch,
  refetchDelay = 300,
}: OptimisticUpdateOptions<T>) {
  const refetchTimer = useRef<ReturnType<typeof setTimeout>>();

  /**
   * Atualiza o status de um item otimisticamente na UI.
   * Remove da lista se o novo status não pertence ao filtro atual.
   */
  const optimisticUpdateStatus = useCallback((
    itemId: string,
    newStatus: string,
    /** Statuses que devem permanecer visíveis na lista atual */
    visibleStatuses?: string[],
    /** Campos extras para atualizar */
    extraFields?: Partial<T>,
  ) => {
    setItems(prev => {
      // Se temos filtro de statuses visíveis e o novo status não está nele, remover o item
      if (visibleStatuses && !visibleStatuses.includes(newStatus)) {
        return prev.filter(item => item[idField] !== itemId);
      }
      
      // Atualizar o status do item na lista
      return prev.map(item => {
        if (item[idField] === itemId) {
          return {
            ...item,
            status: newStatus,
            updated_at: new Date().toISOString(),
            ...extraFields,
          } as T;
        }
        return item;
      });
    });

    // Background refetch para garantir consistência
    if (backgroundRefetch) {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(backgroundRefetch, refetchDelay);
    }
  }, [setItems, idField, backgroundRefetch, refetchDelay]);

  /**
   * Remove um item da lista otimisticamente.
   */
  const optimisticRemove = useCallback((itemId: string) => {
    setItems(prev => prev.filter(item => item[idField] !== itemId));
    
    if (backgroundRefetch) {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(backgroundRefetch, refetchDelay);
    }
  }, [setItems, idField, backgroundRefetch, refetchDelay]);

  /**
   * Move um item de uma lista para outra otimisticamente.
   */
  const optimisticMove = useCallback((
    itemId: string,
    sourceSet: React.Dispatch<React.SetStateAction<T[]>>,
    targetSet: React.Dispatch<React.SetStateAction<T[]>>,
    newStatus: string,
    extraFields?: Partial<T>,
  ) => {
    let movedItem: T | null = null;
    
    sourceSet(prev => {
      const item = prev.find(i => i[idField] === itemId);
      if (item) {
        movedItem = {
          ...item,
          status: newStatus,
          updated_at: new Date().toISOString(),
          ...extraFields,
        } as T;
      }
      return prev.filter(i => i[idField] !== itemId);
    });
    
    if (movedItem) {
      targetSet(prev => [movedItem!, ...prev]);
    }
    
    if (backgroundRefetch) {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(backgroundRefetch, refetchDelay);
    }
  }, [idField, backgroundRefetch, refetchDelay]);

  return {
    optimisticUpdateStatus,
    optimisticRemove,
    optimisticMove,
  };
}

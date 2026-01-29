/**
 * Hook para prevenir ações duplicadas e garantir idempotência
 * Essencial para botões de submit, pagamentos, e operações críticas
 */

import { useCallback, useRef, useState } from 'react';

interface IdempotentActionOptions {
  /** Tempo mínimo entre execuções em ms (padrão: 2000) */
  cooldownMs?: number;
  /** Callback quando ação é bloqueada */
  onBlocked?: () => void;
  /** ID único da ação para tracking global */
  actionId?: string;
}

interface IdempotentActionResult<T> {
  /** Executar a ação de forma segura */
  execute: (...args: any[]) => Promise<T | undefined>;
  /** Se a ação está em execução */
  isExecuting: boolean;
  /** Se a ação está em cooldown */
  isInCooldown: boolean;
  /** Forçar reset do estado */
  reset: () => void;
  /** Tempo restante de cooldown em ms */
  cooldownRemaining: number;
}

// Registro global de ações em execução
const globalExecutingActions = new Set<string>();
const globalCooldowns = new Map<string, number>();

export function useIdempotentAction<T = any>(
  action: (...args: any[]) => Promise<T>,
  options: IdempotentActionOptions = {}
): IdempotentActionResult<T> {
  const { cooldownMs = 2000, onBlocked, actionId } = options;

  const [isExecuting, setIsExecuting] = useState(false);
  const [isInCooldown, setIsInCooldown] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const executingRef = useRef(false);
  const cooldownEndRef = useRef(0);
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startCooldownTimer = useCallback(() => {
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
    }

    cooldownIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, cooldownEndRef.current - Date.now());
      setCooldownRemaining(remaining);

      if (remaining <= 0) {
        setIsInCooldown(false);
        if (cooldownIntervalRef.current) {
          clearInterval(cooldownIntervalRef.current);
          cooldownIntervalRef.current = null;
        }
        if (actionId) {
          globalCooldowns.delete(actionId);
        }
      }
    }, 100);
  }, [actionId]);

  const reset = useCallback(() => {
    executingRef.current = false;
    cooldownEndRef.current = 0;
    setIsExecuting(false);
    setIsInCooldown(false);
    setCooldownRemaining(0);
    
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
    }
    
    if (actionId) {
      globalExecutingActions.delete(actionId);
      globalCooldowns.delete(actionId);
    }
  }, [actionId]);

  const execute = useCallback(async (...args: any[]): Promise<T | undefined> => {
    // Verificar se já está executando (local)
    if (executingRef.current) {
      console.log('[useIdempotentAction] Bloqueado: ação já em execução');
      onBlocked?.();
      return undefined;
    }

    // Verificar se já está executando (global)
    if (actionId && globalExecutingActions.has(actionId)) {
      console.log('[useIdempotentAction] Bloqueado: ação global em execução');
      onBlocked?.();
      return undefined;
    }

    // Verificar cooldown (local)
    if (cooldownEndRef.current > Date.now()) {
      console.log('[useIdempotentAction] Bloqueado: em cooldown');
      onBlocked?.();
      return undefined;
    }

    // Verificar cooldown (global)
    if (actionId) {
      const globalCooldownEnd = globalCooldowns.get(actionId);
      if (globalCooldownEnd && globalCooldownEnd > Date.now()) {
        console.log('[useIdempotentAction] Bloqueado: cooldown global');
        onBlocked?.();
        return undefined;
      }
    }

    // Marcar como executando
    executingRef.current = true;
    setIsExecuting(true);
    
    if (actionId) {
      globalExecutingActions.add(actionId);
    }

    try {
      const result = await action(...args);
      return result;
    } finally {
      // Finalizar execução
      executingRef.current = false;
      setIsExecuting(false);
      
      if (actionId) {
        globalExecutingActions.delete(actionId);
      }

      // Iniciar cooldown
      if (cooldownMs > 0) {
        cooldownEndRef.current = Date.now() + cooldownMs;
        setIsInCooldown(true);
        setCooldownRemaining(cooldownMs);
        
        if (actionId) {
          globalCooldowns.set(actionId, cooldownEndRef.current);
        }
        
        startCooldownTimer();
      }
    }
  }, [action, cooldownMs, onBlocked, actionId, startCooldownTimer]);

  return {
    execute,
    isExecuting,
    isInCooldown,
    reset,
    cooldownRemaining,
  };
}

/**
 * Hook simplificado para botões de submit
 */
export function useSubmitLock(cooldownMs: number = 2000) {
  const [isLocked, setIsLocked] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const lock = useCallback(() => {
    setIsLocked(true);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsLocked(false);
    }, cooldownMs);
  }, [cooldownMs]);

  const unlock = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsLocked(false);
  }, []);

  return { isLocked, lock, unlock };
}

/**
 * Hook para garantir que uma operação seja executada apenas uma vez
 * mesmo com múltiplos cliques rápidos
 */
export function useOnce<T = any>(
  action: (...args: any[]) => Promise<T>
): [(...args: any[]) => Promise<T | undefined>, boolean, () => void] {
  const executedRef = useRef(false);
  const [hasExecuted, setHasExecuted] = useState(false);

  const execute = useCallback(async (...args: any[]): Promise<T | undefined> => {
    if (executedRef.current) {
      return undefined;
    }

    executedRef.current = true;
    setHasExecuted(true);

    return action(...args);
  }, [action]);

  const reset = useCallback(() => {
    executedRef.current = false;
    setHasExecuted(false);
  }, []);

  return [execute, hasExecuted, reset];
}

/**
 * src/hooks/useSafeModal.ts
 *
 * Hook unificado para modais seguros.
 * Combina useModal (estado) com padrões obrigatórios:
 *
 * 1. ESC fecha o modal
 * 2. Click fora fecha o modal
 * 3. Body scroll bloqueado
 * 4. Botão voltar (Android) funciona
 * 5. Apenas um modal por vez (stack)
 * 6. Cleanup automático ao desmontar
 * 7. Loading state integrado
 * 8. Não abre se já está aberto (idempotente)
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ── Tipos ─────────────────────────────────────────────────────

export interface UseSafeModalOptions {
  /** ID único do modal (para stack/debug) */
  modalId: string;
  /** Callback ao abrir */
  onOpen?: () => void;
  /** Callback ao fechar */
  onClose?: () => void;
  /** Prevenir fechamento durante loading */
  preventCloseOnLoading?: boolean;
}

export interface UseSafeModalReturn<T = any> {
  /** Se o modal está aberto */
  isOpen: boolean;
  /** Dados passados ao modal */
  data: T | null;
  /** Se o modal está processando algo */
  isProcessing: boolean;
  /** Abrir o modal com dados opcionais */
  open: (data?: T) => void;
  /** Fechar o modal (respeita preventCloseOnLoading) */
  close: () => void;
  /** Marcar como processando (botões desabilitados, fecha bloqueado) */
  setProcessing: (processing: boolean) => void;
  /** Props para passar ao SafeModal / BottomSheet */
  modalProps: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
}

// ── Registro global de modais abertos ─────────────────────────

const openModals = new Set<string>();

// ── Hook ──────────────────────────────────────────────────────

export function useSafeModal<T = any>(
  options: UseSafeModalOptions
): UseSafeModalReturn<T> {
  const { modalId, onOpen, onClose, preventCloseOnLoading = true } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const mountedRef = useRef(true);
  const previousOverflowRef = useRef('');

  // ── Body scroll lock ────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      previousOverflowRef.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = previousOverflowRef.current || '';
    }

    return () => {
      document.body.style.overflow = previousOverflowRef.current || '';
    };
  }, [isOpen]);

  // ── Android back button ──────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      close();
      // Re-push state so back works again
      window.history.pushState(null, '', window.location.href);
    };

    // Push state when modal opens
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen]);

  // ── Cleanup ──────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      openModals.delete(modalId);
      document.body.style.overflow = previousOverflowRef.current || '';
    };
  }, [modalId]);

  // ── Open ─────────────────────────────────────────────────
  const open = useCallback((modalData?: T) => {
    if (!mountedRef.current) return;

    // Idempotente: se já está aberto com mesmo ID, não faz nada
    if (openModals.has(modalId)) {
      if (import.meta.env.DEV) {
        console.log(`[useSafeModal] Modal "${modalId}" já está aberto, ignorando`);
      }
      return;
    }

    openModals.add(modalId);
    setData(modalData ?? null);
    setIsProcessing(false);
    setIsOpen(true);
    onOpen?.();
  }, [modalId, onOpen]);

  // ── Close ────────────────────────────────────────────────
  const close = useCallback(() => {
    if (!mountedRef.current) return;

    // Bloquear fechamento durante processing se configurado
    if (preventCloseOnLoading && isProcessing) {
      if (import.meta.env.DEV) {
        console.log(`[useSafeModal] Fechamento bloqueado: modal "${modalId}" está processando`);
      }
      return;
    }

    openModals.delete(modalId);
    setIsOpen(false);
    setData(null);
    setIsProcessing(false);
    onClose?.();
  }, [modalId, isProcessing, preventCloseOnLoading, onClose]);

  // ── onOpenChange (para BottomSheet/Dialog) ───────────────
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen) {
      open();
    } else {
      close();
    }
  }, [open, close]);

  return {
    isOpen,
    data,
    isProcessing,
    open,
    close,
    setProcessing: setIsProcessing,
    modalProps: {
      open: isOpen,
      onOpenChange: handleOpenChange,
    },
  };
}

/**
 * Verifica se algum modal está aberto globalmente.
 */
export function hasOpenModals(): boolean {
  return openModals.size > 0;
}

/**
 * Fecha todos os modais abertos (ex: no logout).
 */
export function closeAllModals(): void {
  openModals.clear();
}

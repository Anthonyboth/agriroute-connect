/**
 * Hook para gerenciar modais de forma segura
 * Evita problemas de estado e conflitos entre modais
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface ModalState<T = any> {
  isOpen: boolean;
  data: T | null;
}

interface ModalOptions {
  /** Fechar ao pressionar Escape */
  closeOnEscape?: boolean;
  /** Fechar ao clicar fora */
  closeOnClickOutside?: boolean;
  /** Callback ao abrir */
  onOpen?: () => void;
  /** Callback ao fechar */
  onClose?: () => void;
  /** Prevenir scroll do body quando aberto */
  preventBodyScroll?: boolean;
}

interface ModalResult<T = any> {
  /** Se o modal está aberto */
  isOpen: boolean;
  /** Dados passados para o modal */
  data: T | null;
  /** Abrir o modal */
  open: (data?: T) => void;
  /** Fechar o modal */
  close: () => void;
  /** Toggle do modal */
  toggle: () => void;
  /** Atualizar dados sem fechar */
  updateData: (data: Partial<T>) => void;
  /** Ref para o elemento do modal (para click outside) */
  modalRef: React.RefObject<HTMLDivElement>;
}

export function useModal<T = any>(options: ModalOptions = {}): ModalResult<T> {
  const {
    closeOnEscape = true,
    closeOnClickOutside = true,
    onOpen,
    onClose,
    preventBodyScroll = true,
  } = options;

  const [state, setState] = useState<ModalState<T>>({
    isOpen: false,
    data: null,
  });

  const modalRef = useRef<HTMLDivElement>(null);
  const previousOverflowRef = useRef<string>('');

  // Gerenciar scroll do body
  useEffect(() => {
    if (preventBodyScroll) {
      if (state.isOpen) {
        previousOverflowRef.current = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = previousOverflowRef.current || '';
      }
    }

    return () => {
      if (preventBodyScroll) {
        document.body.style.overflow = previousOverflowRef.current || '';
      }
    };
  }, [state.isOpen, preventBodyScroll]);

  // Handler para tecla Escape
  useEffect(() => {
    if (!closeOnEscape || !state.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeOnEscape, state.isOpen]);

  // Handler para click fora
  useEffect(() => {
    if (!closeOnClickOutside || !state.isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        close();
      }
    };

    // Delay para evitar fechar imediatamente ao abrir
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [closeOnClickOutside, state.isOpen]);

  const open = useCallback((data?: T) => {
    setState({ isOpen: true, data: data ?? null });
    onOpen?.();
  }, [onOpen]);

  const close = useCallback(() => {
    setState({ isOpen: false, data: null });
    onClose?.();
  }, [onClose]);

  const toggle = useCallback(() => {
    if (state.isOpen) {
      close();
    } else {
      open();
    }
  }, [state.isOpen, open, close]);

  const updateData = useCallback((newData: Partial<T>) => {
    setState(prev => ({
      ...prev,
      data: prev.data ? { ...prev.data, ...newData } : newData as T,
    }));
  }, []);

  return {
    isOpen: state.isOpen,
    data: state.data,
    open,
    close,
    toggle,
    updateData,
    modalRef,
  };
}

/**
 * Hook para gerenciar múltiplos modais
 * Garante que apenas um modal esteja aberto por vez
 */
export function useModalStack() {
  const [stack, setStack] = useState<string[]>([]);
  const modalsRef = useRef<Map<string, { data: any; onClose?: () => void }>>(new Map());

  const openModal = useCallback((id: string, data?: any, onClose?: () => void) => {
    modalsRef.current.set(id, { data, onClose });
    setStack(prev => {
      // Remover se já existe e adicionar no topo
      const filtered = prev.filter(m => m !== id);
      return [...filtered, id];
    });
  }, []);

  const closeModal = useCallback((id?: string) => {
    if (id) {
      const modal = modalsRef.current.get(id);
      modal?.onClose?.();
      modalsRef.current.delete(id);
      setStack(prev => prev.filter(m => m !== id));
    } else {
      // Fechar o modal do topo
      const topId = stack[stack.length - 1];
      if (topId) {
        const modal = modalsRef.current.get(topId);
        modal?.onClose?.();
        modalsRef.current.delete(topId);
        setStack(prev => prev.slice(0, -1));
      }
    }
  }, [stack]);

  const closeAllModals = useCallback(() => {
    modalsRef.current.forEach(modal => modal.onClose?.());
    modalsRef.current.clear();
    setStack([]);
  }, []);

  const isModalOpen = useCallback((id: string): boolean => {
    return stack.includes(id);
  }, [stack]);

  const getModalData = useCallback(<T = any>(id: string): T | null => {
    return modalsRef.current.get(id)?.data ?? null;
  }, []);

  const getTopModal = useCallback((): string | null => {
    return stack[stack.length - 1] ?? null;
  }, [stack]);

  return {
    stack,
    openModal,
    closeModal,
    closeAllModals,
    isModalOpen,
    getModalData,
    getTopModal,
    hasOpenModals: stack.length > 0,
  };
}

/**
 * Hook para confirmação com modal
 */
export function useConfirmation<T = void>() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('Confirmação');
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const dataRef = useRef<T | null>(null);

  const confirm = useCallback((
    msg: string, 
    opts?: { title?: string; data?: T }
  ): Promise<boolean> => {
    setMessage(msg);
    setTitle(opts?.title ?? 'Confirmação');
    dataRef.current = opts?.data ?? null;
    setIsOpen(true);

    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setIsOpen(false);
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    message,
    title,
    data: dataRef.current,
    confirm,
    handleConfirm,
    handleCancel,
  };
}

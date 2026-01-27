/**
 * Modal simples via createPortal (sem Radix) para evitar problemas de stacking context
 * e garantir que a captura de selfie apareça no app (web/Capacitor).
 */
import React, { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface SelfieCaptureModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const SelfieCaptureModal: React.FC<SelfieCaptureModalProps> = ({
  isOpen,
  title,
  onClose,
  children,
}) => {
  // Trava scroll do body quando aberto
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        zIndex: 2147483647,
        isolation: 'isolate',
      }}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
        style={{
          backgroundColor: 'hsl(var(--card))',
          color: 'hsl(var(--card-foreground))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-full transition-colors"
          style={{
            backgroundColor: 'hsl(var(--muted))',
            color: 'hsl(var(--muted-foreground))',
          }}
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default SelfieCaptureModal;

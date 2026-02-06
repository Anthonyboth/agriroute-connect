/**
 * src/components/ui/SafeModal.tsx
 *
 * Componente de modal unificado e seguro.
 * Wrapper padronizado sobre BottomSheet com:
 *
 * 1. Bottom Sheet mobile-first (arraste para fechar)
 * 2. Dialog centralizado em desktop
 * 3. Overlay correto (sem deslocamento)
 * 4. ESC / botão voltar funcionam
 * 5. Botão "Voltar" obrigatório se houver etapas
 * 6. Loading state visual integrado
 * 7. Nunca fica "meio aberto"
 *
 * USO:
 *   <SafeModal {...modalProps} title="Título" subtitle="Subtítulo">
 *     <SafeModalBody>Conteúdo</SafeModalBody>
 *     <SafeModalFooter>Botões</SafeModalFooter>
 *   </SafeModal>
 */

import React from 'react';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetBody,
  BottomSheetFooter,
} from '@/components/ui/bottom-sheet';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Tipos ─────────────────────────────────────────────────────

interface SafeModalProps {
  /** Controlado por useSafeModal.modalProps */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título do modal (obrigatório) */
  title: string;
  /** Subtítulo (opcional) */
  subtitle?: string;
  /** Se está processando (mostra overlay de loading) */
  isProcessing?: boolean;
  /** Se tem etapa anterior (mostra botão voltar) */
  onBack?: () => void;
  /** Classe extra no conteúdo */
  className?: string;
  /** Mostrar botão de fechar (default: true) */
  showCloseButton?: boolean;
  children: React.ReactNode;
}

// ── Componente Principal ──────────────────────────────────────

export const SafeModal: React.FC<SafeModalProps> = ({
  open,
  onOpenChange,
  title,
  subtitle,
  isProcessing = false,
  onBack,
  className,
  showCloseButton = true,
  children,
}) => {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent
        showCloseButton={showCloseButton}
        className={cn('relative', className)}
      >
        {/* Header com botão voltar opcional */}
        <BottomSheetHeader
          title={title}
          subtitle={subtitle}
          className={onBack ? 'pl-12' : undefined}
        />

        {/* Botão Voltar (se multi-step) */}
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onBack();
            }}
            className="absolute left-4 top-4 md:left-5 md:top-5 z-[60] h-9 w-9"
            disabled={isProcessing}
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
        )}

        {children}

        {/* Loading overlay */}
        {isProcessing && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-[1px] rounded-[24px]">
            <AppSpinner size="lg" />
          </div>
        )}
      </BottomSheetContent>
    </BottomSheet>
  );
};

// ── Subcomponentes ────────────────────────────────────────────

export const SafeModalBody: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <BottomSheetBody className={className}>{children}</BottomSheetBody>
);

export const SafeModalFooter: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <BottomSheetFooter className={className}>{children}</BottomSheetFooter>
);

export default SafeModal;

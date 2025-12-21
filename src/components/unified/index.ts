/**
 * Problema 5: Sistema unificado de modais
 * 
 * Este módulo fornece componentes padronizados para todos os modais da aplicação,
 * garantindo consistência visual e de UX em todo o sistema.
 */

export { UnifiedModalHeader } from './UnifiedModalHeader';
export { UnifiedModalFooter } from './UnifiedModalFooter';

// Tipos compartilhados
export interface ModalStep {
  id: number;
  label: string;
}

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
}

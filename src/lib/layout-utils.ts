import { cn } from './utils';

/**
 * Utilitários para prevenir sobreposição de elementos
 * 
 * Este arquivo contém funções e constantes para garantir que
 * elementos posicionados absolutamente não se sobreponham ao conteúdo.
 */

/**
 * Posicionamento seguro para elementos absolutamente posicionados
 */
export const safeAbsolutePosition = {
  topRight: 'absolute top-2 right-2',
  topLeft: 'absolute top-2 left-2',
  bottomRight: 'absolute bottom-2 right-2',
  bottomLeft: 'absolute bottom-2 left-2',
  centerTop: 'absolute top-2 left-1/2 -translate-x-1/2',
  centerBottom: 'absolute bottom-2 left-1/2 -translate-x-1/2',
} as const;

/**
 * Padding para containers que têm botões absolutamente posicionados
 * Use estas classes para garantir espaço adequado ao redor de botões
 */
export const containerPadding = {
  withTopRightButton: 'pr-14 pt-2', // Espaço para botão de fechar (10 + 8 = 14 = 3.5rem)
  withTopLeftButton: 'pl-14 pt-2',
  withBottomRightButton: 'pr-14 pb-2',
  withBottomLeftButton: 'pl-14 pb-2',
  withTopButtons: 'pt-14', // Quando há múltiplos botões no topo
  withBottomButtons: 'pb-14',
} as const;

/**
 * Safe area para headers de dialog/modal
 * Garante que o conteúdo não fique embaixo do botão de fechar
 */
export const safeHeaderPadding = 'pr-14 min-h-[3rem]';

/**
 * Classes para prevenir overflow de texto
 */
export const preventTextOverlap = 'break-words overflow-hidden';

/**
 * Classes para garantir que botões tenham área clicável adequada
 */
export const buttonSafeArea = 'min-w-[2.5rem] min-h-[2.5rem] touch-manipulation';

/**
 * Retorna classes de posicionamento seguro para um botão
 * @param position - Posição desejada do botão
 * @param additionalClasses - Classes CSS adicionais
 */
export function getButtonSafePosition(
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center-top' | 'center-bottom',
  additionalClasses?: string
): string {
  const positions = {
    'top-right': safeAbsolutePosition.topRight,
    'top-left': safeAbsolutePosition.topLeft,
    'bottom-right': safeAbsolutePosition.bottomRight,
    'bottom-left': safeAbsolutePosition.bottomLeft,
    'center-top': safeAbsolutePosition.centerTop,
    'center-bottom': safeAbsolutePosition.centerBottom,
  };
  
  return cn(positions[position], buttonSafeArea, additionalClasses);
}

/**
 * Retorna padding adequado para um container com botões posicionados
 * @param buttons - Posições dos botões no container
 */
export function getContainerPadding(
  buttons: Array<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>
): string {
  const classes: string[] = [];
  
  if (buttons.includes('top-right')) {
    classes.push(containerPadding.withTopRightButton);
  }
  if (buttons.includes('top-left')) {
    classes.push(containerPadding.withTopLeftButton);
  }
  if (buttons.includes('bottom-right')) {
    classes.push(containerPadding.withBottomRightButton);
  }
  if (buttons.includes('bottom-left')) {
    classes.push(containerPadding.withBottomLeftButton);
  }
  
  return cn(...classes);
}

/**
 * Garante espaçamento mínimo entre elementos
 */
export const safeSpacing = {
  stack: 'space-y-4',
  grid: 'gap-4',
  flexRow: 'gap-3',
  flexCol: 'gap-3',
} as const;

/**
 * Classes para prevenir sobreposição em layouts específicos
 */
export const layoutSafe = {
  dialog: 'relative w-full', // Garante que o dialog seja um contexto de posicionamento
  dialogHeader: cn(safeHeaderPadding, 'relative'), // Header com espaço para botão de fechar
  dialogContent: 'relative px-6 py-4', // Conteúdo com padding adequado
  dialogFooter: 'relative pt-4 mt-4 border-t', // Footer separado do conteúdo
} as const;

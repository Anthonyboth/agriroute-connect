/**
 * Sistema centralizado de Z-Index para evitar sobreposição de elementos
 * 
 * IMPORTANTE: Sempre use estes valores ao invés de z-index arbitrários
 * para garantir uma hierarquia visual consistente.
 * 
 * HIERARQUIA (de baixo para cima):
 * 1. Base/Dropdowns/Sticky
 * 2. Sheet (menu mobile) 
 * 3. Dialog/Modal (DEVE estar ACIMA do Sheet para abrir sobre o menu)
 * 4. Alert Dialog
 * 5. Toast/Tooltip/Notification
 */

export const Z_INDEX = {
  // Base layers
  base: 0,
  dropdown: 1000, // Para dropdowns simples (não em dialogs)
  sticky: 1020,
  
  // Overlays
  overlay: 1030,
  drawer: 1040,
  
  // Sheet layers (menu mobile) - ABAIXO do Dialog
  sheet: 1050,
  sheetOverlay: 1049,
  
  // Modal layers
  modal: 1060,
  modalOverlay: 1059,
  
  // Dialog layers - ACIMA do Sheet para permitir abrir sobre o menu
  dialog: 10000, // Ultra-alto para garantir que fique acima do Sheet (z-[9999])
  dialogOverlay: 9999,
  dialogClose: 10001, // Sempre acima do conteúdo do dialog
  
  // Alert Dialog layers
  alertDialog: 10010,
  alertDialogOverlay: 10009,
  
  // Notifications & Toast
  toast: 10090,
  tooltip: 10095,
  
  // Sempre no topo
  popover: 10100, // Para popovers e selects dentro de dialogs
  notification: 10110,
} as const;

/**
 * Classes Tailwind para z-index
 * Use estas classes para aplicar os valores de z-index nos componentes
 */
export const zIndexClasses = {
  dropdown: 'z-[1000]',
  sticky: 'z-[1020]',
  overlay: 'z-[1030]',
  drawer: 'z-[1040]',
  // Sheet (menu mobile) - abaixo do dialog
  sheet: 'z-[1050]',
  sheetOverlay: 'z-[1049]',
  modal: 'z-[1060]',
  modalOverlay: 'z-[1059]',
  // Dialog - ACIMA do Sheet (ultra-alto para garantir sobreposição)
  dialog: 'z-[10000]',
  dialogOverlay: 'z-[9999]',
  dialogClose: 'z-[10001]',
  // Alert dialogs ainda mais alto
  alertDialog: 'z-[10010]',
  alertDialogOverlay: 'z-[10009]',
  // Notificações no topo
  toast: 'z-[10090]',
  tooltip: 'z-[10095]',
  popover: 'z-[10100]',
  notification: 'z-[10110]',
} as const;

/**
 * Helper para obter o valor de z-index
 */
export function getZIndex(layer: keyof typeof Z_INDEX): number {
  return Z_INDEX[layer];
}

/**
 * Helper para obter a classe Tailwind de z-index
 */
export function getZIndexClass(layer: keyof typeof zIndexClasses): string {
  return zIndexClasses[layer];
}

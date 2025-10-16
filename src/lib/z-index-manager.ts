/**
 * Sistema centralizado de Z-Index para evitar sobreposição de elementos
 * 
 * IMPORTANTE: Sempre use estes valores ao invés de z-index arbitrários
 * para garantir uma hierarquia visual consistente.
 */

export const Z_INDEX = {
  // Base layers
  base: 0,
  dropdown: 1000, // Para dropdowns simples (não em dialogs)
  sticky: 1020,
  
  // Overlays
  overlay: 1030,
  drawer: 1040,
  modal: 1050,
  modalOverlay: 1049,
  
  // Dialog layers
  dialog: 1060,
  dialogOverlay: 1059,
  dialogClose: 1065, // Sempre acima do conteúdo do dialog
  
  // Alert Dialog layers
  alertDialog: 1070,
  alertDialogOverlay: 1069,
  
  // Sheet layers
  sheet: 1080,
  sheetOverlay: 1079,
  
  // Notifications & Toast
  toast: 1090,
  tooltip: 1095,
  
  // Sempre no topo
  popover: 1100, // Para popovers e selects dentro de dialogs
  notification: 1110,
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
  modal: 'z-[1050]',
  modalOverlay: 'z-[1049]',
  dialog: 'z-[1060]',
  dialogOverlay: 'z-[1059]',
  dialogClose: 'z-[1065]',
  alertDialog: 'z-[1070]',
  alertDialogOverlay: 'z-[1069]',
  sheet: 'z-[1080]',
  sheetOverlay: 'z-[1079]',
  toast: 'z-[1090]',
  tooltip: 'z-[1095]',
  popover: 'z-[1100]',
  notification: 'z-[1110]',
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

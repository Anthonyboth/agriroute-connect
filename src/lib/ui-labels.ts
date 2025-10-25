/**
 * UI Labels - Fonte única de verdade para rótulos do sistema
 * 
 * CRÍTICO: Sempre usar estas constantes para garantir consistência em toda a aplicação.
 * Padrão: "I.A" (com pontos) e Title Case no primeiro termo.
 */

export const AI_ABBR = "I.A" as const;
export const FRETES_IA_LABEL = `Fretes ${AI_ABBR}` as const;
export const AREAS_IA_LABEL = `Áreas ${AI_ABBR}` as const;
export const SISTEMA_IA_LABEL = `Sistema ${AI_ABBR}` as const;
export const VER_FRETES_IA_LABEL = `Ver ${FRETES_IA_LABEL}` as const;
export const FRETES_IA_DISPONIVEL_LABEL = `${FRETES_IA_LABEL} disponível!` as const;

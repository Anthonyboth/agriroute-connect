/**
 * Utilitários para GTA (Guia de Trânsito Animal)
 * Conforme regulamentação ACRIMAT vigente desde 01/03/2026,
 * o número da GTA deve constar obrigatoriamente no campo de
 * informações complementares da NF-e para transporte de gado.
 */

/** Tipos de carga que exigem GTA */
const GTA_REQUIRED_CARGO_TYPES = [
  'gado_bovino',
  'gado_leiteiro',
  'gado',
  'gado_vivo',
  'bovinos',
  'suinos_porcos',
  'aves_frangos',
  'aves_galinhas',
  'cavalos',
  'caprinos_ovinos',
  // Uppercase variants
  'GADO_BOVINO',
  'GADO_LEITEIRO',
  'GADO',
  'GADO_VIVO',
  'BOVINOS',
  'SUINOS',
  'AVES',
  'CAVALOS',
  'CAPRINOS_OVINOS',
];

/** Tipos especificamente de gado bovino (aviso mais forte) */
const CATTLE_CARGO_TYPES = [
  'gado_bovino',
  'gado_leiteiro',
  'gado',
  'gado_vivo',
  'bovinos',
  'GADO_BOVINO',
  'GADO_LEITEIRO',
  'GADO',
  'GADO_VIVO',
  'BOVINOS',
];

/**
 * Verifica se o tipo de carga requer GTA
 */
export function requiresGta(cargoType: string | undefined | null): boolean {
  if (!cargoType) return false;
  return GTA_REQUIRED_CARGO_TYPES.includes(cargoType);
}

/**
 * Verifica se é especificamente gado bovino
 */
export function isCattleCargo(cargoType: string | undefined | null): boolean {
  if (!cargoType) return false;
  return CATTLE_CARGO_TYPES.includes(cargoType);
}

/**
 * Extrai número da GTA do texto de informações adicionais
 */
export function extractGtaNumber(text: string): string | null {
  // Procura padrões como "GTA: 123456" ou "GTA nº 123456" ou "GTA 123456"
  const match = text.match(/GTA[\s:nº°]*(\d[\d.\-/]+\d)/i);
  return match ? match[1] : null;
}

/**
 * Verifica se o campo informações adicionais contém referência à GTA
 */
export function hasGtaReference(text: string): boolean {
  return /GTA[\s:nº°]*\d/i.test(text);
}

/**
 * Mensagem de aviso sobre a obrigatoriedade da GTA na NF-e
 */
export const GTA_NFE_WARNING = 
  'ATENÇÃO: A partir de 01/03/2026, a inclusão do número da GTA (Guia de Trânsito Animal) na Nota Fiscal é obrigatória (regulamentação ACRIMAT). Informe o número da GTA no campo "Informações Adicionais".';

/**
 * Mensagem curta para toast
 */
export const GTA_FREIGHT_NOTICE = 
  'ATENÇÃO, PRODUTOR RURAL! A partir de 01/03/2026 a inclusão do número da GTA na Nota Fiscal é obrigatória.';

import { validateCPF, validateCNPJ } from './cpfValidator';

/**
 * Remove all non-digit characters from a document string
 */
export function normalizeDocument(doc: string): string {
  return doc.replace(/\D/g, '');
}

/**
 * Get document type based on digit count
 */
export function getDocumentType(doc: string): 'CPF' | 'CNPJ' | 'INVALID' {
  const normalized = normalizeDocument(doc);
  if (normalized.length === 11) return 'CPF';
  if (normalized.length === 14) return 'CNPJ';
  return 'INVALID';
}

/**
 * Validate document (CPF or CNPJ) regardless of formatting
 * Accepts: "123.456.789-00", "12345678900", "12.345.678/0001-00", "12345678000100"
 */
export function isValidDocument(doc: string): boolean {
  const normalized = normalizeDocument(doc);
  const type = getDocumentType(normalized);
  
  if (type === 'CPF') {
    return validateCPF(normalized);
  } else if (type === 'CNPJ') {
    return validateCNPJ(normalized);
  }
  
  return false;
}

/**
 * Format document with proper mask (CPF or CNPJ)
 */
export function formatDocument(doc: string): string {
  const normalized = normalizeDocument(doc);
  const type = getDocumentType(normalized);
  
  if (type === 'CPF') {
    return normalized.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (type === 'CNPJ') {
    return normalized.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  
  return doc;
}

/**
 * Sanitize document for storage (only digits)
 * This is what should be stored in the database
 */
export function sanitizeForStore(doc: string): string {
  return normalizeDocument(doc);
}

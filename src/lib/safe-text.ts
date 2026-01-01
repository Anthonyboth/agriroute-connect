/**
 * Utility functions for sanitizing and displaying text safely
 * Prevents truncated/corrupted text display issues
 */

/**
 * Sanitizes a string value for safe display
 * - Normalizes to string
 * - Removes control characters
 * - Trims whitespace
 * - Provides fallback for empty values
 */
export function safeText(
  value: unknown,
  fallback: string = 'Não informado'
): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  // Convert to string
  let text = String(value);

  // Remove control characters (except newlines and tabs)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Normalize whitespace
  text = text.trim();

  // Return fallback if empty after sanitization
  if (!text) {
    return fallback;
  }

  return text;
}

/**
 * Formats a number as Brazilian Real currency
 * @param value - The numeric value to format
 * @param showDecimals - Whether to show decimal places (default: true)
 */
export function formatBRL(
  value: number | null | undefined,
  showDecimals: boolean = true
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'R$ 0,00';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0
  }).format(value);
}

/**
 * Truncates text with ellipsis, ensuring word boundaries are respected
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation
 */
export function truncateText(
  text: string,
  maxLength: number = 100
): { text: string; isTruncated: boolean } {
  const sanitized = safeText(text, '');
  
  if (sanitized.length <= maxLength) {
    return { text: sanitized, isTruncated: false };
  }

  // Find last space before maxLength
  const truncated = sanitized.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  const finalText = lastSpace > 0 
    ? truncated.substring(0, lastSpace) + '...'
    : truncated + '...';

  return { text: finalText, isTruncated: true };
}

/**
 * Safely gets a display location string from address components
 */
export function safeDisplayLocation(
  cityName?: string | null,
  state?: string | null,
  address?: string | null
): string {
  // Priority 1: city_name + state
  if (cityName && state) {
    return `${safeText(cityName, '')}, ${safeText(state, '')}`;
  }
  
  // Priority 2: city_name alone
  if (cityName) {
    return safeText(cityName, 'Localização não especificada');
  }
  
  // Priority 3: Try to extract city from address if it has format "City, ST"
  if (address?.includes(',')) {
    const match = address.match(/([^,]+),\s*([A-Z]{2})/);
    if (match) {
      return `${match[1].trim()}, ${match[2]}`;
    }
  }
  
  // Fallback
  return safeText(address, 'Localização não especificada');
}

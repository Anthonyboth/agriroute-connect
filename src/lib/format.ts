/**
 * Format utilities for consistent data display
 */

/**
 * Format currency in Brazilian Real (BRL)
 * @param value - The numeric value to format
 * @returns Formatted currency string (e.g., "R$ 1.234,56")
 */
export function formatCurrencyBRL(value: number): string {
  if (!isFinite(value)) return 'R$ 0,00';
  
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format kilometers with compact decimal notation
 * @param km - The kilometer value to format
 * @param maxDecimals - Maximum number of decimal places (default: 1)
 * @returns Formatted km string (e.g., "654,5 km")
 */
export function formatKmCompact(km: number, maxDecimals: number = 1): string {
  if (!isFinite(km) || km < 0) return '0 km';
  
  // Round to specified decimals
  const rounded = Math.round(km * Math.pow(10, maxDecimals)) / Math.pow(10, maxDecimals);
  
  // If the number is an integer after rounding, show no decimals
  if (Math.floor(rounded) === rounded) {
    return `${rounded.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km`;
  }
  
  return `${rounded.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals })} km`;
}

/**
 * Format date in Brazilian format (DD/MM/YYYY)
 * @param date - Date string or Date object
 * @returns Formatted date string (e.g., "31/12/2024")
 */
export function formatDate(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) return '-';
    
    return dateObj.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

/**
 * Format weight from kg to tons with proper decimals
 * Reuses existing logic but ensures <1t shows meaningful values
 * @param kg - Weight in kilograms
 * @returns Formatted weight string (e.g., "0,5 t" or "1,2 t")
 */
export function formatWeight(kg: number): string {
  if (!isFinite(kg) || kg <= 0) return '0 kg';
  
  const tons = kg / 1000;
  
  // If less than 1 ton, show in kg with no decimals
  if (tons < 1) {
    return `${Math.round(kg).toLocaleString('pt-BR')} kg`;
  }
  
  // If 1 ton or more, show in tons with 1 decimal
  return `${tons.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t`;
}

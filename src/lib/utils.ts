import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTonsCompactFromKg(kg: number): string {
  if (!isFinite(kg) || kg <= 0) return '0 t';
  const tons = kg / 1000;

  // Para valores < 1 tonelada, mostrar com 1 casa decimal
  if (tons < 1) {
    const val = Math.round(tons * 10) / 10;
    return `${val.toLocaleString('pt-BR')} t`;
  }

  const units = [
    { value: 1e9, suffix: 'b' },
    { value: 1e6, suffix: 'm' },
    { value: 1e3, suffix: 'k' },
  ] as const;

  let suffix = '';
  let n = tons;

  for (const u of units) {
    if (tons >= u.value) {
      suffix = u.suffix;
      n = tons / u.value;
      break;
    }
  }

  if (suffix === '') {
    return `${Math.round(tons).toLocaleString('pt-BR')} t`;
  }

  let formatted: string;
  if (n >= 100) {
    formatted = Math.round(n).toString();
  } else {
    formatted = (Math.round(n * 10) / 10).toFixed(1);
    if (formatted.endsWith('.0')) {
      formatted = formatted.slice(0, -2);
    }
  }

  return `${formatted}${suffix} t`;
}

/**
 * Cria uma função debounced que atrasa a invocação até após `wait` milissegundos
 * terem passado desde a última vez que foi invocada.
 * 
 * @param func - A função a ser debounced
 * @param wait - Os milissegundos a atrasar
 * @returns Uma versão debounced da função com método cancel
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;
  
  const debouncedFn = function executedFunction(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      func(...args);
    }, wait);
  };

  debouncedFn.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  
  return debouncedFn as ((...args: Parameters<T>) => void) & { cancel: () => void };
}

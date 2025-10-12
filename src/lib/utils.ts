import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTonsCompactFromKg(kg: number): string {
  if (!isFinite(kg) || kg <= 0) return '0 ton';
  const tons = kg / 1000;

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
    return `${Math.round(tons).toLocaleString('pt-BR')} ton`;
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

  return `${formatted}${suffix} ton`;
}

/**
 * Cria uma função debounced que atrasa a invocação até após `wait` milissegundos
 * terem passado desde a última vez que foi invocada.
 * 
 * @param func - A função a ser debounced
 * @param wait - Os milissegundos a atrasar
 * @returns Uma versão debounced da função
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

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

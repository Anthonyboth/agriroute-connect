/**
 * reports-formatters.ts
 *
 * Utilitários de formatação para painéis de relatórios.
 * Centraliza conversões de unidade, PT-BR e normalização de strings.
 */

// Mapa de abreviações de mês EN → PT-BR
const MONTH_MAP: Record<string, string> = {
  Jan: 'jan', Feb: 'fev', Mar: 'mar', Apr: 'abr',
  May: 'mai', Jun: 'jun', Jul: 'jul', Aug: 'ago',
  Sep: 'set', Oct: 'out', Nov: 'nov', Dec: 'dez',
};

/**
 * Converte kg para toneladas.
 * Exemplo: 500000 → 500.0
 */
export function toTons(kg: number): number {
  return kg / 1000;
}

/**
 * Formata kg → toneladas em PT-BR com 1 casa decimal.
 * Exemplo: 500000 → "500,0 ton"
 * Retorna "—" se kg <= 0.
 */
export function formatTonsPtBR(kg: number): string {
  if (!kg || kg <= 0) return '—';
  const t = toTons(kg);
  return `${t.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ton`;
}

/**
 * Normaliza rótulo de mês para PT-BR abreviado.
 * Aceita: "Feb/26", "2026-02", "2026-02-01"
 * Retorna: "fev/26"
 */
export function formatMonthLabelPtBR(input: string | undefined | null): string {
  if (!input) return '';

  // Formato "Feb/26" ou "feb/26"
  const shortMatch = input.match(/^([A-Za-z]{3})\/(\d{2,4})$/);
  if (shortMatch) {
    const monthKey = shortMatch[1].charAt(0).toUpperCase() + shortMatch[1].slice(1).toLowerCase();
    const year = shortMatch[2].length === 4 ? shortMatch[2].slice(2) : shortMatch[2];
    const ptMonth = MONTH_MAP[monthKey] ?? shortMatch[1].toLowerCase().slice(0, 3);
    return `${ptMonth}/${year}`;
  }

  // Formato "2026-02" ou "2026-02-01"
  const isoMatch = input.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (isoMatch) {
    const year = isoMatch[1].slice(2);
    const monthNum = parseInt(isoMatch[2], 10) - 1;
    const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const ptMonth = months[monthNum] ?? isoMatch[2];
    return `${ptMonth}/${year}`;
  }

  // Fallback: retorna como veio
  return input;
}

/**
 * Normaliza rótulo de rota para garantir " → " com espaços.
 * Exemplo: "CidadeA/MT→CidadeB/MT" → "CidadeA/MT → CidadeB/MT"
 */
export function formatRouteLabel(route: string | undefined | null): string {
  if (!route) return '—';
  // Garante espaços ao redor de →
  return route.replace(/\s*→\s*/g, ' → ');
}

/**
 * Formata valor monetário em BRL PT-BR.
 * Exemplo: 572 → "R$ 572,00"
 */
export function formatCurrencyPtBR(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

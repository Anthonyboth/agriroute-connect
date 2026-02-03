/**
 * Converte valores vindos do PostgREST (ex: numeric -> string) em number finito.
 * Retorna null quando não é possível converter.
 */
export function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;

  if (typeof v === 'string') {
    // Aceita strings com vírgula (pt-BR) e espaços
    const normalized = v.trim().replace(',', '.');
    if (!normalized) return null;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

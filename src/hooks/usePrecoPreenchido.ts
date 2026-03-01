/**
 * src/hooks/usePrecoPreenchido.ts
 * 
 * Hook React para exibir o preço preenchido de um frete.
 * TODA UI que mostra preço de frete DEVE usar este hook.
 * 
 * Uso:
 *   const preco = usePrecoPreenchido(freight);
 *   return <span>{preco.primaryText}</span>;
 */

import { useMemo } from 'react';
import {
  precoPreenchidoDoFrete,
  type PrecoPreenchido,
  type PrecoPreenchidoInput,
} from '@/lib/precoPreenchido';

export type { PrecoPreenchido, PrecoPreenchidoInput } from '@/lib/precoPreenchido';
export { limparCachePrecoPreenchido } from '@/lib/precoPreenchido';

/**
 * Retorna o preço preenchido canônico para um frete.
 * Aceita null/undefined (retorna null nesse caso).
 * 
 * O freight DEVE ter `id` — é a chave do cache.
 */
export function usePrecoPreenchido(
  freight: (PrecoPreenchidoInput & { id: string }) | null | undefined,
): PrecoPreenchido | null {
  return useMemo(() => {
    if (!freight || !freight.id) return null;
    return precoPreenchidoDoFrete(freight.id, freight);
  }, [
    freight?.id,
    freight?.price,
    freight?.pricing_type,
    freight?.price_per_km,
    freight?.price_per_ton,
    freight?.required_trucks,
    freight?.weight,
    freight?.distance_km,
  ]);
}

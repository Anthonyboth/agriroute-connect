import { useMemo } from 'react';
import { toFiniteNumber } from '@/lib/geo/toFiniteNumber';

type MaybeNumber = number | string | null | undefined;

export interface OngoingFreightMapInputs {
  originLat?: MaybeNumber;
  originLng?: MaybeNumber;
  destinationLat?: MaybeNumber;
  destinationLng?: MaybeNumber;
  initialDriverLat?: MaybeNumber;
  initialDriverLng?: MaybeNumber;
}

/**
 * Hook exclusivo para MAPA de fretes em andamento.
 * 
 * Responsabilidade: normalizar/parsear entradas (number|string) para evitar
 * markers sumindo quando o PostgREST retorna colunas NUMERIC como string.
 */
export function useOngoingFreightMapInputs(inputs: OngoingFreightMapInputs) {
  return useMemo(() => {
    const originLatNum = toFiniteNumber(inputs.originLat);
    const originLngNum = toFiniteNumber(inputs.originLng);
    const destinationLatNum = toFiniteNumber(inputs.destinationLat);
    const destinationLngNum = toFiniteNumber(inputs.destinationLng);
    const initialDriverLatNum = toFiniteNumber(inputs.initialDriverLat);
    const initialDriverLngNum = toFiniteNumber(inputs.initialDriverLng);

    return {
      originLatNum,
      originLngNum,
      destinationLatNum,
      destinationLngNum,
      initialDriverLatNum,
      initialDriverLngNum,
    };
  }, [
    inputs.originLat,
    inputs.originLng,
    inputs.destinationLat,
    inputs.destinationLng,
    inputs.initialDriverLat,
    inputs.initialDriverLng,
  ]);
}

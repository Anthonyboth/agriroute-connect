import { useMemo } from 'react';

const RURAL_SERVICE_TYPES = new Set(['CARGA']);
const URBAN_SERVICE_TYPES = new Set([
  'GUINCHO',
  'FRETE_MOTO',
  'MUDANCA',
  'ENTREGA_PACOTES',
  'TRANSPORTE_PET',
]);

const SERVICE_TYPE_ALIASES: Record<string, string> = {
  CARGA_FREIGHT: 'CARGA',
  FRETE: 'CARGA',
  TRANSPORTE_CARGA: 'CARGA',

  GUINCHO_FREIGHT: 'GUINCHO',
  REBOQUE: 'GUINCHO',

  MUDANCAS: 'MUDANCA',
  MUDANCA_RESIDENCIAL: 'MUDANCA',
  MUDANCA_COMERCIAL: 'MUDANCA',

  MOTO: 'FRETE_MOTO',
  MOTOBOY: 'FRETE_MOTO',

  PACOTES: 'ENTREGA_PACOTES',
  ENTREGA: 'ENTREGA_PACOTES',

  PET: 'TRANSPORTE_PET',
  TRANSPORTE_ANIMAL: 'TRANSPORTE_PET',
};

const normalizeDriverServiceTypeStrict = (rawType: string): string | null => {
  const normalized = String(rawType || '').toUpperCase().trim();
  if (!normalized) return null;

  const canonical = SERVICE_TYPE_ALIASES[normalized] || normalized;
  if (RURAL_SERVICE_TYPES.has(canonical) || URBAN_SERVICE_TYPES.has(canonical)) {
    return canonical;
  }

  return null;
};

interface UseDriverFreightVisibilityOptions {
  serviceTypes?: unknown;
  defaultToRuralWhenEmpty?: boolean;
}

export const useDriverFreightVisibility = ({
  serviceTypes,
  defaultToRuralWhenEmpty = false,
}: UseDriverFreightVisibilityOptions) => {
  const normalizedServiceTypes = useMemo(() => {
    const raw = Array.isArray(serviceTypes) ? serviceTypes : [];

    const canonical = raw
      .map((type) => normalizeDriverServiceTypeStrict(String(type)))
      .filter((type): type is string => Boolean(type));

    const unique = Array.from(new Set(canonical));

    if (unique.length === 0 && defaultToRuralWhenEmpty) {
      return ['CARGA'];
    }

    return unique;
  }, [serviceTypes, defaultToRuralWhenEmpty]);

  const hasRuralFreights = normalizedServiceTypes.some((type) => RURAL_SERVICE_TYPES.has(type));
  const hasUrbanFreights = normalizedServiceTypes.some((type) => URBAN_SERVICE_TYPES.has(type));

  const canSeeFreightByType = (freightServiceType: string | null | undefined): boolean => {
    const normalized = normalizeDriverServiceTypeStrict(String(freightServiceType || ''));
    if (!normalized) return false;
    return normalizedServiceTypes.includes(normalized);
  };

  return {
    normalizedServiceTypes,
    hasRuralFreights,
    hasUrbanFreights,
    showTabSelector: hasRuralFreights && hasUrbanFreights,
    canSeeFreightByType,
  };
};

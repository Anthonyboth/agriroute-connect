import { getCityId } from './city-utils';

export interface CityData {
  city: string;
  state: string;
  id?: string;
  lat?: number;
  lng?: number;
}

/**
 * Valida se uma cidade foi selecionada da lista (tem city_id)
 */
export const isCitySelected = (cityData: CityData | undefined): boolean => {
  return !!(cityData && cityData.city && cityData.state && cityData.id);
};

/**
 * Valida se os campos básicos de cidade estão preenchidos
 */
export const hasCityData = (cityData: CityData | undefined): boolean => {
  return !!(cityData && cityData.city && cityData.state);
};

/**
 * Tenta obter city_id para uma cidade, retornando erro se não encontrar
 */
export const validateAndGetCityId = async (
  city: string,
  state: string
): Promise<{ valid: boolean; cityId?: string; error?: string }> => {
  if (!city || !state) {
    return {
      valid: false,
      error: 'Cidade e estado são obrigatórios'
    };
  }

  try {
    const cityId = await getCityId(city, state);
    
    if (!cityId) {
      return {
        valid: false,
        error: `Cidade "${city}, ${state}" não encontrada no banco de dados. Por favor, selecione uma cidade da lista.`
      };
    }

    return {
      valid: true,
      cityId
    };
  } catch (error) {
    console.error('Erro ao validar cidade:', error);
    return {
      valid: false,
      error: 'Erro ao validar cidade. Tente novamente.'
    };
  }
};

/**
 * Formata mensagem de erro contextual para campos de cidade
 */
export const getCityErrorMessage = (
  fieldName: string,
  cityData: CityData | undefined,
  isRequired: boolean = true
): string | undefined => {
  if (!cityData || !cityData.city || !cityData.state) {
    return isRequired ? `Por favor, selecione a ${fieldName.toLowerCase()}` : undefined;
  }

  if (!cityData.id) {
    return `⚠️ Selecione a ${fieldName.toLowerCase()} da lista para garantir o match correto`;
  }

  return undefined;
};

/**
 * Valida múltiplas cidades de uma vez
 */
export const validateCities = (
  cities: { name: string; data: CityData | undefined; required: boolean }[]
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  for (const { name, data, required } of cities) {
    const error = getCityErrorMessage(name, data, required);
    if (error) {
      errors.push(error);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Classe CSS para estado de validação do campo de cidade
 */
export const getCityValidationClass = (cityData: CityData | undefined): string => {
  if (!cityData || !cityData.city || !cityData.state) {
    return '';
  }

  if (cityData.id) {
    // Cidade validada
    return 'border-green-500 focus-visible:ring-green-500';
  }

  // Cidade digitada mas não selecionada
  return 'border-yellow-500 focus-visible:ring-yellow-500';
};

/**
 * Ícone para estado de validação
 */
export const getCityValidationIcon = (cityData: CityData | undefined): {
  icon: 'check' | 'warning' | 'error' | null;
  color: string;
  tooltip: string;
} | null => {
  if (!cityData || !cityData.city || !cityData.state) {
    return null;
  }

  if (cityData.id) {
    return {
      icon: 'check',
      color: 'text-green-600',
      tooltip: 'Cidade validada ✓'
    };
  }

  return {
    icon: 'warning',
    color: 'text-yellow-600',
    tooltip: 'Selecione da lista para validar'
  };
};

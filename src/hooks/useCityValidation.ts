import { useState, useCallback } from 'react';
import { getCityId } from '@/lib/city-utils';

export interface CityValidationResult {
  isValid: boolean;
  hasSelection: boolean;
  error?: string;
  warningMessage?: string;
}

export interface CityValue {
  city: string;
  state: string;
  id?: string;
  lat?: number;
  lng?: number;
}

export const useCityValidation = () => {
  const [validationState, setValidationState] = useState<Record<string, CityValidationResult>>({});

  const validateCity = useCallback((
    fieldName: string,
    value: CityValue | undefined,
    isRequired: boolean = false
  ): CityValidationResult => {
    // Campo vazio
    if (!value || !value.city || !value.state) {
      const result: CityValidationResult = {
        isValid: !isRequired,
        hasSelection: false,
        error: isRequired ? 'Por favor, selecione uma cidade' : undefined
      };
      setValidationState(prev => ({ ...prev, [fieldName]: result }));
      return result;
    }

    // Cidade digitada mas não selecionada da lista (sem city_id)
    if (!value.id) {
      const result: CityValidationResult = {
        isValid: false,
        hasSelection: false,
        warningMessage: '⚠️ Por favor, selecione uma cidade da lista para garantir o match correto',
        error: 'Cidade não selecionada da lista'
      };
      setValidationState(prev => ({ ...prev, [fieldName]: result }));
      return result;
    }

    // Cidade válida e selecionada
    const result: CityValidationResult = {
      isValid: true,
      hasSelection: true
    };
    setValidationState(prev => ({ ...prev, [fieldName]: result }));
    return result;
  }, []);

  const validateCityWithFallback = useCallback(async (
    fieldName: string,
    value: CityValue | undefined,
    isRequired: boolean = false
  ): Promise<CityValidationResult> => {
    // Validação básica
    const basicValidation = validateCity(fieldName, value, isRequired);
    
    // Se tem cidade e estado mas não tem ID, tentar buscar
    if (value && value.city && value.state && !value.id) {
      try {
        const cityId = await getCityId(value.city, value.state);
        if (cityId) {
          // Atualizar o valor com o city_id encontrado
          const result: CityValidationResult = {
            isValid: true,
            hasSelection: true
          };
          setValidationState(prev => ({ ...prev, [fieldName]: result }));
          return result;
        }
      } catch (error) {
        console.error('Erro ao buscar city_id:', error);
      }
    }

    return basicValidation;
  }, [validateCity]);

  const clearValidation = useCallback((fieldName: string) => {
    setValidationState(prev => {
      const newState = { ...prev };
      delete newState[fieldName];
      return newState;
    });
  }, []);

  const clearAllValidations = useCallback(() => {
    setValidationState({});
  }, []);

  const getValidationResult = useCallback((fieldName: string): CityValidationResult | undefined => {
    return validationState[fieldName];
  }, [validationState]);

  const getValidationClass = useCallback((fieldName: string): string => {
    const result = validationState[fieldName];
    if (!result) return '';
    
    if (result.isValid && result.hasSelection) {
      return 'border-green-500 focus-visible:ring-green-500';
    }
    
    if (result.warningMessage) {
      return 'border-yellow-500 focus-visible:ring-yellow-500';
    }
    
    if (result.error) {
      return 'border-destructive focus-visible:ring-destructive';
    }
    
    return '';
  }, [validationState]);

  return {
    validateCity,
    validateCityWithFallback,
    clearValidation,
    clearAllValidations,
    getValidationResult,
    getValidationClass,
    validationState
  };
};

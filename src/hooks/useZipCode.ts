import { useState, useCallback } from 'react';
import { ZipCodeService } from '@/services/zipCodeService';
import { toast } from 'sonner';

interface ZipCodeData {
  zipCode: string;
  city: string;
  state: string;
  neighborhood?: string;
  street?: string;
  cityId?: string;
  lat?: number;
  lng?: number;
}

export function useZipCode() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ZipCodeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchZipCode = useCallback(async (zipCode: string) => {
    if (!zipCode || zipCode.replace(/\D/g, '').length !== 8) {
      setError('CEP deve ter 8 dígitos');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await ZipCodeService.searchZipCode(zipCode);

      if (!result) {
        setError('CEP não encontrado');
        toast.error('CEP inválido ou não encontrado. Verifique e tente novamente.');
        setData(null);
        return null;
      }

      setData(result);
      return result;
    } catch (err) {
      const errorMsg = 'Erro ao buscar CEP. Tente novamente.';
      setError(errorMsg);
      toast.error(errorMsg);
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearData = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return {
    loading,
    data,
    error,
    searchZipCode,
    clearData
  };
}

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface City {
  id: string;
  name: string;
  state: string;
  display_name: string;
  lat?: number;
  lng?: number;
}

export const useCitySearch = () => {
  const [cities, setCities] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchCities = useCallback(async (searchTerm: string, limit = 20) => {
    if (!searchTerm || searchTerm.length < 2) {
      setCities([]);
      setError(null);
      return [];
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: searchError } = await supabase.rpc('search_cities', {
        search_term: searchTerm,
        limit_count: limit
      });

      if (searchError) {
        throw searchError;
      }

      const results = data || [];
      setCities(results);
      return results;
    } catch (err) {
      console.error('Erro ao buscar cidades:', err);
      const errorMessage = 'Erro ao buscar cidades. Tente novamente.';
      setError(errorMessage);
      toast.error(errorMessage);
      setCities([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setCities([]);
    setError(null);
  }, []);

  return {
    cities,
    isLoading,
    error,
    searchCities,
    clearResults
  };
};
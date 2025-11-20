import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { NFeDocument, NFeManifestationPayload, NFeFilter } from '@/types/nfe';
import { toast } from 'sonner';

export function useNfe() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanNfe = useCallback(async (accessKey: string, freightId?: string): Promise<NFeDocument | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: scanError } = await supabase.functions.invoke('nfe-scan', {
        body: { access_key: accessKey, freight_id: freightId },
      });

      if (scanError) throw scanError;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao escanear NF-e');
      }

      toast.success('NF-e escaneada com sucesso');
      return data.data;
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao escanear NF-e';
      setError(errorMessage);
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const manifestNfe = useCallback(async (payload: NFeManifestationPayload): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: manifestError } = await supabase.functions.invoke('nfe-manifest', {
        body: payload,
      });

      if (manifestError) throw manifestError;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao manifestar NF-e');
      }

      toast.success('NF-e manifestada com sucesso');
      return true;
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao manifestar NF-e';
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const listNfes = useCallback(async (filters?: NFeFilter): Promise<NFeDocument[]> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.freight_id) params.append('freight_id', filters.freight_id);

      const { data, error: listError } = await supabase.functions.invoke('nfe-list', {
        method: 'GET',
        body: null,
      });

      if (listError) throw listError;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao listar NF-es');
      }

      return data.data || [];
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao listar NF-es';
      setError(errorMessage);
      toast.error(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    scanNfe,
    manifestNfe,
    listNfes,
    clearError: () => setError(null),
  };
}

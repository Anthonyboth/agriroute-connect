import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { NFeDocument, NFeManifestationPayload, NFeFilter } from '@/types/nfe';
import { toast } from 'sonner';

export function useNfe() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanNfe = useCallback(async (accessKey: string, freightId?: string): Promise<NFeDocument | null> => {
    console.log('[NFE] 🔄 FASE 3: Iniciando scanNfe com logs detalhados');
    console.log('[NFE] 📋 Params:', { accessKey, freightId });
    
    setLoading(true);
    setError(null);

    try {
      console.log('[NFE] 📡 Invocando edge function nfe-scan...');
      const { data, error: scanError } = await supabase.functions.invoke('nfe-scan', {
        body: { access_key: accessKey, freight_id: freightId },
      });

      console.log('[NFE] 📦 Resposta nfe-scan:', { data, error: scanError, hasData: !!data, hasError: !!scanError });

      if (scanError) {
        console.error('[NFE] ❌ Erro na resposta:', scanError);
        throw scanError;
      }

      if (!data.success) {
        console.error('[NFE] ❌ data.success = false, error:', data.error);
        throw new Error(data.error || 'Erro ao escanear NF-e');
      }

      console.log('[NFE] ✅ NFe escaneada com sucesso:', data.data);
      toast.success('NF-e escaneada com sucesso');
      return data.data;
    } catch (err: any) {
      console.error('[NFE] 💥 Exception caught:', err);
      const errorMessage = err.message || 'Erro ao escanear NF-e';
      setError(errorMessage);
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
      console.log('[NFE] 🏁 scanNfe finalizado');
    }
  }, []);

  const manifestNfe = useCallback(async (payload: NFeManifestationPayload): Promise<boolean> => {
    console.log('[NFE] 🔄 FASE 3: Iniciando manifestNfe com logs detalhados');
    console.log('[NFE] 📋 Payload:', payload);
    
    setLoading(true);
    setError(null);

    try {
      console.log('[NFE] 📡 Invocando edge function nfe-manifest...');
      const { data, error: manifestError } = await supabase.functions.invoke('nfe-manifest', {
        body: payload,
      });

      console.log('[NFE] 📦 Resposta nfe-manifest:', { data, error: manifestError, hasData: !!data, hasError: !!manifestError });

      if (manifestError) {
        console.error('[NFE] ❌ Erro na resposta:', manifestError);
        throw manifestError;
      }

      if (!data.success) {
        console.error('[NFE] ❌ data.success = false, error:', data.error);
        throw new Error(data.error || 'Erro ao manifestar NF-e');
      }

      console.log('[NFE] ✅ NFe manifestada com sucesso');
      toast.success('NF-e manifestada com sucesso');
      return true;
    } catch (err: any) {
      console.error('[NFE] 💥 Exception caught:', err);
      const errorMessage = err.message || 'Erro ao manifestar NF-e';
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
      console.log('[NFE] 🏁 manifestNfe finalizado');
    }
  }, []);

  const listNfes = useCallback(async (filters?: NFeFilter): Promise<NFeDocument[]> => {
    console.log('[NFE] 🔄 Iniciando listNfes');
    console.log('[NFE] 📋 Filters:', filters);
    
    setLoading(true);
    setError(null);

    try {
      // ✅ Usar supabase.functions.invoke como scanNfe e manifestNfe
      const { data, error: listError } = await supabase.functions.invoke('nfe-list', {
        body: filters || {},
      });

      console.log('[NFE] 📦 Resposta nfe-list:', { data, error: listError });

      if (listError) {
        console.error('[NFE] ❌ Erro na resposta:', listError);
        throw listError;
      }

      if (!data.success) {
        console.error('[NFE] ❌ data.success = false, error:', data.error);
        throw new Error(data.error || 'Erro ao listar NF-es');
      }

      console.log('[NFE] ✅ NFes listadas:', { count: data.data?.length || 0 });
      return data.data || [];
    } catch (err: any) {
      console.error('[NFE] 💥 Exception caught:', err);
      const errorMessage = err.message || 'Erro ao listar NF-es';
      setError(errorMessage);
      toast.error(errorMessage);
      return [];
    } finally {
      setLoading(false);
      console.log('[NFE] 🏁 listNfes finalizado');
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

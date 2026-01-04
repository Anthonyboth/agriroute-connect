import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { NFeDocument, NFeManifestationPayload, NFeFilter, ManifestationType } from '@/types/nfe';
import { toast } from 'sonner';
import { translateSefazError, isRetryableError } from '@/lib/sefaz-errors';

export function useNfe() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanNfe = useCallback(async (accessKey: string, freightId?: string): Promise<NFeDocument | null> => {
    console.log('[NFE] 🔄 Iniciando scanNfe');
    console.log('[NFE] 📋 Params:', { accessKey, freightId });
    
    setLoading(true);
    setError(null);

    try {
      const { data, error: scanError } = await supabase.functions.invoke('nfe-scan', {
        body: { access_key: accessKey, freight_id: freightId },
      });

      console.log('[NFE] 📦 Resposta nfe-scan:', { data, error: scanError });

      if (scanError) {
        throw scanError;
      }

      if (!data.success) {
        // Traduzir erro SEFAZ
        const sefazCode = data.sefaz_code || data.code;
        const translated = translateSefazError(sefazCode, data.error);
        
        toast.error(translated.message, {
          description: translated.action,
        });
        
        setError(translated.message);
        return null;
      }

      console.log('[NFE] ✅ NFe escaneada com sucesso');
      toast.success('NF-e escaneada com sucesso');
      return data.data;
    } catch (err: any) {
      console.error('[NFE] 💥 Exception:', err);
      const errorMessage = err.message || 'Erro ao escanear NF-e';
      setError(errorMessage);
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const manifestNfe = useCallback(async (payload: NFeManifestationPayload): Promise<boolean> => {
    console.log('[NFE] 🔄 Iniciando manifestNfe');
    console.log('[NFE] 📋 Payload:', payload);
    
    setLoading(true);
    setError(null);

    try {
      const { data, error: manifestError } = await supabase.functions.invoke('nfe-manifest', {
        body: payload,
      });

      console.log('[NFE] 📦 Resposta nfe-manifest:', { data, error: manifestError });

      if (manifestError) {
        throw manifestError;
      }

      if (!data.success) {
        // Traduzir erro SEFAZ
        const sefazCode = data.sefaz_code || data.code;
        const translated = translateSefazError(sefazCode, data.error);
        
        // Mostrar toast com ação se for erro retryable
        if (sefazCode && isRetryableError(sefazCode)) {
          toast.error(translated.message, {
            description: translated.action,
            action: {
              label: 'Tentar novamente',
              onClick: () => manifestNfe(payload),
            },
          });
        } else {
          toast.error(translated.message, {
            description: translated.action,
          });
        }
        
        setError(translated.message);
        return false;
      }

      console.log('[NFE] ✅ NFe manifestada com sucesso');
      
      // Mensagem específica por tipo de manifestação
      const messageByType: Record<ManifestationType, string> = {
        'ciencia': 'Ciência da operação registrada',
        'confirmacao': 'Operação confirmada com sucesso',
        'desconhecimento': 'Desconhecimento registrado',
        'nao_realizada': 'Operação não realizada registrada',
      };
      
      toast.success(messageByType[payload.manifestation_type] || 'NF-e manifestada com sucesso', {
        description: data.protocol ? `Protocolo: ${data.protocol}` : undefined,
      });
      
      return true;
    } catch (err: any) {
      console.error('[NFE] 💥 Exception:', err);
      const errorMessage = err.message || 'Erro ao manifestar NF-e';
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const listNfes = useCallback(async (filters?: NFeFilter): Promise<NFeDocument[]> => {
    console.log('[NFE] 🔄 Iniciando listNfes');
    console.log('[NFE] 📋 Filters:', filters);
    
    setLoading(true);
    setError(null);

    try {
      const { data, error: listError } = await supabase.functions.invoke('nfe-list', {
        body: filters || {},
      });

      console.log('[NFE] 📦 Resposta nfe-list:', { data, error: listError });

      if (listError) {
        throw listError;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao listar NF-es');
      }

      console.log('[NFE] ✅ NFes listadas:', { count: data.data?.length || 0 });
      return data.data || [];
    } catch (err: any) {
      console.error('[NFE] 💥 Exception:', err);
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

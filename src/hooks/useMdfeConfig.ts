import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MdfeConfig {
  id?: string;
  user_id: string;
  cnpj: string;
  inscricao_estadual: string;
  rntrc: string;
  razao_social?: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  serie_mdfe?: string;
  created_at?: string;
  updated_at?: string;
}

export function useMdfeConfig(userId: string) {
  const [config, setConfig] = useState<MdfeConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    if (!userId) {
      console.warn('[MDFE-CONFIG] userId não fornecido');
      return;
    }

    console.log('[MDFE-CONFIG] 🔍 Buscando configuração para userId:', userId);
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('mdfe_config')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) {
        console.error('[MDFE-CONFIG] ❌ Erro ao buscar:', fetchError);
        setError(fetchError.message);
        return;
      }

      console.log('[MDFE-CONFIG] ✅ Configuração encontrada:', { hasConfig: !!data, data });
      setConfig(data);
    } catch (err: any) {
      console.error('[MDFE-CONFIG] 💥 Exception:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (configData: Omit<MdfeConfig, 'id' | 'created_at' | 'updated_at'>) => {
    console.log('[MDFE-CONFIG] 💾 Salvando configuração:', configData);
    setLoading(true);
    setError(null);

    try {
      const { error: saveError } = await supabase
        .from('mdfe_config')
        .upsert({
          ...configData,
          user_id: userId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (saveError) {
        console.error('[MDFE-CONFIG] ❌ Erro ao salvar:', saveError);
        setError(saveError.message);
        toast.error(`Erro ao salvar: ${saveError.message}`);
        return { error: saveError };
      }

      console.log('[MDFE-CONFIG] ✅ Configuração salva com sucesso');
      toast.success('Configuração MDFe salva com sucesso');
      await fetchConfig(); // Recarregar após salvar
      return { error: null };
    } catch (err: any) {
      console.error('[MDFE-CONFIG] 💥 Exception ao salvar:', err);
      const errorMsg = err.message || 'Erro desconhecido';
      setError(errorMsg);
      toast.error(errorMsg);
      return { error: err };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchConfig();
    }
  }, [userId]);

  return {
    config,
    loading,
    error,
    saveConfig,
    refetch: fetchConfig,
    hasConfig: !!config,
  };
}

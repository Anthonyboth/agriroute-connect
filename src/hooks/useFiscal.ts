import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CTeData {
  id: string;
  frete_id: string;
  empresa_id: string;
  referencia: string;
  numero: string | null;
  serie: string | null;
  chave: string | null;
  status: string;
  xml_url: string | null;
  dacte_url: string | null;
  mensagem_erro: string | null;
  created_at: string;
  authorized_at: string | null;
}

export interface AntifraudAnalysis {
  score: number;
  nivel: 'low' | 'medium' | 'high' | 'critical';
  total_alertas: number;
  alertas_criticos: number;
  alertas_altos: number;
  alertas_medios: number;
  alertas_baixos: number;
}

export interface AntifraudEvent {
  id: string;
  tipo: string;
  codigo_regra: string;
  severidade: string;
  descricao: string;
  resolvido: boolean;
  created_at: string;
}

export interface ComplianceKPIs {
  total_ctes: number;
  ctes_autorizados: number;
  ctes_rejeitados: number;
  taxa_sucesso: number;
  total_alertas: number;
  alertas_pendentes: number;
  alertas_resolvidos: number;
  taxa_resolucao: number;
  score_compliance: number;
}

export function useFiscal() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emitirCTe = useCallback(async (
    freightId: string,
    empresaId: string,
    nfeChaves?: string[]
  ): Promise<CTeData | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('cte-emitir', {
        body: {
          frete_id: freightId,
          empresa_id: empresaId,
          nfe_chaves: nfeChaves || [],
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.success) {
        toast.success(`CT-e ${data.status === 'autorizado' ? 'autorizado' : 'enviado'} com sucesso`);
      }

      return data;
    } catch (err: any) {
      const message = err.message || 'Erro ao emitir CT-e';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const consultarCTe = useCallback(async (
    cteId?: string,
    referencia?: string
  ): Promise<CTeData | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('cte-consultar', {
        body: { cte_id: cteId, referencia },
      });

      if (fnError) throw fnError;

      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    } catch (err: any) {
      const message = err.message || 'Erro ao consultar CT-e';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const executarAntifraude = useCallback(async (
    freightId: string,
    empresaId?: string
  ): Promise<{ analise: AntifraudAnalysis; eventos: AntifraudEvent[] } | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('antifraude-executar', {
        body: { frete_id: freightId, empresa_id: empresaId },
      });

      if (fnError) throw fnError;

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.analise.nivel === 'critical') {
        toast.error('Alerta crítico de fraude detectado!');
      } else if (data.analise.nivel === 'high') {
        toast.warning('Risco alto detectado na análise');
      } else if (data.analise.total_alertas > 0) {
        toast.info(`${data.analise.total_alertas} alerta(s) encontrado(s)`);
      } else {
        toast.success('Nenhum alerta de fraude detectado');
      }

      return {
        analise: data.analise,
        eventos: data.eventos || [],
      };
    } catch (err: any) {
      const message = err.message || 'Erro ao executar análise antifraude';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const obterKPIsCompliance = useCallback(async (
    empresaId?: string
  ): Promise<ComplianceKPIs | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('compliance-kpis', {
        body: { empresa_id: empresaId },
      });

      if (fnError) throw fnError;

      if (data.error) {
        throw new Error(data.error);
      }

      return data.kpis;
    } catch (err: any) {
      const message = err.message || 'Erro ao obter KPIs';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const listarCTes = useCallback(async (
    empresaId?: string,
    freteId?: string
  ): Promise<CTeData[]> => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('ctes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (empresaId) {
        query = query.eq('empresa_id', empresaId);
      }

      if (freteId) {
        query = query.eq('frete_id', freteId);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      return (data || []) as CTeData[];
    } catch (err: any) {
      const message = err.message || 'Erro ao listar CT-es';
      setError(message);
      toast.error(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const listarAlertasAntifraude = useCallback(async (
    empresaId?: string,
    apenasNaoResolvidos = true
  ): Promise<AntifraudEvent[]> => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('auditoria_eventos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (empresaId) {
        query = query.eq('empresa_id', empresaId);
      }

      if (apenasNaoResolvidos) {
        query = query.eq('resolvido', false);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      return (data || []).map((e: any) => ({
        id: e.id,
        tipo: e.tipo,
        codigo_regra: e.codigo_regra,
        severidade: e.severidade,
        descricao: e.descricao,
        resolvido: e.resolvido,
        created_at: e.created_at,
      }));
    } catch (err: any) {
      const message = err.message || 'Erro ao listar alertas';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelarCTe = useCallback(async (
    cteId: string,
    justificativa: string
  ): Promise<{ success: boolean; message?: string } | null> => {
    setLoading(true);
    setError(null);

    try {
      // Validar justificativa localmente antes de enviar
      if (!justificativa || justificativa.length < 15 || justificativa.length > 255) {
        throw new Error('A justificativa deve ter entre 15 e 255 caracteres');
      }

      const { data, error: fnError } = await supabase.functions.invoke('cte-cancelar', {
        body: { cte_id: cteId, justificativa },
      });

      if (fnError) throw fnError;

      if (data.error) {
        throw new Error(data.message || data.error);
      }

      toast.success('CT-e cancelado com sucesso');
      return { success: true, message: data.message };
    } catch (err: any) {
      const message = err.message || 'Erro ao cancelar CT-e';
      setError(message);
      toast.error(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  const resolverAlerta = useCallback(async (
    alertaId: string,
    notas?: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id || '')
        .single();

      const { error: updateError } = await supabase
        .from('auditoria_eventos')
        .update({
          resolvido: true,
          resolvido_at: new Date().toISOString(),
          resolvido_por: profile?.id,
          notas_resolucao: notas,
        })
        .eq('id', alertaId);

      if (updateError) throw updateError;

      toast.success('Alerta marcado como resolvido');
      return true;
    } catch (err: any) {
      const message = err.message || 'Erro ao resolver alerta';
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    emitirCTe,
    consultarCTe,
    cancelarCTe,
    executarAntifraude,
    obterKPIsCompliance,
    listarCTes,
    listarAlertasAntifraude,
    resolverAlerta,
    clearError: () => setError(null),
  };
}

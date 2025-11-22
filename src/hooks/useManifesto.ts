import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface MDFeData {
  id: string;
  chave_acesso: string;
  numero_mdfe: string;
  protocolo_autorizacao: string | null;
  status: 'PENDENTE' | 'AUTORIZADO' | 'ENCERRADO' | 'CANCELADO' | 'REJEITADO' | 'CONTINGENCIA';
  data_emissao: string;
  data_encerramento: string | null;
  motivo_cancelamento: string | null;
  xml_content: string | null;
  dacte_url: string | null;
  uf_inicio: string;
  uf_fim: string;
  municipio_carregamento: string;
  municipio_descarregamento: string;
  condutor: {
    nome: string;
    cpf: string;
  };
  veiculo: {
    placa: string;
    tipo_rodado: string;
    renavam: string;
  };
  documentos: Array<{
    tipo_documento: string;
    chave_acesso_doc: string;
  }>;
  logs: Array<{
    tipo_operacao: string;
    sucesso: boolean;
    observacao: string;
    created_at: string;
  }>;
}

export function useManifesto(freightId: string) {
  const [manifesto, setManifesto] = useState<MDFeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consultarMDFe = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: consultaError } = await supabase.functions.invoke('mdfe-consultar', {
        body: { freight_id: freightId }
      });

      if (consultaError) throw consultaError;
      
      setManifesto(data);
      return data;
    } catch (err: any) {
      const errorMsg = err.message || 'Erro ao consultar MDFe';
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [freightId]);

  const emitirMDFe = useCallback(async (modo: 'NORMAL' | 'CONTINGENCIA' = 'NORMAL') => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: emissaoError } = await supabase.functions.invoke('mdfe-emitir', {
        body: { 
          freight_id: freightId,
          modo,
          documentos: [] // Será preenchido automaticamente pela Edge Function
        }
      });

      if (emissaoError) throw emissaoError;

      toast({
        title: "MDFe Emitido",
        description: `Manifesto ${data.numero_mdfe} emitido com sucesso`,
      });

      await consultarMDFe();
      return { success: true, data };
    } catch (err: any) {
      const errorMsg = err.message || 'Erro ao emitir MDFe';
      setError(errorMsg);
      toast({
        title: "Erro na Emissão",
        description: errorMsg,
        variant: "destructive",
      });
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [freightId, consultarMDFe]);

  const encerrarMDFe = useCallback(async (uf?: string, municipioCodigo?: string) => {
    if (!manifesto) return { success: false, error: 'Manifesto não carregado' };

    try {
      setLoading(true);
      setError(null);

      const { data, error: encerramentoError } = await supabase.functions.invoke('mdfe-encerrar', {
        body: { 
          mdfe_id: manifesto.id,
          uf_encerramento: uf,
          municipio_codigo_encerramento: municipioCodigo
        }
      });

      if (encerramentoError) throw encerramentoError;

      toast({
        title: "MDFe Encerrado",
        description: "Manifesto encerrado com sucesso",
      });

      await consultarMDFe();
      return { success: true, data };
    } catch (err: any) {
      const errorMsg = err.message || 'Erro ao encerrar MDFe';
      setError(errorMsg);
      toast({
        title: "Erro no Encerramento",
        description: errorMsg,
        variant: "destructive",
      });
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [manifesto, consultarMDFe]);

  const cancelarMDFe = useCallback(async (justificativa: string) => {
    if (!manifesto) return { success: false, error: 'Manifesto não carregado' };

    if (justificativa.length < 15) {
      const errorMsg = 'Justificativa deve ter no mínimo 15 caracteres';
      setError(errorMsg);
      toast({
        title: "Justificativa Inválida",
        description: errorMsg,
        variant: "destructive",
      });
      return { success: false, error: errorMsg };
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: cancelamentoError } = await supabase.functions.invoke('mdfe-cancelar', {
        body: { 
          mdfe_id: manifesto.id,
          justificativa
        }
      });

      if (cancelamentoError) throw cancelamentoError;

      toast({
        title: "MDFe Cancelado",
        description: "Manifesto cancelado com sucesso",
      });

      await consultarMDFe();
      return { success: true, data };
    } catch (err: any) {
      const errorMsg = err.message || 'Erro ao cancelar MDFe';
      setError(errorMsg);
      toast({
        title: "Erro no Cancelamento",
        description: errorMsg,
        variant: "destructive",
      });
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [manifesto, consultarMDFe]);

  const baixarXML = useCallback(() => {
    if (!manifesto?.xml_content) {
      toast({
        title: "XML Indisponível",
        description: "O XML do MDFe ainda não está disponível",
        variant: "destructive",
      });
      return;
    }

    const blob = new Blob([manifesto.xml_content], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MDFe_${manifesto.numero_mdfe}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, [manifesto]);

  const baixarDACTE = useCallback(() => {
    if (!manifesto?.dacte_url) {
      toast({
        title: "DACTE Indisponível",
        description: "O DACTE ainda não foi gerado",
        variant: "destructive",
      });
      return;
    }

    window.open(manifesto.dacte_url, '_blank');
  }, [manifesto]);

  return {
    manifesto,
    loading,
    error,
    consultarMDFe,
    emitirMDFe,
    encerrarMDFe,
    cancelarMDFe,
    baixarXML,
    baixarDACTE
  };
}

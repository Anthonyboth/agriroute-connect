import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NFeDocument, NFeManifestationPayload, NFeFilter, ManifestationType } from "@/types/nfe";
import { toast } from "sonner";
import { translateSefazError } from "@/lib/sefaz-errors";

type EmitNfePayload = {
  issuer_id: string;
  freight_id?: string;
  destinatario: {
    cnpj_cpf: string;
    razao_social: string;
    ie?: string;
    email?: string;
    telefone?: string;
    endereco?: {
      logradouro?: string;
      numero?: string;
      bairro?: string;
      municipio?: string;
      uf?: string;
      cep?: string;
    };
  };
  itens: Array<{
    descricao: string;
    ncm?: string;
    cfop?: string;
    unidade?: string;
    quantidade: number;
    valor_unitario: number;
  }>;
  valores: {
    total: number;
    frete?: number;
    desconto?: number;
  };
  informacoes_adicionais?: string;
};

type EmitNfeResponse = {
  success: boolean;
  message: string;
  emission_id?: string;
  internal_ref?: string;
  status?: "authorized" | "processing" | "rejected" | "canceled";
  numero?: string | number | null;
  chave?: string | null;
  danfe_url?: string | null;
  xml_url?: string | null;
  ambiente?: "producao" | "homologacao";
  code?: string;
};

type PollResponse = {
  success: boolean;
  message?: string;
  updated?: number;
  results?: Array<{
    emission_id: string;
    status: "authorized" | "processing" | "rejected" | "canceled";
    message?: string;
    numero?: string | number | null;
    chave?: string | null;
    danfe_url?: string | null;
    xml_url?: string | null;
  }>;
};

export function useNfe() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanNfe = useCallback(async (accessKey: string, freightId?: string): Promise<NFeDocument | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: scanError } = await supabase.functions.invoke("nfe-scan", {
        body: { access_key: accessKey, freight_id: freightId },
      });

      if (scanError) throw scanError;

      if (!data?.success) {
        const sefazCode = data?.sefaz_code || data?.code;
        const translated = translateSefazError(sefazCode, data?.error || data?.message);

        toast.error(translated.message, { description: translated.action });
        setError(translated.message);
        return null;
      }

      toast.success("NF-e escaneada com sucesso");
      return data.data as NFeDocument;
    } catch (err: any) {
      const msg = err?.message || "Erro ao escanear NF-e";
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Emissão (Focus) via edge function nfe-emissao
  const emitNfe = useCallback(async (payload: EmitNfePayload): Promise<EmitNfeResponse> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: emitError } = await supabase.functions.invoke("nfe-emissao", {
        body: payload,
      });

      if (emitError) throw emitError;

      const resp = data as EmitNfeResponse;

      if (!resp?.success) {
        const msg = resp?.message || "Falha ao emitir NF-e";
        setError(msg);
        toast.error(msg);
        return resp;
      }

      toast.success("NF-e enviada!", {
        description:
          resp.status === "processing"
            ? "Aguardando autorização da SEFAZ..."
            : resp.status === "authorized"
              ? "Autorizada!"
              : resp.message,
      });

      return resp;
    } catch (err: any) {
      const msg = err?.message || "Erro ao emitir NF-e";
      setError(msg);
      toast.error(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Polling real da Focus: chama nfe-update-status (por emission_id ou internal_ref)
  const pollEmissionStatus = useCallback(
    async (params: { emission_id?: string; internal_ref?: string }): Promise<PollResponse> => {
      try {
        const { data, error: pollError } = await supabase.functions.invoke("nfe-update-status", {
          body: params,
        });
        if (pollError) throw pollError;

        return data as PollResponse;
      } catch (err: any) {
        const msg = err?.message || "Erro ao consultar status da NF-e";
        return { success: false, message: msg };
      }
    },
    [],
  );

  // ✅ Poll automático (sem travar UI): tenta por até 90s
  const waitForFinalStatus = useCallback(
    async (
      params: { emission_id?: string; internal_ref?: string },
      opts?: { timeoutMs?: number; intervalMs?: number },
    ) => {
      const timeoutMs = opts?.timeoutMs ?? 90_000;
      const intervalMs = opts?.intervalMs ?? 6_000;

      const start = Date.now();

      while (Date.now() - start < timeoutMs) {
        const resp = await pollEmissionStatus(params);
        const item = resp?.results?.[0];

        if (item?.status === "authorized") {
          toast.success("NF-e autorizada!", { description: "DANFE e XML disponíveis." });
          return resp;
        }

        if (item?.status === "rejected") {
          const msg = item?.message || "NF-e rejeitada.";
          toast.error("NF-e rejeitada", { description: msg });
          return resp;
        }

        if (item?.status === "canceled") {
          toast("NF-e cancelada.");
          return resp;
        }

        // ainda processando
        await new Promise((r) => setTimeout(r, intervalMs));
      }

      toast("NF-e ainda em processamento.", {
        description: "Você pode sair desta tela. O status será atualizado automaticamente no painel.",
      });

      return { success: true, message: "Timeout de polling. Ainda processando." };
    },
    [pollEmissionStatus],
  );

  // ✅ Manifestação assistida: NÃO usa Focus, só registra declaração interna
  const confirmAssistedManifestation = useCallback(async (payload: NFeManifestationPayload): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: updateError } = await supabase.functions.invoke("nfe-manifestation-assisted", {
        body: {
          access_key: payload.access_key,
          manifestation_type: payload.manifestation_type,
          freight_id: payload.freight_id,
        },
      });

      if (updateError) throw updateError;

      if (!data?.success) {
        throw new Error(data?.message || data?.error || "Falha ao registrar manifestação.");
      }

      const typeLabels: Record<ManifestationType, string> = {
        ciencia: "Ciência da Operação",
        confirmacao: "Confirmação da Operação",
        desconhecimento: "Desconhecimento da Operação",
        nao_realizada: "Operação Não Realizada",
      };

      toast.success("Manifestação registrada!", {
        description: `Status: ${typeLabels[payload.manifestation_type]}`,
      });

      return true;
    } catch (err: any) {
      const msg = err?.message || "Erro ao registrar manifestação.";
      setError(msg);
      toast.error(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const listNfes = useCallback(async (filters?: NFeFilter): Promise<NFeDocument[]> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: listError } = await supabase.functions.invoke("nfe-list", {
        body: filters || {},
      });

      if (listError) throw listError;

      if (!data?.success) {
        throw new Error(data?.message || data?.error || "Erro ao listar NF-es.");
      }

      return (data.data || []) as NFeDocument[];
    } catch (err: any) {
      const msg = err?.message || "Erro ao listar NF-es";
      setError(msg);
      toast.error(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    scanNfe,
    emitNfe,
    pollEmissionStatus,
    waitForFinalStatus,
    confirmAssistedManifestation,
    listNfes,
    clearError: () => setError(null),
  };
}

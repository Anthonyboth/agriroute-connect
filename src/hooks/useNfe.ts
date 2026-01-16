import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NFeDocument, NFeManifestationPayload, NFeFilter, ManifestationType } from "@/types/nfe";
import { toast } from "sonner";
import { translateSefazError } from "@/lib/sefaz-errors";

type PollStatusInput = {
  emission_id?: string;
  internal_ref?: string;
};

export function useNfe() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanNfe = useCallback(async (accessKey: string, freightId?: string): Promise<NFeDocument | null> => {
    console.log("[NFE] 🔄 Iniciando scanNfe");
    console.log("[NFE] 📋 Params:", { accessKey, freightId });

    setLoading(true);
    setError(null);

    try {
      const { data, error: scanError } = await supabase.functions.invoke("nfe-scan", {
        body: { access_key: accessKey, freight_id: freightId },
      });

      console.log("[NFE] 📦 Resposta nfe-scan:", { data, error: scanError });

      if (scanError) throw scanError;

      if (!data?.success) {
        const sefazCode = data?.sefaz_code || data?.code;
        const translated = translateSefazError(sefazazCodeSafe(sefazCode), data?.error);

        toast.error(translated.message, { description: translated.action });
        setError(translated.message);
        return null;
      }

      toast.success("NF-e escaneada com sucesso");
      return (data?.data ?? null) as NFeDocument | null;
    } catch (err: any) {
      console.error("[NFE] 💥 Exception:", err);
      const errorMessage = err?.message || "Erro ao escanear NF-e";
      setError(errorMessage);
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Manifestação ASSISTIDA (declaratória): atualiza o status local (sem SEFAZ).
   * ✅ Deve chamar a edge function correta de manifestação: `nfe-manifest`
   * ❌ NÃO deve chamar `nfe-update-status` (essa é para consultar status de emissão/SEFAZ via Focus).
   */
  const confirmAssistedManifestation = useCallback(async (payload: NFeManifestationPayload): Promise<boolean> => {
    console.log("[NFE] 🔄 Iniciando manifestação assistida");
    setLoading(true);
    setError(null);

    try {
      const { data, error: manifestError } = await supabase.functions.invoke("nfe-manifest", {
        body: {
          access_key: payload.access_key,
          manifestation_type: payload.manifestation_type,
          manifestation_mode: "assisted",
          freight_id: payload.freight_id,
        },
      });

      if (manifestError) throw manifestError;

      if (!data?.success) {
        throw new Error(data?.error || "Falha ao registrar manifestação");
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
      console.error("[NFE] Erro:", err);
      const msg = err?.message || "Erro ao registrar";
      setError(msg);
      toast.error(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Consulta / atualiza status da EMISSÃO (Focus/SEFAZ).
   * Use depois que criar a emissão (você tem `emission_id` ou `internal_ref`).
   */
  const pollEmissionStatus = useCallback(async (input: PollStatusInput) => {
    setLoading(true);
    setError(null);

    try {
      if (!input?.emission_id && !input?.internal_ref) {
        throw new Error("Informe emission_id ou internal_ref para consultar o status.");
      }

      const { data, error: updateError } = await supabase.functions.invoke("nfe-update-status", {
        body: {
          ...(input.emission_id ? { emission_id: input.emission_id } : {}),
          ...(input.internal_ref ? { internal_ref: input.internal_ref } : {}),
        },
      });

      if (updateError) throw updateError;

      if (!data?.success) {
        throw new Error(data?.error || "Falha ao consultar status da emissão");
      }

      return data;
    } catch (err: any) {
      console.error("[NFE] pollEmissionStatus erro:", err);
      const msg = err?.message || "Erro ao consultar status";
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const listNfes = useCallback(async (filters?: NFeFilter): Promise<NFeDocument[]> => {
    console.log("[NFE] 🔄 Iniciando listNfes");
    console.log("[NFE] 📋 Filters:", filters);

    setLoading(true);
    setError(null);

    try {
      const { data, error: listError } = await supabase.functions.invoke("nfe-list", {
        body: filters || {},
      });

      console.log("[NFE] 📦 Resposta nfe-list:", { data, error: listError });

      if (listError) throw listError;

      if (!data?.success) {
        throw new Error(data?.error || "Erro ao listar NF-es");
      }

      return (data?.data || []) as NFeDocument[];
    } catch (err: any) {
      console.error("[NFE] 💥 Exception:", err);
      const errorMessage = err?.message || "Erro ao listar NF-es";
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
    confirmAssistedManifestation,
    pollEmissionStatus,
    listNfes,
    clearError: () => setError(null),
  };
}

function sefazazCodeSafe(code: any): string {
  if (code === null || code === undefined) return "";
  return String(code);
}

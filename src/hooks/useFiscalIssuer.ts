// src/hooks/useFiscalIssuer.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type IssuerType = "CPF" | "CNPJ" | "MEI";

export type IssuerStatus =
  | "pending"
  | "document_validated"
  | "certificate_pending"
  | "certificate_uploaded"
  | "sefaz_validated"
  | "active"
  | "blocked";

export interface FiscalIssuer {
  id: string;

  // ✅ no seu banco: fiscal_issuers.perfil_id
  perfil_id: string;

  document_type?: string;
  document_number?: string;
  legal_name?: string;
  trade_name?: string;

  city?: string;
  uf?: string;

  fiscal_environment?: string;

  // pode vir em formatos diferentes (ex: CERTIFICATE_UPLOADED)
  status: string;

  created_at: string;
  updated_at: string;

  terms_accepted_at?: string;

  // opcionais
  status_reason?: string;
  sefaz_status?: string;
  sefaz_validated_at?: string;
  sefaz_validation_response?: any;
  onboarding_step?: number;
  onboarding_completed?: boolean;
  onboarding_completed_at?: string;
  activated_at?: string;
  blocked_at?: string;
  blocked_by?: string;
  block_reason?: string;
}

export interface FiscalCertificate {
  id: string;
  issuer_id: string;
  certificate_type: "A1" | "A3";

  subject_cn?: string;
  issuer_cn?: string;
  serial_number?: string;

  valid_from?: string;
  valid_until?: string;

  // ✅ schema da edge function
  is_valid?: boolean;
  is_expired?: boolean;
  status?: string;

  storage_path?: string;
  uploaded_at?: string;
  created_at: string;
}

export interface FiscalWallet {
  id: string;
  profile_id: string;
  issuer_id: string;
  available_balance: number;
  reserved_balance: number;
  total_credited: number;
  total_debited: number;
  emissions_count: number;
  last_emission_at?: string;
  last_credit_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RegisterIssuerData {
  issuer_type: IssuerType;
  cpf_cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  regime_tributario: string;
  cnae_principal?: string;
  endereco_logradouro?: string;
  endereco_numero?: string;
  endereco_complemento?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_uf?: string;
  endereco_cep?: string;
  endereco_ibge?: string;
  email_fiscal?: string;
  telefone_fiscal?: string;
}

// -----------------------------
// Helpers de erro (Supabase v2)
// -----------------------------
type FnErrorPayload =
  | { error?: string; message?: string; details?: any }
  | { [k: string]: any }
  | string
  | null
  | undefined;

function safeJsonParse(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function buildErrorText(payload: any, fallback: string) {
  if (!payload) return fallback;

  // payload string (às vezes vem como texto puro)
  if (typeof payload === "string") {
    const parsed = safeJsonParse(payload);
    if (parsed) return buildErrorText(parsed, fallback);
    return payload || fallback;
  }

  // payload objeto
  const main =
    (typeof payload.error === "string" && payload.error) ||
    (typeof payload.message === "string" && payload.message) ||
    fallback;

  // details pode ser string ou array/obj
  const details =
    typeof payload.details === "string"
      ? payload.details
      : Array.isArray(payload.details)
        ? payload.details.map((d: any) => d?.message || JSON.stringify(d)).join(" | ")
        : payload.details
          ? JSON.stringify(payload.details)
          : "";

  return details ? `${main} — ${details}` : main;
}

async function extractFunctionError(
  fnError: any,
  fallback: string,
): Promise<{ message: string; raw: any; status?: number }> {
  const status: number | undefined = fnError?.context?.status ?? fnError?.status ?? undefined;

  // 1) context.body (muito comum no supabase-js v2)
  const bodyFromContext = fnError?.context?.body as FnErrorPayload;
  if (bodyFromContext) {
    return {
      message: buildErrorText(bodyFromContext, fallback),
      raw: bodyFromContext,
      status,
    };
  }

  // 2) context.response (às vezes vem um Response)
  const maybeResponse = fnError?.context as any;
  if (maybeResponse && typeof maybeResponse === "object" && typeof (maybeResponse as Response).clone === "function") {
    try {
      const cloned = (maybeResponse as Response).clone();
      const text = await cloned.text();
      const parsed = safeJsonParse(text);
      return {
        message: buildErrorText(parsed ?? text, fallback),
        raw: parsed ?? text,
        status: (maybeResponse as Response).status ?? status,
      };
    } catch {
      // ignore
    }
  }

  // 3) message padrão do erro
  const msg = (fnError?.message && String(fnError.message)) || fallback;
  return { message: msg, raw: fnError, status };
}

export function useFiscalIssuer() {
  const [loading, setLoading] = useState<boolean>(false);
  const [issuer, setIssuer] = useState<FiscalIssuer | null>(null);
  const [certificate, setCertificate] = useState<FiscalCertificate | null>(null);
  const [wallet, setWallet] = useState<FiscalWallet | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * ✅ IMPORTANTE:
   * - usamos (supabase as any) para evitar TS2589 (inferência profunda)
   * - buscamos issuer por "perfil_id" (seu schema real)
   * - buscamos certificado preferindo is_valid=true
   */
  const fetchIssuer = useCallback(async (): Promise<FiscalIssuer | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        setIssuer(null);
        setCertificate(null);
        setWallet(null);
        return null;
      }

      const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();

      if (!profile?.id) {
        setIssuer(null);
        setCertificate(null);
        setWallet(null);
        return null;
      }

      // ✅ ISSUER: perfil_id (não profile_id)
      const issuerRes = await (supabase as any)
        .from("fiscal_issuers")
        .select(
          [
            "id",
            "perfil_id",
            "document_type",
            "documento_tipo",
            "document_number",
            "documento_numero",
            "legal_name",
            "legal_nome",
            "trade_name",
            "nome_fantasia",
            "city",
            "cidade",
            "uf",
            "fiscal_environment",
            "ambiente_fiscal",
            "status",
            "terms_accepted_at",
            "created_at",
            "updated_at",
          ].join(","),
        )
        .eq("perfil_id", profile.id)
        .maybeSingle();

      const issuerError = issuerRes?.error;
      if (issuerError && (issuerError as any)?.code !== "PGRST116") {
        throw issuerError;
      }

      const rawIssuer = issuerRes?.data as any;
      if (!rawIssuer) {
        setIssuer(null);
        setCertificate(null);
        setWallet(null);
        return null;
      }

      const issuerData: FiscalIssuer = {
        id: rawIssuer.id,
        perfil_id: rawIssuer.perfil_id,
        document_type: rawIssuer.document_type ?? rawIssuer.documento_tipo ?? undefined,
        document_number: rawIssuer.document_number ?? rawIssuer.documento_numero ?? undefined,
        legal_name: rawIssuer.legal_name ?? rawIssuer.legal_nome ?? undefined,
        trade_name: rawIssuer.trade_name ?? rawIssuer.nome_fantasia ?? undefined,
        city: rawIssuer.city ?? rawIssuer.cidade ?? undefined,
        uf: rawIssuer.uf ?? undefined,
        fiscal_environment: rawIssuer.fiscal_environment ?? rawIssuer.ambiente_fiscal ?? undefined,
        status: rawIssuer.status ?? "pending",
        terms_accepted_at: rawIssuer.terms_accepted_at ?? undefined,
        created_at: rawIssuer.created_at,
        updated_at: rawIssuer.updated_at,
      };

      setIssuer(issuerData);

      // ✅ CERTIFICADO: prioriza válido
      let cert: FiscalCertificate | null = null;

      const validCertRes = await (supabase as any)
        .from("fiscal_certificates")
        .select("*")
        .eq("issuer_id", issuerData.id)
        .eq("is_valid", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (validCertRes?.data) {
        cert = validCertRes.data as FiscalCertificate;
      } else {
        const lastCertRes = await (supabase as any)
          .from("fiscal_certificates")
          .select("*")
          .eq("issuer_id", issuerData.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        cert = (lastCertRes?.data as FiscalCertificate | null) ?? null;
      }

      setCertificate(cert);

      // ✅ WALLET
      const walletRes = await (supabase as any)
        .from("fiscal_wallet")
        .select("*")
        .eq("issuer_id", issuerData.id)
        .maybeSingle();

      setWallet((walletRes?.data as FiscalWallet | null) ?? null);

      return issuerData;
    } catch (err: any) {
      console.error("[FISCAL] fetchIssuer error:", err);
      setError(err?.message || "Erro ao buscar emissor fiscal");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const registerIssuer = useCallback(
    async (data: RegisterIssuerData): Promise<FiscalIssuer | null> => {
      setLoading(true);
      setError(null);

      try {
        const { data: result, error: fnError } = await supabase.functions.invoke("fiscal-issuer-register", {
          body: data,
        });

        if (fnError) {
          const extracted = await extractFunctionError(fnError, "Erro ao cadastrar emissor fiscal");
          console.error("[FISCAL] fiscal-issuer-register error:", extracted);
          throw new Error(extracted.message);
        }

        if ((result as any)?.error) throw new Error((result as any).error);

        toast.success("Emissor fiscal cadastrado com sucesso!");
        const refreshed = await fetchIssuer();
        return refreshed;
      } catch (err: any) {
        const message = err?.message || "Erro ao cadastrar emissor fiscal";
        setError(message);
        toast.error(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [fetchIssuer],
  );

  const updateIssuer = useCallback(
    async (updates: Partial<RegisterIssuerData>): Promise<boolean> => {
      if (!issuer) {
        toast.error("Nenhum emissor fiscal encontrado");
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const { error: updateError } = await (supabase as any)
          .from("fiscal_issuers")
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq("id", issuer.id);

        if (updateError) throw updateError;

        toast.success("Dados atualizados com sucesso");
        await fetchIssuer();
        return true;
      } catch (err: any) {
        const message = err?.message || "Erro ao atualizar dados";
        setError(message);
        toast.error(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [issuer, fetchIssuer],
  );

  // ✅ UPLOAD CERTIFICADO (agora mostrando o erro REAL)
  const uploadCertificate = useCallback(
    async (file: File, password: string): Promise<boolean> => {
      if (!issuer) {
        toast.error("Nenhum emissor fiscal encontrado");
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        // Convert file to base64 (sem prefixo data:)
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(",")[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
        });

        const { data: result, error: fnError } = await supabase.functions.invoke("fiscal-certificate-upload", {
          body: {
            issuer_id: issuer.id,
            certificate_base64: base64,
            certificate_password: password,
            file_name: file.name,
          },
        });

        if (fnError) {
          const extracted = await extractFunctionError(fnError, "Não foi possível enviar o certificado");
          console.error("[FISCAL] fiscal-certificate-upload error:", extracted);

          // Mostra no toast a mensagem real e, se for muito longa, coloca o resto no console
          const title = extracted.status
            ? `Erro (${extracted.status}) ao enviar certificado`
            : "Erro ao enviar certificado";
          toast.error(title, { description: extracted.message });

          setError(extracted.message);
          return false;
        }

        if ((result as any)?.error) {
          const msg = String((result as any)?.error);
          console.error("[FISCAL] fiscal-certificate-upload result.error:", result);
          toast.error("Erro ao enviar certificado", { description: msg });
          setError(msg);
          return false;
        }

        toast.success("Certificado digital enviado com sucesso!");
        await fetchIssuer();
        return true;
      } catch (err: any) {
        console.error("[FISCAL] uploadCertificate exception:", err);
        const message = err?.message || "Não foi possível enviar o certificado";
        setError(message);
        toast.error("Erro ao enviar certificado", { description: message });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [issuer, fetchIssuer],
  );

  const validateWithSefaz = useCallback(async (): Promise<boolean> => {
    if (!issuer) {
      toast.error("Nenhum emissor fiscal encontrado");
      return false;
    }

    if (!certificate) {
      toast.error("Certificado digital não encontrado");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("fiscal-sefaz-validation", {
        body: { issuer_id: issuer.id },
      });

      if (fnError) {
        const extracted = await extractFunctionError(fnError, "Erro na validação SEFAZ");
        console.error("[FISCAL] fiscal-sefaz-validation error:", extracted);
        toast.error("Erro na validação SEFAZ", { description: extracted.message });
        setError(extracted.message);
        return false;
      }

      if ((result as any)?.error) throw new Error((result as any).error);

      if ((result as any)?.success) {
        toast.success("Validação SEFAZ concluída com sucesso!");
        await fetchIssuer();
        return true;
      }

      throw new Error((result as any)?.message || "Falha na validação SEFAZ");
    } catch (err: any) {
      const message = err?.message || "Erro na validação SEFAZ";
      setError(message);
      toast.error("Erro na validação SEFAZ", { description: message });
      return false;
    } finally {
      setLoading(false);
    }
  }, [issuer, certificate, fetchIssuer]);

  const acceptTerms = useCallback(async (): Promise<boolean> => {
    if (!issuer) {
      toast.error("Nenhum emissor fiscal encontrado");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : null;

      const { error: acceptError } = await (supabase as any).from("fiscal_terms_acceptances").upsert({
        issuer_id: issuer.id,
        term_version: "2.0",
        accepted_at: new Date().toISOString(),
        ip_address: null,
        user_agent: userAgent,
        document_hash: "FISCAL_TERMS_V2_HASH",
      });

      if (acceptError) throw acceptError;

      const { error: updateError } = await (supabase as any)
        .from("fiscal_issuers")
        .update({
          terms_accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", issuer.id);

      if (updateError) throw updateError;

      toast.success("Termo de responsabilidade aceito");
      await fetchIssuer();
      return true;
    } catch (err: any) {
      const message = err?.message || "Erro ao aceitar termos";
      setError(message);
      toast.error("Erro ao aceitar termos", { description: message });
      return false;
    } finally {
      setLoading(false);
    }
  }, [issuer, fetchIssuer]);

  const getOnboardingProgress = useCallback(() => {
    if (!issuer) return { step: 0, total: 5, label: "Não iniciado", canEmit: false };

    const s = String(issuer.status || "").toUpperCase();

    if (s === "PENDING") return { step: 1, total: 5, label: "Cadastro pendente", canEmit: false };
    if (s === "DOCUMENT_VALIDATED") return { step: 2, total: 5, label: "Documentos validados", canEmit: false };
    if (s === "CERTIFICATE_PENDING") return { step: 2, total: 5, label: "Certificado pendente", canEmit: false };

    if (s === "CERTIFICATE_UPLOADED" || s === "CERTIFICATE-UPLOADED" || s === "CERTIFICATEUPLOADED") {
      return { step: 3, total: 5, label: "Certificado enviado", canEmit: false };
    }

    if (s === "SEFAZ_VALIDATED") return { step: 4, total: 5, label: "Validado pela SEFAZ", canEmit: false };
    if (s === "ACTIVE") return { step: 5, total: 5, label: "Ativo", canEmit: true };
    if (s === "BLOCKED") return { step: 0, total: 5, label: "Bloqueado", canEmit: false };

    return { step: 0, total: 5, label: "Desconhecido", canEmit: false };
  }, [issuer]);

  const isCertificateValid = useCallback(() => {
    if (!certificate) return false;
    if (typeof certificate.is_valid === "boolean" && !certificate.is_valid) return false;
    if (!certificate.valid_until) return false;
    return new Date(certificate.valid_until) > new Date();
  }, [certificate]);

  const getCertificateDaysUntilExpiry = useCallback(() => {
    if (!certificate?.valid_until) return null;
    const now = new Date();
    const expiry = new Date(certificate.valid_until);
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [certificate]);

  useEffect(() => {
    fetchIssuer();
  }, [fetchIssuer]);

  return {
    loading,
    error,

    issuer,
    certificate,
    wallet,

    fetchIssuer,
    registerIssuer,
    updateIssuer,
    uploadCertificate,

    validateWithSefaz,
    acceptTerms,

    getOnboardingProgress,
    isCertificateValid,
    getCertificateDaysUntilExpiry,

    clearError: () => setError(null),
  };
}

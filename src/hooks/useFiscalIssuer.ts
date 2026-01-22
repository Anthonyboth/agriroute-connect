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

  // ✅ nesta base: fiscal_issuers.profile_id
  profile_id: string;

  document_type: string;
  document_number: string;
  legal_name: string;
  trade_name?: string;

  city: string;
  uf: string;

  fiscal_environment: string;

  // pode vir em formatos diferentes (ex: CERTIFICATE_UPLOADED)
  status: string;

  created_at: string;
  updated_at: string;

  // opcionais (depende do schema)
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
  terms_accepted_at?: string;
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

// 🔥 extrai erro real do supabase.functions.invoke (para não ficar genérico)
async function extractFunctionError(fnError: any): Promise<{ title: string; description?: string }> {
  let title = fnError?.message || "Erro ao executar função";
  let description: string | undefined;

  const ctx = fnError?.context;
  if (ctx && typeof ctx === "object" && typeof (ctx as Response).clone === "function") {
    try {
      const payload = await (ctx as Response).clone().json();
      if (payload?.error) title = String(payload.error);
      if (payload?.details) {
        description = typeof payload.details === "string" ? payload.details : JSON.stringify(payload.details);
      }
      if (payload?.version) {
        description = description ? `${description} | ${payload.version}` : String(payload.version);
      }
    } catch {
      // ignore
    }
  }

  return { title, description };
}

export function useFiscalIssuer() {
  const [loading, setLoading] = useState(false);
  const [issuer, setIssuer] = useState<FiscalIssuer | null>(null);
  const [certificate, setCertificate] = useState<FiscalCertificate | null>(null);
  const [wallet, setWallet] = useState<FiscalWallet | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * ✅ IMPORTANTE:
   * - usamos (supabase as any) para evitar TS2589 (inferência profunda do Supabase)
   * - buscamos issuer por "profile_id"
   * - buscamos certificado preferindo is_valid=true
   */
  const fetchIssuer = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user) {
        setIssuer(null);
        setCertificate(null);
        setWallet(null);
        return null;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profile?.id) {
        setIssuer(null);
        setCertificate(null);
        setWallet(null);
        return null;
      }

      // ✅ ISSUER por profile_id
      const issuerRes = await (supabase as any)
        .from("fiscal_issuers")
        .select("*")
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (issuerRes?.error && issuerRes.error?.code !== "PGRST116") throw issuerRes.error;

      const issuerData = (issuerRes?.data as FiscalIssuer | null) ?? null;

      if (!issuerData) {
        setIssuer(null);
        setCertificate(null);
        setWallet(null);
        return null;
      }

      setIssuer(issuerData);

      // ✅ CERTIFICADO: preferir válido
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
      console.error("[FISCAL] Error fetching issuer:", err);
      const msg = err?.message || "Erro ao buscar emissor fiscal";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Register issuer (Step2 usa isso)
  const registerIssuer = useCallback(
    async (data: RegisterIssuerData): Promise<FiscalIssuer | null> => {
      setLoading(true);
      setError(null);

      try {
        const { data: result, error: fnError } = await supabase.functions.invoke("fiscal-issuer-register", {
          body: data,
        });

        if (fnError) {
          const e = await extractFunctionError(fnError);
          throw new Error(e.description ? `${e.title} — ${e.description}` : e.title);
        }

        if ((result as any)?.error) throw new Error(String((result as any).error));

        toast.success("Emissor fiscal cadastrado com sucesso!");
        await fetchIssuer();

        return (result as any)?.issuer as FiscalIssuer;
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

  // ✅ Update issuer (mantém compatibilidade)
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

  // ✅ Upload certificate (Step4 usa isso)
  const uploadCertificate = useCallback(
    async (file: File, password: string): Promise<boolean> => {
      if (!issuer) {
        toast.error("Nenhum emissor fiscal encontrado");
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
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
          const e = await extractFunctionError(fnError);
          throw new Error(e.description ? `${e.title} — ${e.description}` : e.title);
        }

        if ((result as any)?.error) throw new Error(String((result as any).error));

        toast.success("Certificado digital enviado com sucesso!");
        await fetchIssuer();
        return true;
      } catch (err: any) {
        const message = err?.message || "Erro ao enviar certificado";
        setError(message);
        toast.error(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [issuer, fetchIssuer],
  );

  // ✅ SEFAZ validation (Step4/5 pode usar)
  const validateWithSefaz = useCallback(async (): Promise<boolean> => {
    if (!issuer) {
      toast.error("Nenhum emissor fiscal encontrado");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("fiscal-sefaz-validation", {
        body: { issuer_id: issuer.id },
      });

      if (fnError) {
        const e = await extractFunctionError(fnError);
        throw new Error(e.description ? `${e.title} — ${e.description}` : e.title);
      }
      if ((result as any)?.error) throw new Error(String((result as any).error));

      if ((result as any)?.success) {
        toast.success("Validação SEFAZ concluída com sucesso!");
        await fetchIssuer();
        return true;
      }

      throw new Error(String((result as any)?.message || "Falha na validação SEFAZ"));
    } catch (err: any) {
      const message = err?.message || "Erro na validação SEFAZ";
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [issuer, fetchIssuer]);

  // ✅ Accept fiscal terms (Step5 usa isso)
  const acceptTerms = useCallback(async (): Promise<boolean> => {
    if (!issuer) {
      toast.error("Nenhum emissor fiscal encontrado");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: acceptError } = await (supabase as any).from("fiscal_terms_acceptances").upsert({
        issuer_id: issuer.id,
        term_version: "2.0",
        accepted_at: new Date().toISOString(),
        ip_address: null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
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
      toast.error(message);
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
    error: error || "",

    issuer: issuer as any,
    certificate: certificate as any,
    wallet: wallet as any,

    fetchIssuer,
    registerIssuer, // ✅ voltou
    updateIssuer, // ✅ voltou
    uploadCertificate,

    validateWithSefaz,
    acceptTerms,

    getOnboardingProgress,
    isCertificateValid,
    getCertificateDaysUntilExpiry,

    clearError: () => setError(null),
  };
}

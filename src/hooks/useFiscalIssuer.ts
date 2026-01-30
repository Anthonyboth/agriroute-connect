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
  profile_id: string;
  document_type: string;
  document_number: string;
  legal_name: string;
  trade_name?: string;
  city: string;
  uf: string;
  fiscal_environment: string;
  status: string;
  created_at: string;
  updated_at: string;
  status_reason?: string;
  sefaz_status?: string;
  sefaz_validated_at?: string;
  sefaz_validation_response?: unknown;
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
  // ✅ SECURITY: storage_path e password_hash removidos - não expostos ao cliente
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

/**
 * Extrai erro real do supabase.functions.invoke
 * Evita mostrar "erro genérico" - extrai detalhes do response
 */
async function extractFunctionError(fnError: unknown): Promise<{ title: string; description?: string; code?: string }> {
  let title = "Erro ao executar função";
  let description: string | undefined;
  let code: string | undefined;

  if (fnError && typeof fnError === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = fnError as any;
    
    if (typeof err.message === "string") {
      title = err.message;
    }

    // Tenta extrair do context (Response clone)
    const ctx = err.context;
    if (ctx && typeof ctx === "object" && typeof ctx.clone === "function") {
      try {
        const payload = await ctx.clone().json();
        if (payload?.error) title = String(payload.error);
        if (payload?.code) code = String(payload.code);
        if (payload?.details) {
          if (typeof payload.details === "string") {
            description = payload.details;
          } else if (typeof payload.details === "object" && payload.details.hint) {
            description = String(payload.details.hint);
          } else {
            description = JSON.stringify(payload.details);
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
  }

  return { title, description, code };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useFiscalIssuer() {
  const [loading, setLoading] = useState(false);
  const [issuer, setIssuer] = useState<FiscalIssuer | null>(null);
  const [certificate, setCertificate] = useState<FiscalCertificate | null>(null);
  const [wallet, setWallet] = useState<FiscalWallet | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Busca o emissor fiscal do usuário logado
   * Usa profile_id para vincular (não perfil_id)
   */
  const fetchIssuer = useCallback(async (): Promise<FiscalIssuer | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user) {
        console.log("[FISCAL] No authenticated user");
        setIssuer(null);
        setCertificate(null);
        setWallet(null);
        return null;
      }

      // Buscar profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profile?.id) {
        console.log("[FISCAL] Profile not found for user:", user.id);
        setIssuer(null);
        setCertificate(null);
        setWallet(null);
        return null;
      }

      console.log("[FISCAL] Fetching issuer for profile:", profile.id);

      // Buscar emissor por profile_id
      const issuerRes = await db
        .from("fiscal_issuers")
        .select("*")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (issuerRes?.error && issuerRes.error?.code !== "PGRST116") {
        throw issuerRes.error;
      }

      const issuerData = (issuerRes?.data as FiscalIssuer | null) ?? null;

      if (!issuerData) {
        console.log("[FISCAL] No issuer found for profile:", profile.id);
        setIssuer(null);
        setCertificate(null);
        setWallet(null);
        return null;
      }

      console.log("[FISCAL] Issuer found:", issuerData.id, "status:", issuerData.status);
      setIssuer(issuerData);

      // Buscar certificado (preferir válido)
      let cert: FiscalCertificate | null = null;

      const validCertRes = await db
        .from("fiscal_certificates")
        .select("*")
        .eq("issuer_id", issuerData.id)
        .eq("is_valid", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (validCertRes?.data) {
        cert = validCertRes.data as FiscalCertificate;
        console.log("[FISCAL] Valid certificate found:", cert.id);
      } else {
        // Fallback: buscar último certificado
        const lastCertRes = await db
          .from("fiscal_certificates")
          .select("*")
          .eq("issuer_id", issuerData.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        cert = (lastCertRes?.data as FiscalCertificate | null) ?? null;
        if (cert) {
          console.log("[FISCAL] Last certificate found:", cert.id, "is_valid:", cert.is_valid);
        }
      }

      setCertificate(cert);

      // Buscar wallet (se existir)
      const walletRes = await db
        .from("fiscal_wallet")
        .select("*")
        .eq("issuer_id", issuerData.id)
        .maybeSingle();

      setWallet((walletRes?.data as FiscalWallet | null) ?? null);

      return issuerData;
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errObj = err as any;
      console.error("[FISCAL] Error fetching issuer:", errObj);
      const msg = errObj?.message || "Erro ao buscar emissor fiscal";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Registrar novo emissor fiscal
   */
  const registerIssuer = useCallback(
    async (data: RegisterIssuerData): Promise<FiscalIssuer | null> => {
      setLoading(true);
      setError(null);

      try {
        console.log("[FISCAL] Registering issuer:", data.cpf_cnpj);

        const { data: result, error: fnError } = await supabase.functions.invoke("fiscal-issuer-register", {
          body: data,
        });

        if (fnError) {
          const e = await extractFunctionError(fnError);
          throw new Error(e.description ? `${e.title} — ${e.description}` : e.title);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resultObj = result as any;
        if (resultObj?.error) {
          throw new Error(String(resultObj.error));
        }

        toast.success("Emissor fiscal cadastrado com sucesso!");
        await fetchIssuer();

        return (resultObj?.issuer as FiscalIssuer) ?? null;
      } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errObj = err as any;
        const message = errObj?.message || "Erro ao cadastrar emissor fiscal";
        console.error("[FISCAL] Register error:", message);
        setError(message);
        toast.error(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [fetchIssuer]
  );

  /**
   * Atualizar dados do emissor
   */
  const updateIssuer = useCallback(
    async (updates: Partial<RegisterIssuerData>): Promise<boolean> => {
      if (!issuer) {
        toast.error("Nenhum emissor fiscal encontrado");
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        console.log("[FISCAL] Updating issuer:", issuer.id);

        const { error: updateError } = await db
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
      } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errObj = err as any;
        const message = errObj?.message || "Erro ao atualizar dados";
        console.error("[FISCAL] Update error:", message);
        setError(message);
        toast.error(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [issuer, fetchIssuer]
  );

  /**
   * Upload de certificado A1
   * Envia para edge function fiscal-certificate-upload
   */
  const uploadCertificate = useCallback(
    async (file: File, password: string): Promise<boolean> => {
      if (!issuer) {
        const msg = "Nenhum emissor fiscal encontrado. Complete o cadastro primeiro.";
        toast.error(msg);
        setError(msg);
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        console.log("[FISCAL] Uploading certificate for issuer:", issuer.id);

        // Convert file to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = () => reject(new Error("Erro ao ler arquivo do certificado"));
        });

        console.log("[FISCAL] Certificate base64 ready, size:", base64.length);

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
          console.error("[FISCAL] Upload function error:", e);
          
          // Mensagem específica para erros conhecidos
          let errorMessage = e.title;
          if (e.code === "ISSUER_NOT_FOUND") {
            errorMessage = "Emissor fiscal não encontrado. Verifique se o cadastro foi completado.";
          } else if (e.code === "FORBIDDEN") {
            errorMessage = "Você não tem permissão para este emissor.";
          } else if (e.description) {
            errorMessage = `${e.title} — ${e.description}`;
          }
          
          throw new Error(errorMessage);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resultObj = result as any;
        
        if (resultObj?.error) {
          throw new Error(String(resultObj.error));
        }

        // Check for warning (partial success)
        if (resultObj?.warning) {
          console.warn("[FISCAL] Upload warning:", resultObj.warning);
          toast.warning(String(resultObj.warning));
        } else {
          toast.success("Certificado digital enviado com sucesso!");
        }

        console.log("[FISCAL] Upload successful, refreshing issuer data");
        await fetchIssuer();
        return true;
      } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errObj = err as any;
        const message = errObj?.message || "Erro ao enviar certificado";
        console.error("[FISCAL] Upload error:", message);
        setError(message);
        toast.error(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [issuer, fetchIssuer]
  );

  /**
   * Validação SEFAZ
   */
  const validateWithSefaz = useCallback(async (): Promise<boolean> => {
    if (!issuer) {
      toast.error("Nenhum emissor fiscal encontrado");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("[FISCAL] Validating with SEFAZ for issuer:", issuer.id);

      const { data: result, error: fnError } = await supabase.functions.invoke("fiscal-sefaz-validation", {
        body: { issuer_id: issuer.id },
      });

      if (fnError) {
        const e = await extractFunctionError(fnError);
        throw new Error(e.description ? `${e.title} — ${e.description}` : e.title);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resultObj = result as any;
      
      if (resultObj?.error) {
        throw new Error(String(resultObj.error));
      }

      if (resultObj?.success) {
        toast.success("Validação SEFAZ concluída com sucesso!");
        await fetchIssuer();
        return true;
      }

      throw new Error(String(resultObj?.message || "Falha na validação SEFAZ"));
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errObj = err as any;
      const message = errObj?.message || "Erro na validação SEFAZ";
      console.error("[FISCAL] SEFAZ validation error:", message);
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [issuer, fetchIssuer]);

  /**
   * Aceitar termos fiscais
   */
  const acceptTerms = useCallback(async (): Promise<boolean> => {
    if (!issuer) {
      toast.error("Nenhum emissor fiscal encontrado");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("[FISCAL] Accepting terms for issuer:", issuer.id);

      // Get current user profile_id (required column)
      const { data: { user } } = await db.auth.getUser();
      if (!user) {
        throw new Error("Usuário não autenticado");
      }
      
      // Query the profile to get the profile_id
      const { data: profile, error: profileError } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (profileError || !profile) {
        throw new Error("Perfil não encontrado");
      }

      // Generate a simple hash for the term content (SHA-256 style representation)
      const termContent = `FISCAL_RESPONSIBILITY_TERM_V2_${issuer.id}`;
      const termHash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(termContent)
      ).then(buffer => 
        Array.from(new Uint8Array(buffer))
          .map(b => b.toString(16).padStart(2, "0"))
          .join("")
      );

      const { error: acceptError } = await db
        .from("fiscal_terms_acceptances")
        .upsert({
          profile_id: profile.id,
          issuer_id: issuer.id,
          term_type: "fiscal_responsibility",
          term_version: "2.0",
          term_hash: termHash,
          accepted_at: new Date().toISOString(),
          ip_address: null,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        }, {
          onConflict: "profile_id,term_type,term_version"
        });

      if (acceptError) throw acceptError;

      const { error: updateError } = await db
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
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errObj = err as any;
      const message = errObj?.message || "Erro ao aceitar termos";
      console.error("[FISCAL] Accept terms error:", message);
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [issuer, fetchIssuer]);

  /**
   * Retorna progresso do onboarding baseado no status do emissor
   */
  const getOnboardingProgress = useCallback(() => {
    if (!issuer) {
      return { step: 0, total: 5, label: "Não iniciado", canEmit: false };
    }

    // Normaliza o status para comparação (uppercase)
    const s = String(issuer.status || "").toUpperCase().replace(/-/g, "_");

    if (s === "PENDING") {
      return { step: 1, total: 5, label: "Cadastro pendente", canEmit: false };
    }
    if (s === "DOCUMENT_VALIDATED") {
      return { step: 2, total: 5, label: "Documentos validados", canEmit: false };
    }
    if (s === "CERTIFICATE_PENDING") {
      return { step: 2, total: 5, label: "Certificado pendente", canEmit: false };
    }
    if (s === "CERTIFICATE_UPLOADED") {
      return { step: 3, total: 5, label: "Certificado enviado", canEmit: false };
    }
    if (s === "SEFAZ_VALIDATED") {
      return { step: 4, total: 5, label: "Validado pela SEFAZ", canEmit: false };
    }
    if (s === "ACTIVE") {
      return { step: 5, total: 5, label: "Ativo", canEmit: true };
    }
    if (s === "BLOCKED") {
      return { step: 0, total: 5, label: "Bloqueado", canEmit: false };
    }

    return { step: 0, total: 5, label: "Desconhecido", canEmit: false };
  }, [issuer]);

  /**
   * Verifica se o certificado atual é válido
   */
  const isCertificateValid = useCallback((): boolean => {
    if (!certificate) return false;
    if (typeof certificate.is_valid === "boolean" && !certificate.is_valid) return false;
    if (!certificate.valid_until) return false;
    return new Date(certificate.valid_until) > new Date();
  }, [certificate]);

  /**
   * Retorna dias até expiração do certificado
   */
  const getCertificateDaysUntilExpiry = useCallback((): number | null => {
    if (!certificate?.valid_until) return null;
    const now = new Date();
    const expiry = new Date(certificate.valid_until);
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [certificate]);

  /**
   * Limpar erro
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Fetch issuer on mount
  useEffect(() => {
    fetchIssuer();
  }, [fetchIssuer]);

  return {
    loading,
    error: error || "",
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
    clearError,
  };
}

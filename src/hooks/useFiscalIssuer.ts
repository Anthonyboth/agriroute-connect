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

export type FiscalEnvironment = "homologacao" | "producao";

export interface FiscalIssuer {
  id: string;

  // ✅ BANCO (conforme seu print): fiscal_issuers.perfil_id
  perfil_id: string;

  document_type: string;
  document_number: string;
  legal_name: string;
  trade_name?: string;

  state_registration?: string;
  municipal_registration?: string;

  tax_regime: string;

  cnae_code?: string;
  cnae_description?: string;

  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  city: string;
  uf: string;
  address_zip_code?: string;
  city_ibge_code?: string;

  fiscal_environment: string;

  // ⚠️ seu banco pode estar usando outros valores (ex: CERTIFICATE_UPLOADED).
  // Aqui mantemos como string pra não quebrar e mapeamos no getOnboardingProgress.
  status: string;

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

  created_at: string;
  updated_at: string;
}

export interface FiscalCertificate {
  id: string;
  issuer_id: string;
  certificate_type: "A1" | "A3";

  subject_cn?: string;
  issuer_cn?: string;

  // ⚠️ no seu schema original você tinha "serial_número" etc.
  // Aqui deixo opcionais e em snake_case comum:
  serial_number?: string;

  valid_from?: string;
  valid_until?: string;

  // ✅ EDGE FUNCTION usa is_valid / is_expired / status
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

export function useFiscalIssuer() {
  const [loading, setLoading] = useState(false);
  const [issuer, setIssuer] = useState<FiscalIssuer | null>(null);
  const [certificate, setCertificate] = useState<FiscalCertificate | null>(null);
  const [wallet, setWallet] = useState<FiscalWallet | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * ✅ Fetch issuer + cert + wallet
   * - Corrige coluna: fiscal_issuers.perfil_id (não profile_id)
   * - Corrige seleção de certificado: prioriza is_valid=true
   * - Limpa states quando não encontra dados (para UI não ficar “presa”)
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

      // Perfil do usuário logado
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

      // ✅ ISSUER: usa "perfil_id"
      const { data: issuerData, error: issuerError } = await supabase
        .from("fiscal_issuers")
        .select("*")
        .eq("perfil_id", profile.id)
        .maybeSingle();

      if (issuerError && (issuerError as any)?.code !== "PGRST116") {
        throw issuerError;
      }

      if (!issuerData) {
        setIssuer(null);
        setCertificate(null);
        setWallet(null);
        return null;
      }

      setIssuer(issuerData as unknown as FiscalIssuer);

      // ✅ CERTIFICADO: prioriza o válido (is_valid = true), senão pega o último
      // (porque sua edge function "revoga" os anteriores setando is_valid=false)
      let cert: FiscalCertificate | null = null;

      // tenta pegar o válido
      const { data: validCert, error: validCertError } = await supabase
        .from("fiscal_certificates")
        .select("*")
        .eq("issuer_id", issuerData.id)
        .eq("is_valid", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!validCertError && validCert) {
        cert = validCert as unknown as FiscalCertificate;
      } else {
        // fallback: pega o último de todos
        const { data: lastCert } = await supabase
          .from("fiscal_certificates")
          .select("*")
          .eq("issuer_id", issuerData.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        cert = (lastCert as unknown as FiscalCertificate) || null;
      }

      setCertificate(cert);

      // ✅ WALLET
      const { data: walletData } = await supabase
        .from("fiscal_wallet")
        .select("*")
        .eq("issuer_id", issuerData.id)
        .maybeSingle();

      setWallet((walletData as unknown as FiscalWallet) || null);

      return issuerData as unknown as FiscalIssuer;
    } catch (err: any) {
      console.error("[FISCAL] Error fetching issuer:", err);
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
          let message = fnError.message || "Erro ao cadastrar emissor fiscal";
          const maybeResponse = (fnError as any)?.context;

          if (
            maybeResponse &&
            typeof maybeResponse === "object" &&
            typeof (maybeResponse as Response).clone === "function"
          ) {
            try {
              const payload = await (maybeResponse as Response).clone().json();
              if (payload?.error && typeof payload.error === "string") {
                message = payload.error;
              }
            } catch {
              // ignore
            }
          }

          throw new Error(message);
        }

        if ((result as any)?.error) {
          throw new Error((result as any).error);
        }

        toast.success("Emissor fiscal cadastrado com sucesso!");
        await fetchIssuer();

        return (result as any).issuer as FiscalIssuer;
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
        const { error: updateError } = await supabase
          .from("fiscal_issuers")
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          } as any)
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
          // se vier payload com mensagem, tenta extrair
          const message = fnError.message || "Erro ao enviar certificado";
          throw new Error(message);
        }

        if ((result as any)?.error) {
          throw new Error((result as any).error);
        }

        toast.success("Certificado digital enviado com sucesso!");

        // ✅ garante refresh do issuer/certificado logo após upload
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

      if (fnError) throw fnError;

      if ((result as any)?.error) {
        throw new Error((result as any).error);
      }

      if ((result as any)?.success) {
        toast.success("Validação SEFAZ concluída com sucesso!");
        await fetchIssuer();
        return true;
      }

      throw new Error((result as any)?.message || "Falha na validação SEFAZ");
    } catch (err: any) {
      const message = err?.message || "Erro na validação SEFAZ";
      setError(message);
      toast.error(message);
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
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error("Usuário não autenticado");

      const { error: acceptError } = await supabase.from("fiscal_terms_acceptances").upsert({
        issuer_id: issuer.id,
        term_version: "2.0",
        accepted_at: new Date().toISOString(),
        ip_address: null,
        user_agent: navigator.userAgent,
        document_hash: "FISCAL_TERMS_V2_HASH",
      } as any);

      if (acceptError) throw acceptError;

      const { error: updateError } = await supabase
        .from("fiscal_issuers")
        .update({
          terms_accepted_at: new Date().toISOString(),
          status: issuer.status === "sefaz_validated" ? "active" : issuer.status,
          updated_at: new Date().toISOString(),
        } as any)
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
    if (!issuer) {
      return { step: 0, total: 5, label: "Não iniciado", canEmit: false };
    }

    // ✅ normaliza status (se vier CERTIFICATE_UPLOADED etc.)
    const s = String(issuer.status || "").toLowerCase();

    if (s === "pending") return { step: 1, total: 5, label: "Cadastro pendente", canEmit: false };
    if (s === "document_validated") return { step: 2, total: 5, label: "Documentos validados", canEmit: false };
    if (s === "certificate_pending") return { step: 2, total: 5, label: "Certificado pendente", canEmit: false };
    if (s === "certificate_uploaded" || s === "certificate_uploaded".toLowerCase() || s === "certificate_uploaded") {
      return { step: 3, total: 5, label: "Certificado enviado", canEmit: false };
    }
    if (s === "certificate_uploaded" || s === "certificate_uploaded".toLowerCase()) {
      return { step: 3, total: 5, label: "Certificado enviado", canEmit: false };
    }

    // ✅ cobre status da edge function: CERTIFICATE_UPLOADED
    if (s === "certificate_uploaded" || s === "certificate_uploaded".toLowerCase() || s === "certificate_uploaded") {
      return { step: 3, total: 5, label: "Certificado enviado", canEmit: false };
    }
    if (s === "certificate_uploaded" || s === "certificate_uploaded".toLowerCase()) {
      return { step: 3, total: 5, label: "Certificado enviado", canEmit: false };
    }
    if (s === "certificate_uploaded") {
      return { step: 3, total: 5, label: "Certificado enviado", canEmit: false };
    }
    if (s === "certificate_uploaded") {
      return { step: 3, total: 5, label: "Certificado enviado", canEmit: false };
    }
    if (s === "certificate_uploaded") {
      return { step: 3, total: 5, label: "Certificado enviado", canEmit: false };
    }

    if (s === "certificate_uploaded" || s === "certificate_uploaded".toLowerCase()) {
      return { step: 3, total: 5, label: "Certificado enviado", canEmit: false };
    }

    if (s === "certificate_uploaded") return { step: 3, total: 5, label: "Certificado enviado", canEmit: false };
    if (s === "certificate_uploaded") return { step: 3, total: 5, label: "Certificado enviado", canEmit: false };

    if (s === "certificate_uploaded") return { step: 3, total: 5, label: "Certificado enviado", canEmit: false };

    if (s === "certificate_uploaded") return { step: 3, total: 5, label: "Certificado enviado", canEmit: false };

    if (s === "sefaz_validated") return { step: 4, total: 5, label: "Validado pela SEFAZ", canEmit: false };
    if (s === "active") return { step: 5, total: 5, label: "Ativo", canEmit: true };
    if (s === "blocked") return { step: 0, total: 5, label: "Bloqueado", canEmit: false };

    // fallback
    return { step: 0, total: 5, label: "Desconhecido", canEmit: false };
  }, [issuer]);

  const isCertificateValid = useCallback((): boolean => {
    if (!certificate) return false;

    // ✅ se existir is_valid, respeita
    if (typeof certificate.is_valid === "boolean") {
      if (!certificate.is_valid) return false;
    }

    if (!certificate.valid_until) return false;
    return new Date(certificate.valid_until) > new Date();
  }, [certificate]);

  const getCertificateDaysUntilExpiry = useCallback((): number | null => {
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

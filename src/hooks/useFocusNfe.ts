/**
 * Hook centralizado para comunicação com Focus NFe
 * 
 * Este hook é o elo entre o AgriRoute e a Focus NFe, gerenciando:
 * - Status do emissor fiscal e certificado
 * - Cadastro/atualização de empresa na Focus NFe
 * - Emissão de NF-e, CT-e e MDF-e
 * - Tratamento de erros e retry automático
 * 
 * @example
 * const { 
 *   status, 
 *   isReady, 
 *   emitirNfe, 
 *   checkCertificate 
 * } = useFocusNfe();
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSingleFlight } from "./utils";
import { useApiErrorReporter } from "./useApiErrorReporter";

// =============================================================================
// TYPES
// =============================================================================

export type FocusNfeStatus = 
  | "loading"           // Carregando dados iniciais
  | "not_configured"    // Emissor não cadastrado
  | "certificate_missing" // Certificado não enviado
  | "certificate_expired" // Certificado vencido
  | "pending_validation" // Aguardando validação SEFAZ
  | "focus_sync_pending" // Pendente sincronização com Focus
  | "ready"             // Pronto para emitir
  | "blocked"           // Emissor bloqueado
  | "error";            // Erro genérico

export interface FocusNfeIssuer {
  id: string;
  documentNumber: string;
  legalName: string;
  tradeName?: string;
  status: string;
  fiscalEnvironment: "homologation" | "production";
  focusCompanyId?: string;
  sefazValidated: boolean;
  isActive: boolean;
}

export interface FocusNfeCertificate {
  id: string;
  isValid: boolean;
  isExpired: boolean;
  validUntil?: string;
  daysUntilExpiry?: number;
  subjectCn?: string;
}

export interface FocusNfeWallet {
  availableBalance: number;
  reservedBalance: number;
  emissionsCount: number;
}

export interface FocusNfeState {
  status: FocusNfeStatus;
  issuer: FocusNfeIssuer | null;
  certificate: FocusNfeCertificate | null;
  wallet: FocusNfeWallet | null;
  errorMessage?: string;
}

export interface NfeEmissionInput {
  issuerId: string;
  freightId?: string;
  destinatario: {
    cnpjCpf: string;
    razaoSocial: string;
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
    valorUnitario: number;
  }>;
  valores: {
    total: number;
    frete?: number;
    desconto?: number;
  };
  informacoesAdicionais?: string;
}

export interface NfeEmissionResult {
  success: boolean;
  emissionId?: string;
  internalRef?: string;
  status?: string;
  accessKey?: string;
  danfeUrl?: string;
  xmlUrl?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface CertificateUploadInput {
  file: File;
  password: string;
  issuerId?: string;
}

export interface CertificateUploadResult {
  success: boolean;
  focusSynced: boolean;
  errorMessage?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function calculateDaysUntilExpiry(validUntil?: string): number | undefined {
  if (!validUntil) return undefined;
  
  const expiryDate = new Date(validUntil);
  const today = new Date();
  const diffTime = expiryDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

function determineStatus(
  issuer: FocusNfeIssuer | null,
  certificate: FocusNfeCertificate | null
): FocusNfeStatus {
  if (!issuer) return "not_configured";
  
  if (issuer.status === "blocked") return "blocked";
  
  if (!certificate) return "certificate_missing";
  
  if (certificate.isExpired) return "certificate_expired";
  
  if (!certificate.isValid) return "certificate_missing";
  
  if (!issuer.focusCompanyId) return "focus_sync_pending";
  
  if (!issuer.sefazValidated && issuer.status !== "active") return "pending_validation";
  
  if (issuer.isActive) return "ready";
  
  return "pending_validation";
}

async function extractErrorFromResponse(error: unknown): Promise<string> {
  if (!error || typeof error !== "object") {
    return "Erro desconhecido";
  }
  
  const err = error as Record<string, unknown>;
  
  // Try to extract from context (Response object)
  const ctx = err.context;
  if (ctx && typeof ctx === "object" && typeof (ctx as Response).clone === "function") {
    try {
      const payload = await (ctx as Response).clone().json();
      if (payload?.error) return String(payload.error);
      if (payload?.message) return String(payload.message);
      if (payload?.details) {
        // details às vezes é objeto (ex.: { hint, focus_error })
        return typeof payload.details === "string" ? payload.details : JSON.stringify(payload.details);
      }
    } catch {
      // Ignore parse errors
    }
  }
  
  if (typeof err.message === "string") {
    return err.message;
  }
  
  return "Erro ao processar requisição";
}

// =============================================================================
// HOOK
// =============================================================================

export function useFocusNfe() {
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<FocusNfeState>({
    status: "loading",
    issuer: null,
    certificate: null,
    wallet: null,
  });

  const { reportError } = useApiErrorReporter();
  const lastUploadErrorToastRef = useRef<string | null>(null);

  // =========================================================================
  // FETCH STATE - Carrega dados do emissor, certificado e carteira
  // =========================================================================
  const fetchState = useCallback(async (): Promise<FocusNfeState> => {
    console.log("[FOCUS-NFE] Fetching state...");
    
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      
      if (!user) {
        console.log("[FOCUS-NFE] No authenticated user");
        return {
          status: "not_configured",
          issuer: null,
          certificate: null,
          wallet: null,
        };
      }
      
      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      
      if (!profile) {
        console.log("[FOCUS-NFE] Profile not found");
        return {
          status: "not_configured",
          issuer: null,
          certificate: null,
          wallet: null,
        };
      }
      
      // Get issuer
      const { data: issuerData } = await supabase
        .from("fiscal_issuers")
        .select(`
          id,
          document_number,
          legal_name,
          trade_name,
          status,
          fiscal_environment,
          focus_company_id,
          sefaz_validated_at,
          activated_at
        `)
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!issuerData) {
        console.log("[FOCUS-NFE] No issuer found");
        return {
          status: "not_configured",
          issuer: null,
          certificate: null,
          wallet: null,
        };
      }
      
      const issuer: FocusNfeIssuer = {
        id: issuerData.id,
        documentNumber: issuerData.document_number,
        legalName: issuerData.legal_name,
        tradeName: issuerData.trade_name,
        status: issuerData.status,
        fiscalEnvironment: issuerData.fiscal_environment as "homologation" | "production",
        focusCompanyId: issuerData.focus_company_id,
        sefazValidated: !!issuerData.sefaz_validated_at,
        isActive: issuerData.status === "active",
      };
      
      console.log("[FOCUS-NFE] Issuer found:", issuer.id, "status:", issuer.status);
      
      // Get certificate
      const { data: certData } = await supabase
        .from("fiscal_certificates_secure")
        .select(`
          id,
          is_valid,
          is_expired,
          valid_until,
          subject_cn
        `)
        .eq("issuer_id", issuer.id)
        .eq("is_valid", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      let certificate: FocusNfeCertificate | null = null;
      
      if (certData) {
        const daysUntilExpiry = calculateDaysUntilExpiry(certData.valid_until);
        
        certificate = {
          id: certData.id,
          isValid: certData.is_valid ?? false,
          isExpired: certData.is_expired ?? false,
          validUntil: certData.valid_until,
          daysUntilExpiry,
          subjectCn: certData.subject_cn,
        };
        
        console.log("[FOCUS-NFE] Certificate found:", certificate.id, "valid:", certificate.isValid);
      }
      
      // Get wallet
      const { data: walletData } = await supabase
        .from("fiscal_wallet")
        .select(`
          available_balance,
          reserved_balance,
          emissions_count
        `)
        .eq("issuer_id", issuer.id)
        .maybeSingle();
      
      let wallet: FocusNfeWallet | null = null;
      
      if (walletData) {
        wallet = {
          availableBalance: walletData.available_balance ?? 0,
          reservedBalance: walletData.reserved_balance ?? 0,
          emissionsCount: walletData.emissions_count ?? 0,
        };
        
        console.log("[FOCUS-NFE] Wallet:", wallet.availableBalance, "credits available");
      }
      
      const status = determineStatus(issuer, certificate);
      
      console.log("[FOCUS-NFE] Final status:", status);
      
      return {
        status,
        issuer,
        certificate,
        wallet,
      };
      
    } catch (error) {
      console.error("[FOCUS-NFE] Error fetching state:", error);
      return {
        status: "error",
        issuer: null,
        certificate: null,
        wallet: null,
        errorMessage: await extractErrorFromResponse(error),
      };
    }
  }, []);

  // =========================================================================
  // REFRESH - Atualiza estado do hook
  // =========================================================================
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const newState = await fetchState();
      setState(newState);
    } finally {
      setLoading(false);
    }
  }, [fetchState]);

  // =========================================================================
  // CHECK CERTIFICATE - Verifica validade do certificado
  // =========================================================================
  const checkCertificate = useCallback(async (): Promise<{
    valid: boolean;
    daysUntilExpiry?: number;
    message?: string;
  }> => {
    const currentState = await fetchState();
    
    if (!currentState.certificate) {
      return { valid: false, message: "Certificado não encontrado" };
    }
    
    if (currentState.certificate.isExpired) {
      return { 
        valid: false, 
        daysUntilExpiry: currentState.certificate.daysUntilExpiry,
        message: "Certificado expirado" 
      };
    }
    
    if (!currentState.certificate.isValid) {
      return { valid: false, message: "Certificado inválido" };
    }
    
    const daysUntilExpiry = currentState.certificate.daysUntilExpiry;
    
    if (daysUntilExpiry !== undefined && daysUntilExpiry <= 30) {
      return {
        valid: true,
        daysUntilExpiry,
        message: `Certificado expira em ${daysUntilExpiry} dias`,
      };
    }
    
    return { valid: true, daysUntilExpiry };
  }, [fetchState]);

  // =========================================================================
  // UPLOAD CERTIFICATE - Envia certificado para Focus NFe
  // =========================================================================
  const uploadCertificateImpl = useCallback(async (
    input: CertificateUploadInput
  ): Promise<CertificateUploadResult> => {
    setLoading(true);
    
    try {
      console.log("[FOCUS-NFE] Uploading certificate...");
      
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(input.file);
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      });
      
      const { data, error } = await supabase.functions.invoke("fiscal-certificate-upload", {
        body: {
          issuer_id: input.issuerId,
          certificate_base64: base64,
          certificate_password: input.password,
          file_name: input.file.name,
        },
      });
      
      if (error) {
        const errorMessage = await extractErrorFromResponse(error);
        console.error("[FOCUS-NFE] Upload error:", errorMessage);

        // Evitar spam de toast do mesmo erro enquanto o usuário está tentando
        if (lastUploadErrorToastRef.current !== errorMessage) {
          toast.error(errorMessage);
          lastUploadErrorToastRef.current = errorMessage;
        }

        // Reportar para Telegram com contexto útil (sem vazar base64)
        await reportError(
          {
            integration: "focus_nfe",
            operation: "upload_certificate",
            context: {
              issuer_id: input.issuerId,
              file_name: input.file.name,
              file_size: input.file.size,
              file_type: input.file.type,
            },
          },
          error
        );
        return { success: false, focusSynced: false, errorMessage };
      }
      
      if (data?.error) {
        console.error("[FOCUS-NFE] Upload returned error:", data.error);

        if (lastUploadErrorToastRef.current !== data.error) {
          toast.error(data.error);
          lastUploadErrorToastRef.current = data.error;
        }

        await reportError(
          {
            integration: "focus_nfe",
            operation: "upload_certificate",
            context: {
              issuer_id: input.issuerId,
              file_name: input.file.name,
              file_size: input.file.size,
              focus_details: data?.details,
            },
          },
          data.error
        );
        return { success: false, focusSynced: false, errorMessage: data.error };
      }
      
      const focusSynced = data?.focus_synced ?? data?.success ?? false;
      
      if (focusSynced) {
        toast.success("Certificado enviado e sincronizado com Focus NFe!");
      } else if (data?.warning) {
        toast.warning(data.warning);
      } else {
        toast.success("Certificado enviado com sucesso!");
      }
      
      // Refresh state after upload
      await refresh();
      
      return { success: true, focusSynced };
      
    } catch (error) {
      const errorMessage = await extractErrorFromResponse(error);
      console.error("[FOCUS-NFE] Upload exception:", errorMessage);

      if (lastUploadErrorToastRef.current !== errorMessage) {
        toast.error(errorMessage);
        lastUploadErrorToastRef.current = errorMessage;
      }

      await reportError(
        {
          integration: "focus_nfe",
          operation: "upload_certificate",
          context: {
            issuer_id: input.issuerId,
            file_name: input.file.name,
            file_size: input.file.size,
          },
        },
        error
      );
      return { success: false, focusSynced: false, errorMessage };
    } finally {
      setLoading(false);
    }
  }, [refresh, reportError]);

  // Evita múltiplos envios simultâneos (double-click / re-render)
  const uploadCertificateSingleFlight = useSingleFlight(uploadCertificateImpl);
  const uploadCertificate = useCallback(async (
    input: CertificateUploadInput
  ): Promise<CertificateUploadResult> => {
    const result = await uploadCertificateSingleFlight(input);
    if (!result) {
      return {
        success: false,
        focusSynced: false,
        errorMessage: "Envio já em andamento. Aguarde a conclusão.",
      };
    }
    return result;
  }, [uploadCertificateSingleFlight]);

  // =========================================================================
  // EMITIR NFE - Emite NF-e via Focus NFe
  // =========================================================================
  const emitirNfe = useCallback(async (
    input: NfeEmissionInput
  ): Promise<NfeEmissionResult> => {
    setLoading(true);
    
    try {
      console.log("[FOCUS-NFE] Emitting NF-e...");
      
      // Pre-flight checks
      const currentState = await fetchState();
      
      if (currentState.status !== "ready") {
        const statusMessages: Record<FocusNfeStatus, string> = {
          loading: "Carregando...",
          not_configured: "Configure o emissor fiscal primeiro",
          certificate_missing: "Envie o certificado digital A1",
          certificate_expired: "Certificado expirado. Envie um novo certificado",
          pending_validation: "Aguardando validação SEFAZ",
          focus_sync_pending: "Sincronizando com Focus NFe...",
          ready: "",
          blocked: "Emissor fiscal bloqueado",
          error: "Erro ao verificar emissor fiscal",
        };
        
        const message = statusMessages[currentState.status] || "Emissor não está pronto para emissão";
        toast.error(message);
        return { success: false, errorMessage: message };
      }
      
      if (!currentState.wallet || currentState.wallet.availableBalance < 1) {
        const message = "Saldo insuficiente. Adquira mais créditos.";
        toast.error(message);
        return { success: false, errorCode: "INSUFFICIENT_BALANCE", errorMessage: message };
      }
      
      // Build payload for edge function
      const payload = {
        issuer_id: input.issuerId,
        freight_id: input.freightId,
        destinatario: {
          cnpj_cpf: input.destinatario.cnpjCpf,
          razao_social: input.destinatario.razaoSocial,
          ie: input.destinatario.ie,
          email: input.destinatario.email,
          telefone: input.destinatario.telefone,
          endereco: input.destinatario.endereco ? {
            logradouro: input.destinatario.endereco.logradouro,
            numero: input.destinatario.endereco.numero,
            bairro: input.destinatario.endereco.bairro,
            municipio: input.destinatario.endereco.municipio,
            uf: input.destinatario.endereco.uf,
            cep: input.destinatario.endereco.cep,
          } : undefined,
        },
        itens: input.itens.map(item => ({
          descricao: item.descricao,
          ncm: item.ncm,
          cfop: item.cfop,
          unidade: item.unidade,
          quantidade: item.quantidade,
          valor_unitario: item.valorUnitario,
        })),
        valores: {
          total: input.valores.total,
          frete: input.valores.frete,
          desconto: input.valores.desconto,
        },
        informacoes_adicionais: input.informacoesAdicionais,
      };
      
      const { data, error } = await supabase.functions.invoke("nfe-emitir", {
        body: payload,
      });
      
      if (error) {
        const errorMessage = await extractErrorFromResponse(error);
        console.error("[FOCUS-NFE] Emission error:", errorMessage);
        toast.error(errorMessage);
        return { success: false, errorMessage };
      }
      
      if (!data?.success) {
        const errorMessage = data?.message || data?.error || "Erro ao emitir NF-e";
        console.error("[FOCUS-NFE] Emission failed:", errorMessage);
        toast.error(errorMessage);
        return { 
          success: false, 
          errorCode: data?.code,
          errorMessage,
        };
      }
      
      // Success!
      const result: NfeEmissionResult = {
        success: true,
        emissionId: data.emission_id,
        internalRef: data.internal_ref,
        status: data.status,
        accessKey: data.access_key,
        danfeUrl: data.danfe_url,
        xmlUrl: data.xml_url,
      };
      
      if (data.status === "autorizado" || data.status === "authorized") {
        toast.success("NF-e autorizada com sucesso!");
      } else {
        toast.success("NF-e enviada para processamento");
      }
      
      // Refresh wallet balance
      await refresh();
      
      return result;
      
    } catch (error) {
      const errorMessage = await extractErrorFromResponse(error);
      console.error("[FOCUS-NFE] Emission exception:", errorMessage);
      toast.error(errorMessage);
      return { success: false, errorMessage };
    } finally {
      setLoading(false);
    }
  }, [fetchState, refresh]);

  // =========================================================================
  // POLL EMISSION STATUS - Consulta status da emissão
  // =========================================================================
  const pollEmissionStatus = useCallback(async (
    emissionId?: string,
    internalRef?: string
  ): Promise<{
    success: boolean;
    status?: string;
    accessKey?: string;
    danfeUrl?: string;
    xmlUrl?: string;
    errorMessage?: string;
  }> => {
    if (!emissionId && !internalRef) {
      return { success: false, errorMessage: "Informe emission_id ou internal_ref" };
    }
    
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("nfe-update-status", {
        body: {
          emission_id: emissionId,
          internal_ref: internalRef,
        },
      });
      
      if (error) {
        const errorMessage = await extractErrorFromResponse(error);
        return { success: false, errorMessage };
      }
      
      if (!data?.success) {
        return { success: false, errorMessage: data?.error || "Erro ao consultar status" };
      }
      
      return {
        success: true,
        status: data.status,
        accessKey: data.access_key,
        danfeUrl: data.danfe_url,
        xmlUrl: data.xml_url,
      };
      
    } catch (error) {
      const errorMessage = await extractErrorFromResponse(error);
      return { success: false, errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // =========================================================================
  // SYNC WITH FOCUS - Força sincronização com Focus NFe (re-upload cert)
  // =========================================================================
  const syncWithFocus = useCallback(async (): Promise<boolean> => {
    if (!state.issuer) {
      toast.error("Nenhum emissor fiscal encontrado");
      return false;
    }
    
    setLoading(true);
    
    try {
      console.log("[FOCUS-NFE] Triggering Focus sync...");
      
      const { data, error } = await supabase.functions.invoke("fiscal-sefaz-validation", {
        body: { issuer_id: state.issuer.id },
      });
      
      if (error) {
        const errorMessage = await extractErrorFromResponse(error);
        toast.error(errorMessage);
        return false;
      }
      
      if (data?.success) {
        toast.success("Sincronização com Focus NFe concluída!");
        await refresh();
        return true;
      }
      
      toast.error(data?.error || "Falha na sincronização");
      return false;
      
    } catch (error) {
      const errorMessage = await extractErrorFromResponse(error);
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [state.issuer, refresh]);

  // =========================================================================
  // COMPUTED VALUES
  // =========================================================================
  const isReady = useMemo(() => state.status === "ready", [state.status]);
  
  const hasBalance = useMemo(() => 
    (state.wallet?.availableBalance ?? 0) > 0, 
    [state.wallet]
  );
  
  const canEmit = useMemo(() => 
    isReady && hasBalance, 
    [isReady, hasBalance]
  );
  
  const statusMessage = useMemo(() => {
    const messages: Record<FocusNfeStatus, string> = {
      loading: "Carregando...",
      not_configured: "Configure seu emissor fiscal",
      certificate_missing: "Envie seu certificado digital A1",
      certificate_expired: "Certificado vencido. Envie um novo",
      pending_validation: "Aguardando validação na SEFAZ",
      focus_sync_pending: "Sincronizando com Focus NFe",
      ready: "Pronto para emitir",
      blocked: "Emissor bloqueado",
      error: state.errorMessage || "Erro",
    };
    return messages[state.status];
  }, [state.status, state.errorMessage]);

  // =========================================================================
  // INITIAL LOAD
  // =========================================================================
  useEffect(() => {
    refresh();
  }, [refresh]);

  // =========================================================================
  // RETURN
  // =========================================================================
  return {
    // State
    loading,
    status: state.status,
    issuer: state.issuer,
    certificate: state.certificate,
    wallet: state.wallet,
    errorMessage: state.errorMessage,
    
    // Computed
    isReady,
    hasBalance,
    canEmit,
    statusMessage,
    
    // Actions
    refresh,
    checkCertificate,
    uploadCertificate,
    emitirNfe,
    pollEmissionStatus,
    syncWithFocus,
  };
}

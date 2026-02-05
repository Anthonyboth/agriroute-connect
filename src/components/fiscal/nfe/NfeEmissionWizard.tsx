import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  ChevronRight,
  ChevronLeft,
  Check,
  Building2,
  Package,
  DollarSign,
  Send,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePrefilledUserData } from "@/hooks/usePrefilledUserData";
import { SefazErrorModal } from "./SefazErrorModal";
import { FiscalPreValidationModal } from "@/components/fiscal/FiscalPreValidationModal";
import { PixPaymentModal } from "@/components/fiscal/PixPaymentModal";
import { useFiscalPreValidation } from "@/hooks/useFiscalPreValidation";
import { usePixPayment } from "@/hooks/usePixPayment";
import { useFiscalDocumentCredits } from "@/hooks/useFiscalDocumentCredits";
import { AptidaoWizardStep0, StateGuideViewer } from "@/components/fiscal/education";

interface NfeEmissionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  fiscalIssuer: any;
  freightId?: string;
}

const STEPS = [
  { id: 1, title: "Destinatário", icon: Building2 },
  { id: 2, title: "Itens/Serviços", icon: Package },
  { id: 3, title: "Valores", icon: DollarSign },
  { id: 4, title: "Enviar", icon: Send },
];

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function isCpfCnpjValid(raw: string) {
  const d = onlyDigits(raw);
  return d.length === 11 || d.length === 14;
}

function normalizeUf(uf: string) {
  const v = (uf || "").trim().toUpperCase();
  return v.length === 2 ? v : "";
}

async function extractInvokeErrorBody(err: any): Promise<any | null> {
  const ctx = err?.context;

  // Prefer clone() para evitar "body already used" quando o client já leu o response.
  if (ctx && typeof ctx.clone === "function") {
    try {
      return await ctx.clone().json();
    } catch {
      // ignore
    }
  }

  if (ctx && typeof ctx.json === "function") {
    try {
      return await ctx.json();
    } catch {
      // ignore
    }
  }

  // Fallback: supabase-js inclui o JSON no texto da mensagem
  const msg = err?.message;
  if (typeof msg === "string") {
    const start = msg.indexOf("{");
    const end = msg.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(msg.slice(start, end + 1));
      } catch {
        // ignore
      }
    }
  }

  return null;
}

export const NfeEmissionWizard: React.FC<NfeEmissionWizardProps> = ({ isOpen, onClose, fiscalIssuer, freightId }) => {
  const { fiscal: prefilledFiscal, loading: prefillLoading } = usePrefilledUserData();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasPrefilled, setHasPrefilled] = useState(false);
  const [freightRecipientLoading, setFreightRecipientLoading] = useState(false);
  
  // Estado do modal de erro SEFAZ
  const [sefazError, setSefazError] = useState<{ isOpen: boolean; message: string; response?: any }>({
    isOpen: false,
    message: '',
  });
  
  // ✅ PRÉ-VALIDAÇÃO FISCAL: Bloquear emissão se não estiver apto
  const [showPreValidationModal, setShowPreValidationModal] = useState(false);

  // ✅ ETAPA 0 OBRIGATÓRIA: Documento correto + aptidão (antes de cobrar/emitir)
  const [showAptidaoStep0, setShowAptidaoStep0] = useState(false);
  const [aptidaoStep0Completed, setAptidaoStep0Completed] = useState(false);
  const [showNfaGuide, setShowNfaGuide] = useState(false);

  const step0HasIE = !!fiscalIssuer?.inscricao_estadual;
  const step0HasCertificate = useMemo(() => {
    const validStatuses = [
      "certificate_uploaded",
      "active",
      "production_enabled",
      "homologation_enabled",
    ];
    const validSefazStatuses = ["validated", "production_enabled", "homologation_enabled"];

    return (
      validStatuses.includes(fiscalIssuer?.status || "") ||
      validSefazStatuses.includes(fiscalIssuer?.sefaz_status || "")
    );
  }, [fiscalIssuer?.status, fiscalIssuer?.sefaz_status]);

  // ✅ PAGAMENTO PIX: Estado do modal e ref do documento
  const [showPixModal, setShowPixModal] = useState(false);
  const [paymentDocumentRef, setPaymentDocumentRef] = useState<string>("");
  const [requiredAmountCentavos, setRequiredAmountCentavos] = useState<number | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  
  // Hook de pré-validação fiscal
  const { validate, canEmit, blockers, warnings } = useFiscalPreValidation({
    fiscalIssuer,
    documentType: 'NFE',
  });
  
  // Hook de pagamento PIX
  const { calculateFee } = usePixPayment();
  
  // Hook de créditos de documentos fiscais (anti-fraude)
  const { checkAvailableCredit } = useFiscalDocumentCredits();
  const [availableCredit, setAvailableCredit] = useState<{ hasCredit: boolean; remainingAttempts?: number } | null>(null);

  const [formData, setFormData] = useState({
    // Destinatário
    dest_cnpj_cpf: "",
    dest_razao_social: "",
    dest_ie: "",
    dest_email: "",
    dest_telefone: "",
    dest_logradouro: "",
    dest_numero: "",
    dest_bairro: "",
    dest_municipio: "",
    dest_uf: "",
    dest_cep: "",

    // Itens
    descricao: "",
    ncm: "",
    cfop: "5102",
    unidade: "UN",
    quantidade: "1",
    valor_unitario: "",

    // Valores
    valor_total: "",
    valor_frete: "0",
    valor_desconto: "0",
    informacoes_adicionais: "",
  });

  // ✅ Verificar crédito disponível quando modal abre
  useEffect(() => {
    if (!isOpen || !fiscalIssuer?.id) return;
    
    const checkCredit = async () => {
      const result = await checkAvailableCredit(fiscalIssuer.id, 'nfe');
      if (result.hasCredit && result.credit) {
        const remaining = result.credit.maxAttempts - result.credit.attempts;
        setAvailableCredit({ hasCredit: true, remainingAttempts: remaining });
        console.log('[NfeEmissionWizard] ✅ Crédito disponível:', remaining, 'tentativas restantes');
      } else {
        setAvailableCredit({ hasCredit: false });
      }
    };
    
    checkCredit();
  }, [isOpen, fiscalIssuer?.id, checkAvailableCredit]);

  // ✅ PREFILL DO DESTINATÁRIO: Buscar dados do produtor do frete (destinatário da NF-e)
  useEffect(() => {
    if (!isOpen || hasPrefilled) return;

    const fetchFreightRecipient = async () => {
      // Se temos freightId, buscar dados do produtor do frete
      if (freightId) {
        setFreightRecipientLoading(true);
        try {
          // Buscar frete com dados do produtor
          const { data: freight, error: freightError } = await supabase
            .from('freights')
            .select(`
              producer_id,
              origin_city,
              origin_state,
              origin_address,
              origin_neighborhood,
              origin_street,
              origin_number,
              origin_zip_code,
              destination_city,
              destination_state,
              destination_address,
              destination_neighborhood,
              destination_street,
              destination_number,
              destination_zip_code
            `)
            .eq('id', freightId)
            .single();

          if (freightError || !freight?.producer_id) {
            console.warn('[NfeEmissionWizard] Frete não encontrado ou sem produtor:', freightError);
            setFreightRecipientLoading(false);
            return;
          }

          // Buscar dados do produtor (destinatário)
          const { data: producer, error: producerError } = await supabase
            .from('profiles')
            .select('id, full_name, cpf_cnpj, document, phone, contact_phone')
            .eq('id', freight.producer_id)
            .single();

          if (producerError || !producer) {
            console.warn('[NfeEmissionWizard] Produtor não encontrado:', producerError);
            setFreightRecipientLoading(false);
            return;
          }

          // Email do produtor não é buscado via Admin API (requer SERVICE_ROLE_KEY)
          // O campo email é opcional na NF-e, então deixamos vazio se não disponível
          const producerEmail = '';

          // ✅ Extrair dados do destination_address quando campos específicos estão vazios
          // Formato esperado: "Rua Nome, Bairro, Cidade, UF" ou "Rua Nome, Cidade - UF"
          let logradouro = freight.destination_street || '';
          let bairro = freight.destination_neighborhood || '';
          let numero = freight.destination_number || '';
          
          // Parse do destination_address se campos específicos estão vazios
          if (freight.destination_address && (!logradouro || !bairro)) {
            const parts = freight.destination_address.split(',').map((p: string) => p.trim());
            if (parts.length >= 1 && !logradouro) logradouro = parts[0]; // Primeira parte = rua
            if (parts.length >= 2 && !bairro) bairro = parts[1]; // Segunda parte = bairro
          }

          console.log('[NfeEmissionWizard] Dados extraídos do frete:', {
            logradouro,
            bairro,
            numero,
            cidade: freight.destination_city,
            uf: freight.destination_state,
            cep: freight.destination_zip_code,
            full_address: freight.destination_address
          });

          // Preencher formulário com dados do produtor (destinatário)
          setFormData(prev => ({
            ...prev,
            dest_cnpj_cpf: prev.dest_cnpj_cpf || (producer.cpf_cnpj || producer.document || '').replace(/\D/g, ''),
            dest_razao_social: (prev.dest_razao_social || producer.full_name || '').toUpperCase(),
            dest_telefone: prev.dest_telefone || producer.phone || producer.contact_phone || '',
            dest_email: prev.dest_email || producerEmail,
            // Usar endereço de destino do frete (onde a carga vai)
            dest_logradouro: (prev.dest_logradouro || logradouro || '').toUpperCase(),
            dest_numero: prev.dest_numero || numero || 'S/N',
            dest_bairro: (prev.dest_bairro || bairro || 'CENTRO').toUpperCase(),
            dest_municipio: (prev.dest_municipio || freight.destination_city || '').toUpperCase(),
            dest_uf: (prev.dest_uf || freight.destination_state || '').toUpperCase(),
            dest_cep: prev.dest_cep || (freight.destination_zip_code || '').replace(/\D/g, ''),
          }));
          setHasPrefilled(true);
        } catch (err) {
          console.error('[NfeEmissionWizard] Erro ao buscar dados do frete:', err);
        } finally {
          setFreightRecipientLoading(false);
        }
        return;
      }

      // Fallback: usar dados fiscais do próprio usuário se não houver frete
      if (!prefillLoading && prefilledFiscal && (prefilledFiscal.cnpj_cpf || prefilledFiscal.razao_social)) {
        setFormData(prev => ({
          ...prev,
          dest_cnpj_cpf: prev.dest_cnpj_cpf || prefilledFiscal.cnpj_cpf,
          dest_razao_social: prev.dest_razao_social || prefilledFiscal.razao_social,
          dest_ie: prev.dest_ie || prefilledFiscal.inscricao_estadual || '',
          dest_email: prev.dest_email || prefilledFiscal.email,
          dest_telefone: prev.dest_telefone || prefilledFiscal.telefone,
          dest_logradouro: prev.dest_logradouro || prefilledFiscal.logradouro,
          dest_numero: prev.dest_numero || prefilledFiscal.numero,
          dest_bairro: prev.dest_bairro || prefilledFiscal.bairro,
          dest_municipio: prev.dest_municipio || prefilledFiscal.municipio,
          dest_uf: prev.dest_uf || prefilledFiscal.uf,
          dest_cep: prev.dest_cep || prefilledFiscal.cep,
        }));
        setHasPrefilled(true);
      }
    };

    fetchFreightRecipient();
  }, [isOpen, freightId, hasPrefilled, prefillLoading, prefilledFiscal]);

  // Reset ao abrir/fechar
  useEffect(() => {
    if (!isOpen) return;
    setCurrentStep(1);
    setIsSubmitting(false);
    setHasPrefilled(false); // Reset para permitir novo prefill
    setFreightRecipientLoading(false);

    // Etapa 0 (documento correto) deve ser reavaliada a cada abertura
    setShowAptidaoStep0(false);
    setAptidaoStep0Completed(false);
    setShowNfaGuide(false);
    setIsPaid(false);
  }, [isOpen]);

  // Campos que devem ser convertidos para CAIXA ALTA automaticamente
  const UPPERCASE_FIELDS = new Set([
    "dest_razao_social",
    "dest_logradouro",
    "dest_numero",
    "dest_bairro",
    "dest_municipio",
    "dest_uf",
    "unidade",
    "informacoes_adicionais",
  ]);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => {
      // ✅ Converter para CAIXA ALTA se o campo estiver na lista
      const processedValue = UPPERCASE_FIELDS.has(field) ? value.toUpperCase() : value;
      const next = { ...prev, [field]: processedValue };

      // Auto-calcular valor total
      if (field === "quantidade" || field === "valor_unitario") {
        const qty = parseFloat(field === "quantidade" ? value : next.quantidade) || 0;
        const unit = parseFloat(field === "valor_unitario" ? value : next.valor_unitario) || 0;
        next.valor_total = qty > 0 && unit > 0 ? (qty * unit).toFixed(2) : "";
      }
      return next;
    });
  };

  const ambienteLabel = useMemo(() => {
    // você tem "fiscal_environment" no backend; aqui o objeto parece usar "ambiente"
    const amb = fiscalIssuer?.ambiente || fiscalIssuer?.fiscal_environment;
    return amb === "producao" || amb === "production" ? "Produção" : "Homologação";
  }, [fiscalIssuer]);

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return (
          isCpfCnpjValid(formData.dest_cnpj_cpf) &&
          !!formData.dest_razao_social &&
          !!formData.dest_logradouro &&
          !!formData.dest_bairro &&
          !!formData.dest_municipio &&
          !!normalizeUf(formData.dest_uf) &&
          onlyDigits(formData.dest_cep || "").length === 8
        );
      case 2:
        return !!formData.descricao && !!formData.valor_unitario && parseFloat(formData.valor_unitario) > 0;
      case 3:
        return !!formData.valor_total && parseFloat(formData.valor_total) > 0;
      default:
        return true;
    }
  };

  // Polling simples: consulta nfe-update-status até final (authorized/rejected/canceled)
  const pollStatus = async (params: { emission_id?: string; internal_ref?: string }, accessToken: string) => {
    const timeoutMs = 90_000;
    const intervalMs = 6_000;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const { data, error } = await supabase.functions.invoke("nfe-update-status", {
        body: params,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) {
        // não aborta imediatamente; pode ser intermitente
        console.warn("[NFE] Poll error:", error);
      }

      const item = data?.results?.[0];
      const status = item?.status;

      if (status === "authorized") {
        toast.success("NF-e autorizada!", {
          description: "DANFE e XML disponíveis no painel.",
        });
        return { ok: true, status, item };
      }

      if (status === "rejected") {
        // Abrir modal de erro detalhado ao invés de só toast
        const errorMsg = item?.message || item?.error_message || "A SEFAZ rejeitou a nota.";
        setSefazError({ isOpen: true, message: errorMsg, response: item });
        return { ok: true, status, item };
      }

      if (status === "canceled") {
        toast("NF-e cancelada.");
        return { ok: true, status, item };
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }

    toast("NF-e em processamento", {
      description: "Você pode fechar. O status será atualizado automaticamente no painel.",
    });
    return { ok: true, status: "processing" };
  };

  // ✅ PRÉ-VALIDAÇÃO FISCAL: Verifica se o usuário pode emitir ANTES de cobrar
  const handlePreValidation = useCallback(() => {
    const result = validate();
    
    if (!result.canEmit) {
      console.log('[NFE] Pré-validação fiscal falhou:', result.blockedReasons);
      setShowPreValidationModal(true);
      return false;
    }
    
    return true;
  }, [validate]);

  // ✅ Função chamada quando pagamento é confirmado
  const handlePaymentConfirmed = useCallback(() => {
    console.log('[NFE] Pagamento confirmado, prosseguindo com emissão...');
    setIsPaid(true);
    setShowPixModal(false);
    // Continuar com a emissão após pagamento
    executeEmission();
  }, []);

  // ✅ Executa a emissão após validação e pagamento
  const executeEmission = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error("Sessão inválida", { description: "Faça login novamente." });
      return;
    }

    const doc = onlyDigits(formData.dest_cnpj_cpf);
    const cepDigits = onlyDigits(formData.dest_cep || "");
    const uf = normalizeUf(formData.dest_uf) || normalizeUf(fiscalIssuer?.uf) || "";

    setIsSubmitting(true);

    try {
      const payload = {
        issuer_id: fiscalIssuer.id,
        freight_id: freightId,
        destinatario: {
          cnpj_cpf: doc,
          razao_social: (formData.dest_razao_social || "").trim(),
          ie: (formData.dest_ie || "").trim(),
          email: (formData.dest_email || "").trim(),
          telefone: onlyDigits(formData.dest_telefone || ""),
          endereco: {
            logradouro: (formData.dest_logradouro || "").trim(),
            numero: (formData.dest_numero || "").trim(),
            bairro: (formData.dest_bairro || "").trim(),
            municipio: (formData.dest_municipio || "").trim(),
            uf,
            cep: cepDigits,
          },
        },
        itens: [
          {
            descricao: (formData.descricao || "").trim(),
            ncm: onlyDigits(formData.ncm || "") || undefined,
            cfop: onlyDigits(formData.cfop || "") || "5102",
            unidade: (formData.unidade || "UN").trim().toUpperCase(),
            quantidade: parseFloat(formData.quantidade),
            valor_unitario: parseFloat(formData.valor_unitario),
          },
        ],
        valores: {
          total: parseFloat(formData.valor_total),
          frete: parseFloat(formData.valor_frete) || 0,
          desconto: parseFloat(formData.valor_desconto) || 0,
        },
        informacoes_adicionais: (formData.informacoes_adicionais || "").trim(),
      };

      // ✅ CHAMADA: "nfe-emitir" + Authorization explícito
      const { data, error } = await supabase.functions.invoke("nfe-emitir", {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      // ✅ Tratamento robusto: erro pode vir em `error` OU em `data`
      if (error) {
        console.error("[NFE] invoke error:", error);

        const parsedBody = await extractInvokeErrorBody(error);
        const bodyMsg = parsedBody?.message || parsedBody?.error;
        const code = parsedBody?.code;

        // ✅ Tratamento especial para PAYMENT_REQUIRED
        if (code === "PAYMENT_REQUIRED") {
          console.log("[NFE] Pagamento obrigatório:", parsedBody);
          const docRef = parsedBody?.document_ref || `nfe_${Date.now()}`;
          setPaymentDocumentRef(docRef);
          setRequiredAmountCentavos(
            typeof parsedBody?.amount_centavos === "number" ? parsedBody.amount_centavos : null,
          );
          setShowPixModal(true);
          setIsSubmitting(false);
          return;
        }

        const msg = bodyMsg || error.message || "Erro ao chamar o servidor fiscal.";
        throw new Error(msg);
      }

      // ✅ Verifica se data indica erro
      if (!data?.success) {
        // ✅ Tratamento especial para PAYMENT_REQUIRED
        if (data?.code === 'PAYMENT_REQUIRED') {
          console.log('[NFE] Pagamento obrigatório (via data):', data);
          const docRef = data?.document_ref || `nfe_${Date.now()}`;
          setPaymentDocumentRef(docRef);
          setRequiredAmountCentavos(typeof data?.amount_centavos === 'number' ? data.amount_centavos : null);
          setShowPixModal(true);
          setIsSubmitting(false);
          return;
        }
        
        const errMsg = data?.message || data?.error || "Falha ao emitir NF-e.";
        console.warn("[NFE] Response não-sucesso:", data);
        throw new Error(errMsg);
      }

      const emission_id = data.emission_id;
      const internal_ref = data.internal_ref;

      // ✅ TRATAMENTO PARA CADA STATUS RETORNADO
      if (data.status === "authorized") {
        toast.success("✅ NF-e Autorizada!", {
          description: `Documento emitido com sucesso. Chave: ${data.chave?.slice(-8) || '...'}`,
          duration: 8000,
        });
        onClose();
        return;
      }

      if (data.status === "rejected") {
        // 🔥 ERRO CRÍTICO: Mostrar modal de erro SEFAZ em vez de fechar silenciosamente!
        const rejectMsg = data.message || data.error_message || data.mensagem_erro || "NF-e foi rejeitada pelo SEFAZ. Verifique os dados e tente novamente.";
        console.error('[NFE] ❌ NF-e REJEITADA:', rejectMsg);
        setSefazError({ isOpen: true, message: rejectMsg });
        
        // Atualizar crédito (foi liberado no backend)
        if (fiscalIssuer?.id) {
          const creditResult = await checkAvailableCredit(fiscalIssuer.id, 'nfe');
          if (creditResult.hasCredit && creditResult.credit) {
            const remaining = creditResult.credit.maxAttempts - creditResult.credit.attempts;
            setAvailableCredit({ hasCredit: true, remainingAttempts: remaining });
            toast.info(`💳 Crédito preservado: ${remaining} tentativa(s) restante(s) para corrigir e reenviar.`, { duration: 10000 });
          }
        }
        return; // NÃO fecha o modal - deixa usuário ver o erro
      }

      if (data.status === "canceled") {
        toast.warning("NF-e foi cancelada.");
        onClose();
        return;
      }

      // Status "processing" - mostra e faz polling
      toast.success("NF-e enviada!", {
        description: "Aguardando autorização da SEFAZ...",
      });

      // 🔥 Polling para sair do "Aguardando" eterno
      if (emission_id || internal_ref) {
        await pollStatus({ emission_id, internal_ref }, session.access_token);
      }

      onClose();
    } catch (err: any) {
      console.error("[NFE] Erro ao emitir:", err);
      const errorMsg = err?.message || "Erro desconhecido ao emitir NF-e.";
      
      // ✅ Atualizar estado de crédito após erro (crédito foi liberado no backend)
      if (fiscalIssuer?.id) {
        const creditResult = await checkAvailableCredit(fiscalIssuer.id, 'nfe');
        if (creditResult.hasCredit && creditResult.credit) {
          const remaining = creditResult.credit.maxAttempts - creditResult.credit.attempts;
          setAvailableCredit({ hasCredit: true, remainingAttempts: remaining });
          toast.info(`Crédito preservado: ${remaining} tentativa(s) restante(s)`);
        } else {
          setAvailableCredit({ hasCredit: false });
        }
      }
      
      // Verificar se é um erro SEFAZ (rejeição) para abrir o modal detalhado
      const lowerMsg = errorMsg.toLowerCase();
      const isSefazError = lowerMsg.includes('rejeição') ||
                           lowerMsg.includes('rejei') ||
                           lowerMsg.includes('sefaz') ||
                           lowerMsg.includes('ncm') ||
                           lowerMsg.includes('cfop') ||
                           lowerMsg.includes('ie ') ||
                           lowerMsg.includes('cnpj') ||
                           lowerMsg.includes('certificado') ||
                           lowerMsg.includes('habilitado') ||
                           lowerMsg.includes('emissor') ||
                           lowerMsg.includes('emitente');
      
      console.log('[NFE] Erro detectado:', { errorMsg, isSefazError });
      
      if (isSefazError) {
        setSefazError({ isOpen: true, message: errorMsg });
      } else {
        toast.error("Erro ao emitir NF-e", {
          description: errorMsg,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitAfterAptidaoStep0 = async () => {
    if (!fiscalIssuer?.id) {
      toast.error("Emissor fiscal não configurado");
      return;
    }

    const doc = onlyDigits(formData.dest_cnpj_cpf);
    if (!isCpfCnpjValid(doc)) {
      toast.error("CNPJ/CPF inválido", { description: "Informe 11 (CPF) ou 14 (CNPJ) dígitos." });
      setCurrentStep(1);
      return;
    }

    // ✅ Validação local do endereço do destinatário (NF-e exige endereço completo)
    const cepDigits = onlyDigits(formData.dest_cep || "");
    const uf = normalizeUf(formData.dest_uf) || normalizeUf(fiscalIssuer?.uf) || "";
    if (!formData.dest_logradouro.trim() || !formData.dest_bairro.trim() || !formData.dest_municipio.trim() || !uf || cepDigits.length !== 8) {
      toast.error("Endereço do destinatário incompleto", {
        description: "Preencha logradouro, bairro, município, UF e CEP (8 dígitos).",
      });
      setCurrentStep(1);
      return;
    }

    // ✅ PRÉ-VALIDAÇÃO FISCAL: ANTES de pagar ou emitir
    if (!handlePreValidation()) {
      return; // Modal de bloqueio será exibido
    }

    // ✅ Se já pagou, executar emissão diretamente
    if (isPaid) {
      await executeEmission();
      return;
    }

    // ✅ Verificar sessão antes de invocar
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error("Sessão inválida", { description: "Faça login novamente." });
      return;
    }

    // ✅ Calcular taxa para exibição
    const totalValue = parseFloat(formData.valor_total) || 0;
    const feeCentavos = calculateFee("nfe", totalValue);

    console.log(`[NFE] Taxa calculada: R$ ${(feeCentavos / 100).toFixed(2)} para NF-e de R$ ${totalValue.toFixed(2)}`);

    // ✅ Tentar emitir - o backend retornará PAYMENT_REQUIRED se não pago
    await executeEmission();
  };

  const handleSubmit = async () => {
    // ✅ Etapa 0 obrigatória: sempre orientar MEI/UF/perfil antes de emitir/pagar
    if (!aptidaoStep0Completed) {
      setShowAptidaoStep0(true);
      return;
    }

    await submitAfterAptidaoStep0();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            {freightRecipientLoading && (
              <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg text-sm text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando dados do destinatário...
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="dest_cnpj_cpf">CNPJ/CPF *</Label>
                <Input
                  id="dest_cnpj_cpf"
                  value={formData.dest_cnpj_cpf}
                  onChange={(e) => updateField("dest_cnpj_cpf", e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
                {formData.dest_cnpj_cpf && !isCpfCnpjValid(formData.dest_cnpj_cpf) && (
                  <p className="text-xs text-destructive mt-1">Informe 11 (CPF) ou 14 (CNPJ) dígitos.</p>
                )}
              </div>
              <div>
                <Label htmlFor="dest_razao_social">Razão Social *</Label>
                <Input
                  id="dest_razao_social"
                  value={formData.dest_razao_social}
                  onChange={(e) => updateField("dest_razao_social", e.target.value)}
                  placeholder="Nome / Razão Social"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="dest_ie">Inscrição Estadual</Label>
                <Input
                  id="dest_ie"
                  value={formData.dest_ie}
                  onChange={(e) => updateField("dest_ie", e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div>
                <Label htmlFor="dest_email">E-mail</Label>
                <Input
                  id="dest_email"
                  type="email"
                  value={formData.dest_email}
                  onChange={(e) => updateField("dest_email", e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <Label htmlFor="dest_logradouro">Logradouro</Label>
                <Input
                  id="dest_logradouro"
                  value={formData.dest_logradouro}
                  onChange={(e) => updateField("dest_logradouro", e.target.value)}
                  placeholder="Rua, Avenida..."
                />
              </div>
              <div>
                <Label htmlFor="dest_numero">Número</Label>
                <Input
                  id="dest_numero"
                  value={formData.dest_numero}
                  onChange={(e) => updateField("dest_numero", e.target.value)}
                  placeholder="123"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="dest_bairro">Bairro</Label>
                <Input
                  id="dest_bairro"
                  value={formData.dest_bairro}
                  onChange={(e) => updateField("dest_bairro", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dest_municipio">Município</Label>
                <Input
                  id="dest_municipio"
                  value={formData.dest_municipio}
                  onChange={(e) => updateField("dest_municipio", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dest_uf">UF</Label>
                <Input
                  id="dest_uf"
                  value={formData.dest_uf}
                  onChange={(e) => updateField("dest_uf", e.target.value.toUpperCase())}
                  maxLength={2}
                  placeholder={normalizeUf(fiscalIssuer?.uf) || "SP"}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="dest_cep">CEP *</Label>
                <Input
                  id="dest_cep"
                  value={formData.dest_cep}
                  onChange={(e) => updateField("dest_cep", e.target.value)}
                  placeholder="00000-000"
                />
                {formData.dest_cep && onlyDigits(formData.dest_cep).length !== 8 && (
                  <p className="text-xs text-destructive mt-1">CEP inválido (use 8 dígitos).</p>
                )}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="descricao">Descrição do Serviço/Produto *</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => updateField("descricao", e.target.value)}
                placeholder="Descreva o serviço/produto"
                rows={3}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="ncm">NCM (8 dígitos)</Label>
                <Input
                  id="ncm"
                  value={formData.ncm}
                  onChange={(e) => updateField("ncm", e.target.value)}
                  placeholder="00000000"
                  maxLength={8}
                />
                {formData.ncm && onlyDigits(formData.ncm).length > 0 && onlyDigits(formData.ncm).length !== 8 && (
                  <p className="text-xs text-destructive mt-1">NCM deve ter exatamente 8 dígitos.</p>
                )}
              </div>
              <div>
                <Label htmlFor="cfop">CFOP</Label>
                <Input
                  id="cfop"
                  value={formData.cfop}
                  onChange={(e) => updateField("cfop", e.target.value)}
                  placeholder="5102"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="unidade">Unidade</Label>
                <Input
                  id="unidade"
                  value={formData.unidade}
                  onChange={(e) => updateField("unidade", e.target.value.toUpperCase())}
                  placeholder="UN"
                />
              </div>
              <div>
                <Label htmlFor="quantidade">Quantidade</Label>
                <Input
                  id="quantidade"
                  type="number"
                  value={formData.quantidade}
                  onChange={(e) => updateField("quantidade", e.target.value)}
                  min="1"
                />
              </div>
              <div>
                <Label htmlFor="valor_unitario">Valor Unitário *</Label>
                <Input
                  id="valor_unitario"
                  type="number"
                  step="0.01"
                  value={formData.valor_unitario}
                  onChange={(e) => updateField("valor_unitario", e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-3xl font-bold text-primary">
                    R$ {parseFloat(formData.valor_total || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="valor_frete">Valor do Frete</Label>
                <Input
                  id="valor_frete"
                  type="number"
                  step="0.01"
                  value={formData.valor_frete}
                  onChange={(e) => updateField("valor_frete", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="valor_desconto">Desconto</Label>
                <Input
                  id="valor_desconto"
                  type="number"
                  step="0.01"
                  value={formData.valor_desconto}
                  onChange={(e) => updateField("valor_desconto", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="informacoes_adicionais">Informações Adicionais</Label>
              <Textarea
                id="informacoes_adicionais"
                value={formData.informacoes_adicionais}
                onChange={(e) => updateField("informacoes_adicionais", e.target.value)}
                placeholder="Observações que aparecerão na nota"
                rows={3}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Send className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Pronto para Enviar</h3>
              <p className="text-muted-foreground">Revise os dados abaixo antes de enviar para a SEFAZ</p>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Destinatário:</span>
                  <span className="font-medium">{formData.dest_razao_social}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CNPJ/CPF:</span>
                  <span className="font-mono">{formData.dest_cnpj_cpf}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Descrição:</span>
                  <span className="font-medium truncate max-w-[200px]">{formData.descricao}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Total:</span>
                  <span className="font-bold text-primary">
                    R$ {parseFloat(formData.valor_total || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* ✅ Informação sobre créditos disponíveis (pagamento anterior não consumido) */}
            {availableCredit?.hasCredit && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <div className="flex gap-3">
                  <Check className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-emerald-800 dark:text-emerald-200">
                      💳 Você possui crédito de emissão anterior
                    </p>
                    <p className="text-emerald-700 dark:text-emerald-300">
                      Sua última tentativa falhou, mas o pagamento foi preservado. 
                      Você pode emitir esta NF-e <strong>sem novo pagamento</strong>.
                    </p>
                    <p className="text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                      {availableCredit.remainingAttempts} tentativa(s) restante(s) com este crédito.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Ambiente: {ambienteLabel}</p>
                  <p className="text-amber-700 dark:text-amber-300">
                    {ambienteLabel === "Produção"
                      ? "Esta nota terá validade jurídica."
                      : "Esta é uma nota de teste, sem validade fiscal."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Emitir NF-e
          </DialogTitle>
          <DialogDescription>Siga os passos para emitir sua Nota Fiscal Eletrônica</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center transition-colors
                      ${
                        isCompleted
                          ? "bg-green-600 text-white"
                          : isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                      }
                    `}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs mt-1 ${isActive ? "font-medium" : "text-muted-foreground"}`}>
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${currentStep > step.id ? "bg-green-600" : "bg-muted"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="min-h-[300px]">{renderStepContent()}</div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => (currentStep > 1 ? setCurrentStep(currentStep - 1) : onClose())}
            disabled={isSubmitting}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {currentStep === 1 ? "Cancelar" : "Voltar"}
          </Button>

          {currentStep < 4 ? (
            <Button onClick={() => setCurrentStep(currentStep + 1)} disabled={!canProceed() || isSubmitting}>
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar para SEFAZ
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>

      {/* ✅ ETAPA 0: Documento correto + aptidão (antes de qualquer cobrança/emissão) */}
      <Dialog open={showAptidaoStep0} onOpenChange={(open) => setShowAptidaoStep0(open)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Documento correto + Aptidão</DialogTitle>
            <DialogDescription>
              Para evitar cobrança sem emissão, confirme seu perfil e veja o documento mais adequado.
            </DialogDescription>
          </DialogHeader>

          <AptidaoWizardStep0
            documentType="NFE"
            fiscalIssuer={fiscalIssuer}
            hasCertificate={step0HasCertificate}
            hasIE={step0HasIE}
            defaultUf={normalizeUf(fiscalIssuer?.uf) || "MT"}
            onCancel={() => setShowAptidaoStep0(false)}
            onUseAlternative={(alt) => {
              if (alt === "NFA") {
                setShowAptidaoStep0(false);
                setShowNfaGuide(true);
              }
            }}
            onContinue={async () => {
              setAptidaoStep0Completed(true);
              setShowAptidaoStep0(false);
              // Depois da etapa 0, seguimos com o fluxo normal (pré-validação, PIX, emissão)
              await submitAfterAptidaoStep0();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* ✅ Guia rápido NF-a (quando recomendado) */}
      <Dialog open={showNfaGuide} onOpenChange={(open) => setShowNfaGuide(open)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Como emitir NF-a (Nota Fiscal Avulsa)</DialogTitle>
            <DialogDescription>
              A NF-a geralmente é emitida diretamente no portal da SEFAZ do seu estado (fora do AgriRoute).
            </DialogDescription>
          </DialogHeader>

          <StateGuideViewer
            defaultUf={(normalizeUf(fiscalIssuer?.uf) || "MT") as any}
            filterDocType="NFA"
          />
        </DialogContent>
      </Dialog>

      {/* Modal de erro SEFAZ detalhado */}
      <SefazErrorModal
        isOpen={sefazError.isOpen}
        onClose={() => setSefazError({ isOpen: false, message: '' })}
        errorMessage={sefazError.message}
        originalResponse={sefazError.response}
      />
      
      {/* ✅ Modal de Pré-Validação Fiscal - ANTES de cobrar */}
      <FiscalPreValidationModal
        open={showPreValidationModal}
        onClose={() => setShowPreValidationModal(false)}
        documentType="NFE"
        blockers={blockers}
        warnings={warnings}
      />
      
      {/* ✅ Modal de Pagamento PIX - APÓS validação fiscal */}
      {showPixModal && fiscalIssuer?.id && (
        <PixPaymentModal
          open={showPixModal}
          onClose={() => setShowPixModal(false)}
          issuerId={fiscalIssuer.id}
          documentType="nfe"
          documentRef={paymentDocumentRef}
          amountCentavos={
            requiredAmountCentavos ?? calculateFee('nfe', parseFloat(formData.valor_total) || 0)
          }
          description={`Emissão de NF-e - ${formData.dest_razao_social || 'Documento fiscal'}`}
          freightId={freightId}
          onPaymentConfirmed={handlePaymentConfirmed}
          onPaymentFailed={(error) => {
            console.error('[NFE] Pagamento falhou:', error);
            toast.error('Pagamento não confirmado', { description: 'Tente novamente ou entre em contato com o suporte.' });
          }}
        />
      )}
    </Dialog>
  );
};

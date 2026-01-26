import React, { useEffect, useMemo, useState } from "react";
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

export const NfeEmissionWizard: React.FC<NfeEmissionWizardProps> = ({ isOpen, onClose, fiscalIssuer, freightId }) => {
  const { fiscal: prefilledFiscal, loading: prefillLoading } = usePrefilledUserData();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasPrefilled, setHasPrefilled] = useState(false);

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

  // ✅ PREFILL AUTOMÁTICO: Preencher dados do destinatário com dados fiscais do usuário
  useEffect(() => {
    if (!isOpen || prefillLoading || hasPrefilled || !prefilledFiscal) return;
    
    // Verificar se há dados para prefill
    if (prefilledFiscal.cnpj_cpf || prefilledFiscal.razao_social) {
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
  }, [isOpen, prefillLoading, prefilledFiscal, hasPrefilled]);

  // Reset ao abrir/fechar
  useEffect(() => {
    if (!isOpen) return;
    setCurrentStep(1);
    setIsSubmitting(false);
    setHasPrefilled(false); // Reset para permitir novo prefill
  }, [isOpen]);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };

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
        return isCpfCnpjValid(formData.dest_cnpj_cpf) && !!formData.dest_razao_social;
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
        toast.error("NF-e rejeitada", {
          description: item?.message || "A SEFAZ rejeitou a nota.",
        });
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

  const handleSubmit = async () => {
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

    // ✅ Verificar sessão antes de invocar
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error("Sessão inválida", { description: "Faça login novamente." });
      return;
    }

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
            uf: normalizeUf(formData.dest_uf) || normalizeUf(fiscalIssuer?.uf) || "",
            cep: onlyDigits(formData.dest_cep || ""),
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

      // ✅ CHAMADA CORRETA: "nfe-emitir" (não "nfe-emissao") + Authorization explícito
      const { data, error } = await supabase.functions.invoke("nfe-emitir", {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        // Mostra motivo real (e não "non-2xx")
        const msg = error.message || "Erro ao chamar o servidor fiscal.";
        throw new Error(msg);
      }

      if (!data?.success) {
        throw new Error(data?.message || data?.error || "Falha ao emitir NF-e.");
      }

      toast.success("NF-e enviada!", {
        description: data.status === "processing" ? "Aguardando autorização da SEFAZ..." : "Processada.",
      });

      // Se já veio autorizada/rejeitada, fecha. Se processando, faz polling.
      const emission_id = data.emission_id;
      const internal_ref = data.internal_ref;

      if (data.status === "authorized" || data.status === "rejected" || data.status === "canceled") {
        onClose();
        return;
      }

      // 🔥 Polling para sair do "Aguardando" eterno
      if (emission_id || internal_ref) {
        await pollStatus({ emission_id, internal_ref }, session.access_token);
      }

      onClose();
    } catch (err: any) {
      console.error("[NFE] Erro ao emitir:", err);
      toast.error("Erro ao emitir NF-e", {
        description: err?.message || "Tente novamente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
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
                <Label htmlFor="ncm">NCM</Label>
                <Input
                  id="ncm"
                  value={formData.ncm}
                  onChange={(e) => updateField("ncm", e.target.value)}
                  placeholder="00000000"
                />
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

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">Ambiente: {ambienteLabel}</p>
                  <p className="text-yellow-700 dark:text-yellow-300">
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
    </Dialog>
  );
};

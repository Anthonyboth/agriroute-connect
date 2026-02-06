/**
 * Modal de Pré-Validação Fiscal
 * 
 * Exibe bloqueadores fiscais que impedem a emissão de documentos
 * DEVE SER EXIBIDO ANTES DE QUALQUER COBRANÇA (PIX/taxa)
 * 
 * Regra crítica: Nenhuma emissão ou cobrança ocorre sem aptidão fiscal confirmada.
 */

import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  AlertCircle, 
  XCircle, 
  AlertTriangle, 
  HelpCircle, 
  FileKey,
  Building2,
  FileCheck,
  Truck,
  MessageCircle,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { EmissionBlocker } from '@/hooks/useFiscalEmissionReadiness';
import { Severity } from '@/lib/fiscal-requirements';

interface FiscalPreValidationModalProps {
  open: boolean;
  onClose: () => void;
  documentType: 'NFE' | 'CTE' | 'MDFE' | 'GTA';
  blockers: EmissionBlocker[];
  warnings?: EmissionBlocker[];
  onContactSupport?: () => void;
}

const DOCUMENT_LABELS: Record<string, string> = {
  NFE: 'NF-e (Nota Fiscal Eletrônica)',
  CTE: 'CT-e (Conhecimento de Transporte)',
  MDFE: 'MDF-e (Manifesto de Documentos Fiscais)',
  GTA: 'GT-A (Guia de Transporte Animal)',
};

const BLOCKER_ICONS: Record<string, React.ReactNode> = {
  'no-issuer': <Building2 className="h-5 w-5" />,
  'no-cnpj': <Building2 className="h-5 w-5" />,
  'incomplete-address': <Building2 className="h-5 w-5" />,
  'no-certificate': <FileKey className="h-5 w-5" />,
  'certificate-expired': <FileKey className="h-5 w-5" />,
  'no-ie-cte': <FileCheck className="h-5 w-5" />,
  'no-ie-nfe': <FileCheck className="h-5 w-5" />,
  'no-rntrc': <Truck className="h-5 w-5" />,
  'no-vehicle': <Truck className="h-5 w-5" />,
  'no-condutor': <Truck className="h-5 w-5" />,
  'pending-sefaz-validation': <FileCheck className="h-5 w-5" />,
  'sefaz-not-enabled': <FileCheck className="h-5 w-5" />,
};

const getSeverityIcon = (severity: Severity) => {
  switch (severity) {
    case 'blocker':
      return <XCircle className="h-5 w-5 text-destructive" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    default:
      return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
  }
};

const getSeverityBg = (severity: Severity) => {
  switch (severity) {
    case 'blocker':
      return 'bg-destructive/10 border-destructive/20';
    case 'warning':
      return 'bg-yellow-500/10 border-yellow-500/20';
    default:
      return 'bg-muted border-muted';
  }
};

export const FiscalPreValidationModal: React.FC<FiscalPreValidationModalProps> = ({
  open,
  onClose,
  documentType,
  blockers,
  warnings = [],
  onContactSupport,
}) => {
  const hasBlockers = blockers.length > 0;
  const documentLabel = DOCUMENT_LABELS[documentType] || documentType;
  const [showTips, setShowTips] = useState(false);

  const quickTips = useMemo(() => {
    const tips: string[] = [];
    const blockerIds = new Set(blockers.map((b) => b.id));

    if (blockerIds.has('no-cnpj')) {
      tips.push('Na aba "Emissor", preencha o CNPJ/CPF com 11 (CPF) ou 14 (CNPJ) dígitos.');
      tips.push('Se você colou com pontos e traços, tudo bem — confirme apenas se o campo foi salvo.');
    }

    if (blockerIds.has('incomplete-address')) {
      tips.push('Confirme se Logradouro, Número, Bairro, Cidade, UF e CEP estão preenchidos no emissor.');
      tips.push('No CEP, use 8 dígitos (ex.: 01001-000).');
    }

    // Dica geral para evitar dados desatualizados no modal
    if (blockers.length > 0) {
      tips.push('Depois de salvar, feche e abra novamente a emissão para recarregar os dados do emissor.');
    }

    return tips;
  }, [blockers]);

  // Links oficiais por estado (MT prioritário)
  const officialLinks = useMemo(() => {
    const links: { label: string; url: string }[] = [];
    
    // MT - Links específicos (Atualizado 06/02/2026 - SAC0055693)
    links.push({
      label: 'Credenciamento SEFAZ-MT (OFICIAL)',
      url: 'https://www5.sefaz.mt.gov.br/servicos?c=6346394&e=6398811',
    });
    links.push({
      label: 'Webservice SEFAZ-MT (verificar credenciamento)',
      url: 'https://www.sefaz.mt.gov.br/acesso/pages/login/login.xhtml',
    });
    links.push({
      label: 'Portal de Atendimento ao Contribuinte',
      url: 'https://www5.sefaz.mt.gov.br/portal-de-atendimento-ao-contribuinte',
    });
    links.push({
      label: 'SINTEGRA (Consulta IE)',
      url: 'http://www.sintegra.gov.br/',
    });
    
    return links;
  }, []);

  // Abrir WhatsApp do suporte
  const handleContactSupport = () => {
    if (onContactSupport) {
      onContactSupport();
    } else {
      // WhatsApp com número correto
      const message = encodeURIComponent(
        `🌱 *AgriRoute - Suporte Fiscal*\n\n` +
        `Olá! Preciso de ajuda com a emissão de ${documentLabel}.\n\n` +
        `*Pendências identificadas:*\n${blockers.map(b => `• ${b.title}`).join('\n')}\n\n` +
        `Por favor, me ajudem a regularizar minha situação fiscal.`
      );
      window.open(`https://wa.me/5566992734632?text=${message}`, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Você ainda não está habilitado para emitir {documentType}
          </DialogTitle>
          <DialogDescription>
            Existem pendências fiscais obrigatórias que precisam ser resolvidas <strong>antes</strong> de prosseguir.
            Siga as instruções abaixo para regularizar sua situação.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-4">
            {/* Mensagem principal de bloqueio */}
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm font-medium text-destructive">
                ⚠️ Você ainda não está habilitado pela SEFAZ para emitir este documento.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                O pagamento e a emissão só serão liberados após a resolução das pendências abaixo.
              </p>
            </div>
            {/* Bloqueadores (impedem emissão) */}
            {hasBlockers && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Pendências obrigatórias ({blockers.length})
                </h3>
                
                {blockers.map((blocker) => (
                  <div 
                    key={blocker.id}
                    className={`p-4 rounded-lg border ${getSeverityBg(blocker.severity)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {BLOCKER_ICONS[blocker.id] || getSeverityIcon(blocker.severity)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className="font-medium text-sm">
                          {blocker.title}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {blocker.description}
                        </p>
                        <div className="flex items-start gap-2 pt-2">
                          <HelpCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-primary font-medium">
                            {blocker.action}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Avisos (não impedem, mas alertam) */}
            {warnings.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Avisos ({warnings.length})
                </h3>
                
                {warnings.map((warning) => (
                  <div 
                    key={warning.id}
                    className={`p-3 rounded-lg border ${getSeverityBg(warning.severity)}`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{warning.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {warning.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Links Oficiais */}
            {officialLinks.length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-primary" />
                  Links Oficiais SEFAZ
                </h3>
                <div className="flex flex-wrap gap-2">
                  {officialLinks.map((link) => (
                    <Button
                      key={link.url}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => window.open(link.url, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      {link.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Informações adicionais */}
            <Collapsible open={showTips} onOpenChange={setShowTips}>
              <div className="p-4 bg-muted/50 rounded-lg border mt-4">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between text-left"
                    aria-expanded={showTips}
                  >
                    <span className="text-sm font-medium">O que fazer agora?</span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${showTips ? 'rotate-180' : ''}`}
                    />
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent className="pt-3">
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-primary">1.</span>
                      Resolva as pendências listadas acima
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-primary">2.</span>
                      Acesse a aba "Emissor" para completar seu cadastro fiscal
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-primary">3.</span>
                      Verifique seu credenciamento no portal da SEFAZ
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-primary">4.</span>
                      Após resolver, tente emitir novamente
                    </li>
                  </ul>

                  {quickTips.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm font-medium">Dicas rápidas</p>
                      <ul className="mt-2 text-sm text-muted-foreground space-y-2 list-disc pl-5">
                        {quickTips.map((tip) => (
                          <li key={tip}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
          <p className="text-xs text-muted-foreground text-center sm:text-left flex-1">
            Se você tiver dúvidas sobre sua situação fiscal, fale com nosso time antes de prosseguir.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleContactSupport}
              className="flex items-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Falar com Suporte
            </Button>
            <Button onClick={onClose}>
              Entendi
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

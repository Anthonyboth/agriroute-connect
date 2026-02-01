import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  XCircle,
  AlertTriangle,
  Info,
  Building2,
  User,
  Package,
  Calculator,
  Shield,
  Server,
  CheckCircle2,
  ExternalLink,
  Copy,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  SefazNfeError,
  parseSefazError,
  getGenericSefazError,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
} from '@/lib/sefaz-nfe-errors';

interface SefazErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorMessage: string;
  originalResponse?: any;
}

const CATEGORY_ICONS: Record<SefazNfeError['category'], React.ReactNode> = {
  emitente: <Building2 className="h-5 w-5" />,
  destinatario: <User className="h-5 w-5" />,
  produto: <Package className="h-5 w-5" />,
  fiscal: <Calculator className="h-5 w-5" />,
  certificado: <Shield className="h-5 w-5" />,
  sistema: <Server className="h-5 w-5" />,
};

const SEVERITY_CONFIG = {
  error: {
    icon: XCircle,
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
    iconColor: 'text-red-600 dark:text-red-400',
    titleColor: 'text-red-800 dark:text-red-200',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    titleColor: 'text-yellow-800 dark:text-yellow-200',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-600 dark:text-blue-400',
    titleColor: 'text-blue-800 dark:text-blue-200',
  },
};

export const SefazErrorModal: React.FC<SefazErrorModalProps> = ({
  isOpen,
  onClose,
  errorMessage,
  originalResponse,
}) => {
  // Analisar a mensagem de erro
  const parsedError = parseSefazError(errorMessage) || getGenericSefazError(errorMessage);
  const severityConfig = SEVERITY_CONFIG[parsedError.severity];
  const SeverityIcon = severityConfig.icon;

  const copyErrorDetails = () => {
    const details = `
Código: ${parsedError.code}
Título: ${parsedError.title}
Descrição: ${parsedError.description}
Causa: ${parsedError.cause}
Mensagem Original: ${errorMessage}
    `.trim();

    navigator.clipboard.writeText(details);
    toast.success('Detalhes copiados!', {
      description: 'Informações copiadas para a área de transferência.',
    });
  };

  const openSefazPortal = () => {
    // Abre portal SEFAZ baseado no tipo de erro
    const portalUrl = 'https://www.nfe.fazenda.gov.br/portal/principal.aspx';
    window.open(portalUrl, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertCircle className="h-6 w-6 text-destructive" />
            NF-e Rejeitada pela SEFAZ
          </DialogTitle>
          <DialogDescription>
            A SEFAZ retornou um erro ao processar sua nota fiscal. Veja abaixo os detalhes e como corrigir.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-4">
            {/* Card principal do erro */}
            <div
              className={`rounded-lg border-2 p-4 ${severityConfig.bgColor} ${severityConfig.borderColor}`}
            >
              <div className="flex items-start gap-3">
                <SeverityIcon className={`h-8 w-8 mt-0.5 flex-shrink-0 ${severityConfig.iconColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`text-lg font-semibold ${severityConfig.titleColor}`}>
                      {parsedError.title}
                    </h3>
                    {parsedError.code !== 'DESCONHECIDO' && (
                      <span className="px-2 py-0.5 text-xs font-mono bg-white/50 dark:bg-black/20 rounded-full border">
                        Código {parsedError.code}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {parsedError.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Categoria do erro */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Categoria:</span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${CATEGORY_COLORS[parsedError.category]}`}
              >
                {CATEGORY_ICONS[parsedError.category]}
                {CATEGORY_LABELS[parsedError.category]}
              </span>
            </div>

            {/* Causa do problema */}
            <Alert variant="default" className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
              <HelpCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 dark:text-amber-200">
                Por que isso aconteceu?
              </AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-300 mt-1">
                {parsedError.cause}
              </AlertDescription>
            </Alert>

            {/* Soluções */}
            <div className="space-y-3">
              <h4 className="text-base font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Como corrigir
              </h4>
              <div className="space-y-2 pl-2">
                {parsedError.solution.map((step, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="text-sm">{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mensagem original (colapsável) */}
            {errorMessage && (
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-2">
                  <span className="group-open:rotate-90 transition-transform">▶</span>
                  Ver mensagem técnica original
                </summary>
                <div className="mt-2 p-3 bg-muted rounded-lg">
                  <code className="text-xs font-mono break-all whitespace-pre-wrap">
                    {errorMessage}
                  </code>
                </div>
              </details>
            )}

            {/* Links úteis */}
            <div className="pt-2 border-t">
              <h5 className="text-sm font-medium text-muted-foreground mb-3">Links úteis</h5>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openSefazPortal}
                  className="text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Portal NF-e
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=BMPFMBoln2w=', '_blank')}
                  className="text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Status SEFAZ
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://www4.receita.fazenda.gov.br/simulador/PesquisarNCM.jsp', '_blank')}
                  className="text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Consultar NCM
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://www.sintegra.gov.br/', '_blank')}
                  className="text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  SINTEGRA
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer com ações */}
        <div className="flex items-center justify-between pt-4 border-t mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={copyErrorDetails}
            className="text-muted-foreground"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copiar detalhes
          </Button>
          <Button onClick={onClose}>
            Entendi, vou corrigir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

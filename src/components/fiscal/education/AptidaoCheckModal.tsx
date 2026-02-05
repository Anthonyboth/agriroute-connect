/**
 * Modal de Verificação de Aptidão Fiscal
 * 
 * Exibe o resultado da verificação de aptidão
 * ANTES de permitir PIX/emissão
 */

import React from 'react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  MessageCircle,
  ArrowRight,
  Info,
} from 'lucide-react';
import { 
  AptidaoCheckResult, 
  AptidaoIssue,
  getAptidaoStatusMessage,
} from '@/lib/fiscal-aptidao-checker';
import { SupportButton } from './SupportButton';
import { DocumentType } from '@/lib/fiscal-requirements';

interface AptidaoCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  result: AptidaoCheckResult;
  documentType: DocumentType;
  uf?: string;
}

export const AptidaoCheckModal: React.FC<AptidaoCheckModalProps> = ({
  isOpen,
  onClose,
  onContinue,
  result,
  documentType,
  uf = 'MT',
}) => {
  const canProceed = result.isApto;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {result.status === 'OK' && <CheckCircle className="h-5 w-5 text-green-600" />}
            {result.status === 'PENDENTE' && <AlertTriangle className="h-5 w-5 text-yellow-600" />}
            {result.status === 'BLOQUEADO' && <XCircle className="h-5 w-5 text-destructive" />}
            Verificação de Aptidão - {documentType}
          </DialogTitle>
          <DialogDescription>
            {getAptidaoStatusMessage(result)}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-4">
            {/* Bloqueadores */}
            {result.blockers.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-destructive flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  Pendências ({result.blockers.length})
                </h4>
                {result.blockers.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} variant="blocker" />
                ))}
              </div>
            )}

            {/* Avisos */}
            {result.warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Avisos ({result.warnings.length})
                </h4>
                {result.warnings.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} variant="warning" />
                ))}
              </div>
            )}

            {/* Sucesso */}
            {result.isApto && result.blockers.length === 0 && (
              <Alert className="border-green-500/30 bg-green-500/5">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle>Aptidão confirmada</AlertTitle>
                <AlertDescription>
                  Você pode prosseguir com a emissão de {documentType}.
                  {result.warnings.length > 0 && (
                    <span className="block mt-1 text-sm">
                      Verifique os avisos acima antes de continuar.
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Info sobre não cobrar se inapto */}
            {!result.isApto && (
              <Alert className="border-blue-500/30 bg-blue-500/5">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm">
                  <strong>Não se preocupe:</strong> Você só paga quando estiver apto. 
                  Resolva as pendências acima e tente novamente.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <SupportButton 
            variant="outline" 
            size="sm"
            context={{ 
              screen: 'Verificação de Aptidão',
              documentType,
              issuerUf: uf,
            }}
          />
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            
            {canProceed ? (
              <Button onClick={onContinue}>
                Continuar
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button disabled variant="secondary">
                <XCircle className="h-4 w-4 mr-1" />
                Resolva as pendências
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============= COMPONENTE AUXILIAR =============

const IssueCard: React.FC<{ 
  issue: AptidaoIssue; 
  variant: 'blocker' | 'warning';
}> = ({ issue, variant }) => {
  const borderClass = variant === 'blocker' 
    ? 'border-destructive/30 bg-destructive/5' 
    : 'border-yellow-500/30 bg-yellow-500/5';
  
  const iconClass = variant === 'blocker' ? 'text-destructive' : 'text-yellow-600';
  const Icon = variant === 'blocker' ? XCircle : AlertTriangle;

  return (
    <Card className={borderClass}>
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <Icon className={`h-4 w-4 ${iconClass} mt-0.5 flex-shrink-0`} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{issue.title}</p>
            <p className="text-xs text-muted-foreground">{issue.description}</p>
            {issue.action && (
              <p className={`text-xs mt-1 ${variant === 'blocker' ? 'text-destructive' : 'text-yellow-600 dark:text-yellow-400'}`}>
                ➤ {issue.action}
              </p>
            )}
            {issue.link && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2 mt-1"
                onClick={() => window.open(issue.link!.url, '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                {issue.link.label}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AptidaoCheckModal;

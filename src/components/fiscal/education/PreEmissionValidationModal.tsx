import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  ExternalLink,
  Info
} from 'lucide-react';
import { SupportButton } from './SupportButton';
import { 
  validateIssuerReadiness, 
  getValidationMessage,
  ValidationSummary,
  IssuerData
} from '@/lib/fiscal-validator';
import { DocumentType, getDocumentInfo } from '@/lib/fiscal-requirements';

interface PreEmissionValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  issuer: IssuerData | null;
  docType: DocumentType;
  uf: string;
}

export const PreEmissionValidationModal: React.FC<PreEmissionValidationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  issuer,
  docType,
  uf,
}) => {
  const validation = validateIssuerReadiness(issuer, docType, uf);
  const message = getValidationMessage(validation);
  const docInfo = getDocumentInfo(docType);

  const handleConfirm = () => {
    if (validation.canEmit) {
      onConfirm();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : message.type === 'warning' ? (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            Verificação Pré-Emissão: {docInfo.name}
          </DialogTitle>
          <DialogDescription>
            {message.message}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-4">
            {/* Bloqueios */}
            {validation.blockers.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  Requisitos não atendidos ({validation.blockers.length})
                </h4>
                {validation.blockers.map((item) => (
                  <Card key={item.id} className="border-red-500/30 bg-red-500/5">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                          {item.action && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              ➤ {item.action}
                            </p>
                          )}
                          {item.links && item.links.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {item.links.map((link, idx) => (
                                <Button
                                  key={idx}
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs px-2"
                                  onClick={() => window.open(link.url, '_blank')}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  {link.label}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Avisos */}
            {validation.warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Atenção ({validation.warnings.length})
                </h4>
                {validation.warnings.map((item) => (
                  <Card key={item.id} className="border-yellow-500/30 bg-yellow-500/5">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                          {item.action && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                              ➤ {item.action}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Itens OK */}
            {validation.oks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  Requisitos atendidos ({validation.oks.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {validation.oks.map((item) => (
                    <Badge 
                      key={item.id} 
                      variant="outline" 
                      className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {item.title}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Info */}
            {validation.canEmit && validation.warnings.length > 0 && (
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Você pode prosseguir com a emissão, mas recomendamos verificar os itens de atenção
                      para evitar possíveis rejeições pela SEFAZ.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <SupportButton 
            variant="outline" 
            size="sm"
            context={{ 
              screen: 'Validação Pré-Emissão',
              documentType: docType,
              issuerUf: uf,
            }}
          />
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            
            {validation.canEmit ? (
              <Button onClick={handleConfirm}>
                <CheckCircle className="h-4 w-4 mr-1" />
                {validation.warnings.length > 0 ? 'Estou ciente, continuar' : 'Continuar'}
              </Button>
            ) : (
              <Button disabled>
                <XCircle className="h-4 w-4 mr-1" />
                Corrija os requisitos
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PreEmissionValidationModal;

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  ExternalLink,
  Info,
  HelpCircle
} from 'lucide-react';
import { 
  DocumentType, 
  FiscalRequirement, 
  getDocumentRequirements,
  getUFRequirements,
  BRAZILIAN_UFS
} from '@/lib/fiscal-requirements';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StateChecklistProps {
  docType: DocumentType;
  uf: string;
  onUfChange?: (uf: string) => void;
  issuerData?: {
    hasCertificate?: boolean;
    hasIE?: boolean;
    hasFullAddress?: boolean;
    hasRntrc?: boolean;
    hasVehicle?: boolean;
    hasCondutor?: boolean;
  };
  showUfSelector?: boolean;
}

const SeverityIcon: React.FC<{ severity: string; status?: 'ok' | 'pending' | 'blocked' }> = ({ 
  severity, 
  status 
}) => {
  if (status === 'ok') {
    return <CheckCircle className="h-5 w-5 text-green-600" />;
  }
  if (status === 'blocked' || severity === 'blocker') {
    return <XCircle className="h-5 w-5 text-red-600" />;
  }
  if (severity === 'warning') {
    return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
  }
  return <Info className="h-5 w-5 text-blue-600" />;
};

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const config = {
    blocker: { label: 'Obrigatório', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    warning: { label: 'Atenção', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    info: { label: 'Informativo', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  };
  
  const { label, className } = config[severity as keyof typeof config] || config.info;
  
  return <Badge className={className}>{label}</Badge>;
};

export const StateChecklist: React.FC<StateChecklistProps> = ({
  docType,
  uf,
  onUfChange,
  issuerData,
  showUfSelector = true,
}) => {
  const requirements = getDocumentRequirements(uf, docType);
  const ufInfo = getUFRequirements(uf);

  const getItemStatus = (req: FiscalRequirement): 'ok' | 'pending' | 'blocked' => {
    if (!issuerData) return 'pending';
    
    switch (req.evidenceType) {
      case 'A1':
        return issuerData.hasCertificate ? 'ok' : (req.severity === 'blocker' ? 'blocked' : 'pending');
      case 'IE':
        return issuerData.hasIE ? 'ok' : (req.severity === 'blocker' ? 'blocked' : 'pending');
      case 'ENDERECO':
        return issuerData.hasFullAddress ? 'ok' : (req.severity === 'blocker' ? 'blocked' : 'pending');
      case 'RNTRC':
        return issuerData.hasRntrc ? 'ok' : (req.severity === 'blocker' ? 'blocked' : 'pending');
      case 'VEICULO':
        return issuerData.hasVehicle ? 'ok' : (req.severity === 'blocker' ? 'blocked' : 'pending');
      case 'CONDUTOR':
        return issuerData.hasCondutor ? 'ok' : (req.severity === 'blocker' ? 'blocked' : 'pending');
      default:
        return 'pending';
    }
  };

  const blockers = requirements.filter(r => r.severity === 'blocker');
  const warnings = requirements.filter(r => r.severity === 'warning');
  const infos = requirements.filter(r => r.severity === 'info');

  return (
    <div className="space-y-6">
      {showUfSelector && (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <label className="text-sm font-medium">Estado (UF):</label>
          <Select value={uf} onValueChange={onUfChange}>
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue placeholder="Selecione seu estado" />
            </SelectTrigger>
            <SelectContent>
              {BRAZILIAN_UFS.map(({ uf: ufCode, name }) => (
                <SelectItem key={ufCode} value={ufCode}>
                  {ufCode} - {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Avisos gerais do estado */}
      {ufInfo.generalNotes.length > 0 && (
        <Alert className="border-blue-500/30 bg-blue-500/5">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <strong>Informações para {ufInfo.ufName}:</strong>
            <ul className="mt-2 space-y-1">
              {ufInfo.generalNotes.map((note, idx) => (
                <li key={idx} className="text-sm">• {note}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Requisitos obrigatórios */}
      {blockers.length > 0 && (
        <Card className="border-red-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-400">
              <XCircle className="h-5 w-5" />
              Requisitos Obrigatórios ({blockers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="space-y-2">
              {blockers.map((req) => {
                const status = getItemStatus(req);
                return (
                  <AccordionItem key={req.id} value={req.id} className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <SeverityIcon severity={req.severity} status={status} />
                        <span className="font-medium">{req.title}</span>
                        {status === 'ok' && (
                          <Badge variant="outline" className="bg-green-100 text-green-700">OK</Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">{req.description}</p>
                        
                        {req.tips.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium mb-1">Dicas:</h5>
                            <ul className="text-sm space-y-1">
                              {req.tips.map((tip, idx) => (
                                <li key={idx} className="text-muted-foreground">• {tip}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {req.officialLinks.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {req.officialLinks.map((link, idx) => (
                              <Button 
                                key={idx} 
                                variant="outline" 
                                size="sm"
                                onClick={() => window.open(link.url, '_blank')}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                {link.label}
                              </Button>
                            ))}
                          </div>
                        )}
                        
                        {req.faq.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                              <HelpCircle className="h-4 w-4" />
                              Perguntas Frequentes
                            </h5>
                            {req.faq.map((item, idx) => (
                              <div key={idx} className="mb-2">
                                <p className="text-sm font-medium">{item.q}</p>
                                <p className="text-sm text-muted-foreground">{item.a}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Requisitos de atenção */}
      {warnings.length > 0 && (
        <Card className="border-yellow-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-5 w-5" />
              Atenção ({warnings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="space-y-2">
              {warnings.map((req) => {
                const status = getItemStatus(req);
                return (
                  <AccordionItem key={req.id} value={req.id} className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <SeverityIcon severity={req.severity} status={status} />
                        <span className="font-medium">{req.title}</span>
                        {status === 'ok' && (
                          <Badge variant="outline" className="bg-green-100 text-green-700">OK</Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">{req.description}</p>
                        
                        {req.tips.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium mb-1">Dicas:</h5>
                            <ul className="text-sm space-y-1">
                              {req.tips.map((tip, idx) => (
                                <li key={idx} className="text-muted-foreground">• {tip}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {req.officialLinks.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {req.officialLinks.map((link, idx) => (
                              <Button 
                                key={idx} 
                                variant="outline" 
                                size="sm"
                                onClick={() => window.open(link.url, '_blank')}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                {link.label}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Link do portal SEFAZ */}
      <div className="flex justify-center">
        <Button 
          variant="outline" 
          onClick={() => window.open(ufInfo.sefazPortal, '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Acessar Portal SEFAZ - {ufInfo.ufName}
        </Button>
      </div>
    </div>
  );
};

export default StateChecklist;

/**
 * Visualizador de Guia por Estado
 * 
 * Exibe o guia completo de credenciamento e documentos por UF
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ExternalLink,
  MapPin,
  FileText,
  CheckCircle,
  AlertTriangle,
  Info,
  MessageCircle,
  Building2,
} from 'lucide-react';
import { 
  StateGuide, 
  StateUF, 
  ALL_UFS, 
  getStateGuideOrDefault,
  hasCompleteGuide,
  DocumentType,
} from '@/data/fiscal/stateGuides';
import { SupportButton } from './SupportButton';

interface StateGuideViewerProps {
  defaultUf?: StateUF;
  filterDocType?: DocumentType;
  showCredentialing?: boolean;
}

export const StateGuideViewer: React.FC<StateGuideViewerProps> = ({
  defaultUf = 'MT',
  filterDocType,
  showCredentialing = true,
}) => {
  const [selectedUf, setSelectedUf] = useState<StateUF>(defaultUf);
  const guide = getStateGuideOrDefault(selectedUf);
  const isComplete = hasCompleteGuide(selectedUf);

  return (
    <div className="space-y-6">
      {/* Seletor de Estado */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5" />
            Guia por Estado
          </CardTitle>
          <CardDescription>
            Selecione seu estado para ver as regras e links específicos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={selectedUf} onValueChange={(v) => setSelectedUf(v as StateUF)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_UFS.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    <div className="flex items-center gap-2">
                      {uf}
                      {hasCompleteGuide(uf) && (
                        <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          Completo
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <span className="text-muted-foreground">
              {guide.displayName}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Aviso se não é guia completo */}
      {!isComplete && (
        <Alert className="border-warning/30 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle>Guia em construção</AlertTitle>
          <AlertDescription>
            O guia detalhado para {guide.displayName} está sendo elaborado.
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `https://www.google.com/search?q=${encodeURIComponent(`SEFAZ ${selectedUf} credenciamento NF-e portal de serviços`)}`,
                    "_blank",
                  )
                }
              >
                Buscar SEFAZ no Google
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("https://www.nfe.fazenda.gov.br/", "_blank")}
              >
                Portal Nacional NF-e
              </Button>
            </div>
            <div className="mt-3">
              Se preferir, fale com nosso suporte.
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Portais Oficiais */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" />
            Portais Oficiais - {guide.uf}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {guide.officialPortals.map((portal, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => window.open(portal.url, '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                {portal.title}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Credenciamento */}
      {showCredentialing && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle className="h-5 w-5" />
              {guide.credentialing.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {guide.credentialing.steps.map((step, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{step.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                    {step.links && step.links.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {step.links.map((link, linkIdx) => (
                          <Button
                            key={linkIdx}
                            variant="link"
                            size="sm"
                            className="h-auto p-0"
                            onClick={() => window.open(link.url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            {link.title}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notas por Documento */}
      {Object.keys(guide.documentNotes).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Documentos em {guide.uf}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {Object.entries(guide.documentNotes).map(([docType, note]) => {
                if (filterDocType && docType !== filterDocType) return null;
                if (!note) return null;
                
                return (
                  <AccordionItem key={docType} value={docType}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{docType}</Badge>
                        <span className="text-sm text-muted-foreground truncate">
                          {note.whoCan.substring(0, 50)}...
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        <div>
                          <h5 className="text-sm font-medium mb-1">Quem pode emitir:</h5>
                          <p className="text-sm text-muted-foreground">{note.whoCan}</p>
                        </div>
                        
                        {note.prerequisites.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium mb-1">Pré-requisitos:</h5>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {note.prerequisites.map((req, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <CheckCircle className="h-3 w-3 mt-1 text-green-600 flex-shrink-0" />
                                  {req}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {note.commonErrors.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium mb-1">Erros comuns:</h5>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {note.commonErrors.map((err, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <AlertTriangle className="h-3 w-3 mt-1 text-yellow-600 flex-shrink-0" />
                                  {err}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {note.tips && note.tips.length > 0 && (
                          <Alert className="border-blue-500/30 bg-blue-500/5">
                            <Info className="h-4 w-4 text-blue-600" />
                            <AlertDescription>
                              <ul className="space-y-1">
                                {note.tips.map((tip, idx) => (
                                  <li key={idx} className="text-sm">{tip}</li>
                                ))}
                              </ul>
                            </AlertDescription>
                          </Alert>
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

      {/* Notas especiais */}
      {guide.specialNotes && guide.specialNotes.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Observações - {guide.displayName}</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {guide.specialNotes.map((note, idx) => (
                <li key={idx} className="text-sm">{note}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
        <p className="text-xs text-muted-foreground text-center sm:text-left">
          As regras podem variar. Em caso de dúvida, consulte seu contador ou a SEFAZ/ANTT.
        </p>
        <SupportButton 
          context={{ 
            screen: 'Guia por Estado', 
            issuerUf: selectedUf,
          }} 
        />
      </div>
    </div>
  );
};

export default StateGuideViewer;

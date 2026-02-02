import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  GraduationCap, 
  FileText, 
  Truck, 
  ClipboardList, 
  PawPrint,
  Briefcase,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { DocumentGuideCard } from './DocumentGuideCard';
import { StateChecklist } from './StateChecklist';
import { SupportButton } from './SupportButton';
import { FiscalEducationWizard, hasCompletedFiscalWizard, resetFiscalWizard } from './FiscalEducationWizard';
import { 
  DocumentType, 
  ALL_DOCUMENT_TYPES,
  getDocumentInfo,
  BRAZILIAN_UFS
} from '@/lib/fiscal-requirements';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FiscalEducationHubProps {
  userRole?: string;
  defaultUf?: string;
  fiscalIssuer?: any;
}

export const FiscalEducationHub: React.FC<FiscalEducationHubProps> = ({
  userRole = 'PRODUTOR',
  defaultUf = 'MT',
  fiscalIssuer,
}) => {
  const [showWizard, setShowWizard] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('NFE');
  const [selectedUf, setSelectedUf] = useState(fiscalIssuer?.uf || defaultUf);
  const [activeTab, setActiveTab] = useState('documentos');

  const hasCompleted = hasCompletedFiscalWizard();

  // Filtrar documentos por role
  const getRelevantDocTypes = (): DocumentType[] => {
    switch (userRole) {
      case 'PRODUTOR':
        return ['NFE', 'GTA'];
      case 'MOTORISTA':
        return ['CTE', 'MDFE'];
      case 'PRESTADOR_SERVICOS':
        return ['NFE', 'NFSE'];
      case 'TRANSPORTADORA':
        return ['NFE', 'CTE', 'MDFE'];
      default:
        return ALL_DOCUMENT_TYPES;
    }
  };

  const relevantDocTypes = getRelevantDocTypes();

  const handleRestartWizard = () => {
    resetFiscalWizard();
    setShowWizard(true);
  };

  // Dados do emissor para checklist
  const issuerData = fiscalIssuer ? {
    hasCertificate: 
      fiscalIssuer.status === 'ACTIVE' || 
      fiscalIssuer.status === 'active' ||
      fiscalIssuer.status === 'certificate_uploaded' ||
      fiscalIssuer.sefaz_status === 'validated',
    hasIE: !!(fiscalIssuer.ie && fiscalIssuer.ie.trim().length > 0 && fiscalIssuer.ie !== 'ISENTO'),
    hasFullAddress: !!(
      fiscalIssuer.logradouro &&
      fiscalIssuer.numero &&
      fiscalIssuer.bairro &&
      fiscalIssuer.cidade &&
      fiscalIssuer.uf &&
      fiscalIssuer.cep
    ),
  } : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Guia Fiscal</h2>
            <p className="text-muted-foreground text-sm">
              Aprenda tudo o que você precisa saber antes de emitir documentos fiscais
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {hasCompleted ? (
            <Badge variant="outline" className="bg-green-100 text-green-700 gap-1">
              <CheckCircle className="h-3 w-3" />
              Guia completado
            </Badge>
          ) : (
            <Badge variant="secondary">Guia não iniciado</Badge>
          )}
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowWizard(true)}
          >
            <BookOpen className="h-4 w-4 mr-1" />
            {hasCompleted ? 'Rever Guia' : 'Iniciar Guia'}
          </Button>
        </div>
      </div>

      {/* Quick Start Banner */}
      {!hasCompleted && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="p-4 rounded-full bg-primary/20">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-lg font-semibold">Primeira vez emitindo documentos fiscais?</h3>
                <p className="text-muted-foreground">
                  Complete nosso guia passo a passo para entender todos os requisitos antes de começar.
                </p>
              </div>
              <Button onClick={() => setShowWizard(true)} size="lg">
                Iniciar Guia Educativo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3">
          <TabsTrigger value="documentos" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Documentos</span>
          </TabsTrigger>
          <TabsTrigger value="checklist" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Checklist</span>
          </TabsTrigger>
          <TabsTrigger value="links" className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Links Úteis</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Documentos */}
        <TabsContent value="documentos" className="space-y-6 mt-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Tipos de Documentos Fiscais</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Conheça cada tipo de documento e quando você precisa utilizá-lo.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {relevantDocTypes.map((docType) => (
              <div key={docType} onClick={() => setSelectedDocType(docType)}>
                <DocumentGuideCard
                  docType={docType}
                  isSelected={selectedDocType === docType}
                  onClick={() => setSelectedDocType(docType)}
                />
              </div>
            ))}
          </div>

          {/* Detalhes do documento selecionado */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhes: {getDocumentInfo(selectedDocType).name}</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentGuideCard docType={selectedDocType} showFullInfo />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Checklist */}
        <TabsContent value="checklist" className="space-y-6 mt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1">Checklist de Requisitos</h3>
              <p className="text-muted-foreground text-sm">
                Verifique se você atende a todos os requisitos para emitir documentos fiscais.
              </p>
            </div>
            
            <div className="flex gap-2">
              <Select value={selectedDocType} onValueChange={(v) => setSelectedDocType(v as DocumentType)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {relevantDocTypes.map((dt) => (
                    <SelectItem key={dt} value={dt}>
                      {getDocumentInfo(dt).name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <StateChecklist 
            docType={selectedDocType}
            uf={selectedUf}
            onUfChange={setSelectedUf}
            issuerData={issuerData}
            showUfSelector={true}
          />
        </TabsContent>

        {/* Tab: Links Úteis */}
        <TabsContent value="links" className="space-y-6 mt-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Links Úteis</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Acesse os portais oficiais para consultas e cadastros.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Receita Federal</CardTitle>
                <CardDescription>Consultas de CNPJ e CPF</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => window.open('https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/cnpjreva_solicitacao.asp', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Consultar CNPJ
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => window.open('https://servicos.receita.fazenda.gov.br/Servicos/CPF/ConsultaSituacao/ConsultaPublica.asp', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Consultar CPF
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">SINTEGRA</CardTitle>
                <CardDescription>Consulta de Inscrição Estadual</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => window.open('http://www.sintegra.gov.br/', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Consultar IE no SINTEGRA
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Portais NF-e</CardTitle>
                <CardDescription>Documentação e consultas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => window.open('https://www.nfe.fazenda.gov.br/', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Portal NF-e Nacional
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => window.open('https://www.cte.fazenda.gov.br/', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Portal CT-e Nacional
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Certificado Digital</CardTitle>
                <CardDescription>Certificadoras credenciadas</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => window.open('https://www.iti.gov.br/icp-brasil/estrutura', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Lista de Certificadoras
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">ANTT</CardTitle>
                <CardDescription>Transporte rodoviário de cargas</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => window.open('https://www.gov.br/antt', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Portal ANTT (RNTRC)
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Códigos e Tabelas</CardTitle>
                <CardDescription>CNAE, NCM e IBGE</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => window.open('https://cnae.ibge.gov.br/', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Consultar CNAE
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => window.open('https://www.ibge.gov.br/explica/codigos-dos-municipios.php', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Códigos IBGE Municípios
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer com Suporte */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="font-medium">Ficou com dúvidas?</h4>
              <p className="text-sm text-muted-foreground">
                Nossa equipe está pronta para ajudar você com qualquer questão fiscal.
              </p>
            </div>
            <SupportButton 
              context={{ 
                screen: 'Guia Fiscal',
                documentType: selectedDocType,
                issuerUf: selectedUf,
              }} 
            />
          </div>
        </CardContent>
      </Card>

      {/* Dialog do Wizard */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-3xl h-[90vh] p-0 overflow-hidden">
          <FiscalEducationWizard
            onComplete={() => setShowWizard(false)}
            onSkip={() => setShowWizard(false)}
            defaultUf={selectedUf}
            userRole={userRole}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FiscalEducationHub;

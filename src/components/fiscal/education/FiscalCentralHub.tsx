/**
 * Central Fiscal - "O que eu posso emitir?"
 * 
 * Tela principal que mostra:
 * 1. Meu Perfil Fiscal
 * 2. O que posso emitir (matriz por perfil)
 * 3. Guia rápido: o que falta
 * 
 * ⚠️ REGRA CORRETA: MEI geralmente emite NF-a (NFA) e não NF-e
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  FileText,
  ClipboardList,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  MessageCircle,
  Truck,
  Building2,
  Users,
  Wrench,
  Info,
  HelpCircle,
  ChevronRight,
} from 'lucide-react';
import { 
  FiscalProfileType, 
  PROFILE_ELIGIBILITY,
  getProfileEligibility,
  getStatusLabel,
  getStatusBadgeVariant,
  mapRoleToFiscalProfile,
  DocumentEligibility,
} from '@/lib/fiscal-eligibility-rules';
import { SupportButton } from './SupportButton';
import { BRAZILIAN_UFS } from '@/lib/fiscal-requirements';

interface FiscalCentralHubProps {
  userRole?: string;
  defaultUf?: string;
  fiscalIssuer?: any;
  hasCertificate?: boolean;
  hasIE?: boolean;
  onNavigateToEmission?: (docType: string) => void;
}

const PROFILE_OPTIONS = [
  { value: 'PRODUTOR_RURAL', label: 'Produtor Rural / Contratante', icon: Users },
  { value: 'TAC_MEI', label: 'Transportador Autônomo (MEI)', icon: Truck },
  { value: 'TAC_AUTONOMO', label: 'Transportador Autônomo (PF)', icon: Truck },
  { value: 'TRANSPORTADORA', label: 'Transportadora (ETC)', icon: Building2 },
  { value: 'PRESTADOR_SERVICOS', label: 'Prestador de Serviços', icon: Wrench },
  { value: 'MEI_COMERCIO', label: 'MEI (Comércio)', icon: Users },
];

export const FiscalCentralHub: React.FC<FiscalCentralHubProps> = ({
  userRole = 'PRODUTOR',
  defaultUf = 'MT',
  fiscalIssuer,
  hasCertificate = false,
  hasIE = false,
  onNavigateToEmission,
}) => {
  const [selectedProfile, setSelectedProfile] = useState<FiscalProfileType>(
    mapRoleToFiscalProfile(userRole, false)
  );
  const [selectedUf, setSelectedUf] = useState(fiscalIssuer?.uf || defaultUf);
  const [isMei, setIsMei] = useState(false);

  const profileData = useMemo(() => {
    return getProfileEligibility(selectedProfile);
  }, [selectedProfile]);

  const aptidaoStatus = useMemo(() => {
    const issues: string[] = [];
    
    if (!fiscalIssuer) {
      issues.push('Emissor fiscal não configurado');
    } else {
      if (!hasCertificate) issues.push('Certificado A1 não enviado');
      if (!hasIE && selectedProfile !== 'PRESTADOR_SERVICOS') issues.push('Inscrição Estadual pendente');
      if (!fiscalIssuer.logradouro) issues.push('Endereço incompleto');
    }
    
    if (issues.length === 0) return { status: 'OK', issues };
    if (issues.length <= 2) return { status: 'Pendente', issues };
    return { status: 'Bloqueado', issues };
  }, [fiscalIssuer, hasCertificate, hasIE, selectedProfile]);

  const handleContactSupport = () => {
    const message = encodeURIComponent(
      `🌱 *AgriRoute - Central Fiscal*\n\n` +
      `Olá! Preciso de ajuda com minha aptidão fiscal.\n\n` +
      `*Meu perfil:* ${profileData?.label || selectedProfile}\n` +
      `*UF:* ${selectedUf}\n` +
      `*Status:* ${aptidaoStatus.status}\n\n` +
      `Por favor, me ajudem a regularizar minha situação.`
    );
    window.open(`https://wa.me/5566992734632?text=${message}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Central Fiscal</h2>
            <p className="text-muted-foreground text-sm">
              Entenda o que você pode emitir e verifique sua aptidão
            </p>
          </div>
        </div>
        <SupportButton context={{ screen: 'Central Fiscal' }} />
      </div>

      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="perfil" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Meu Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="documentos" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">O que posso emitir</span>
          </TabsTrigger>
          <TabsTrigger value="checklist" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">O que falta</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Meu Perfil Fiscal */}
        <TabsContent value="perfil" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Meu Perfil Fiscal</CardTitle>
              <CardDescription>
                Selecione seu tipo de atividade para ver as regras corretas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-2 block">Tipo de Atividade</label>
                  <Select 
                    value={selectedProfile} 
                    onValueChange={(v) => setSelectedProfile(v as FiscalProfileType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PROFILE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <opt.icon className="h-4 w-4" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">UF Principal</label>
                  <Select value={selectedUf} onValueChange={setSelectedUf}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BRAZILIAN_UFS.map((item) => (
                        <SelectItem key={item.uf} value={item.uf}>{item.uf} - {item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status de Aptidão */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Status de Aptidão Fiscal:</span>
                  <Badge 
                    variant={
                      aptidaoStatus.status === 'OK' ? 'default' : 
                      aptidaoStatus.status === 'Pendente' ? 'secondary' : 'destructive'
                    }
                    className="text-sm"
                  >
                    {aptidaoStatus.status === 'OK' && <CheckCircle className="h-3 w-3 mr-1" />}
                    {aptidaoStatus.status === 'Pendente' && <AlertTriangle className="h-3 w-3 mr-1" />}
                    {aptidaoStatus.status === 'Bloqueado' && <XCircle className="h-3 w-3 mr-1" />}
                    {aptidaoStatus.status}
                  </Badge>
                </div>
                
                {aptidaoStatus.issues.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {aptidaoStatus.issues.map((issue, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                        <XCircle className="h-3 w-3 text-destructive" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Alerta MEI */}
          {(selectedProfile === 'MEI_COMERCIO' || selectedProfile === 'TAC_MEI') && (
            <Alert className="border-yellow-500/30 bg-yellow-500/5">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle>Atenção MEI</AlertTitle>
              <AlertDescription>
                <strong>MEI NÃO é obrigado a emitir NF-e.</strong> Conforme orientação da SEFAZ-MT, 
                MEI pode emitir <strong>NF-a (Nota Fiscal Avulsa)</strong> diretamente no portal da SEFAZ.
                <br /><br />
                A emissão de NF-e, CT-e ou MDF-e por MEI é <strong>voluntária</strong> e exige 
                credenciamento específico + Inscrição Estadual.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Tab: O que posso emitir */}
        <TabsContent value="documentos" className="space-y-6 mt-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">
              {profileData?.label}: O que posso emitir?
            </h3>
            <p className="text-muted-foreground text-sm">
              {profileData?.description}
            </p>
          </div>

          <div className="grid gap-3">
            {profileData?.documents.map((doc) => (
              <DocumentEligibilityCard key={doc.docType} document={doc} />
            ))}
          </div>

          {/* Notas gerais */}
          {profileData?.generalNotes && profileData.generalNotes.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Notas Importantes</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1">
                  {profileData.generalNotes.map((note, idx) => (
                    <li key={idx} className="text-sm">{note}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Tab: O que falta */}
        <TabsContent value="checklist" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Guia Rápido: O que falta para emitir
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ChecklistItem 
                title="Emissor Fiscal Configurado"
                done={!!fiscalIssuer}
                description="Configure seu emissor na aba 'Emissor'"
              />
              <ChecklistItem 
                title="Certificado Digital A1"
                done={hasCertificate}
                description="Faça upload do seu certificado .pfx/.p12"
              />
              <ChecklistItem 
                title="Inscrição Estadual (IE)"
                done={hasIE}
                description="Verifique sua IE no SINTEGRA"
                link={{ label: 'SINTEGRA', url: 'http://www.sintegra.gov.br/' }}
              />
              <ChecklistItem 
                title="Endereço Completo"
                done={!!(fiscalIssuer?.logradouro && fiscalIssuer?.cep)}
                description="Logradouro, número, bairro, cidade, UF e CEP"
              />
              <ChecklistItem 
                title="Credenciamento SEFAZ"
                done={fiscalIssuer?.sefaz_status === 'validated'}
                description="Verifique seu credenciamento no portal SEFAZ"
                link={selectedUf === 'MT' ? { 
                  label: 'Credenciamento SEFAZ-MT', 
                  url: 'https://www5.sefaz.mt.gov.br/servicos?c=6346394&e=6398811' 
                } : undefined}
              />
            </CardContent>
          </Card>

          {/* Seção RNTRC/ANTT */}
          {(selectedProfile === 'TAC_MEI' || selectedProfile === 'TAC_AUTONOMO' || selectedProfile === 'TRANSPORTADORA') && (
            <RntrcAnttSection />
          )}

          {/* Seção MT Específica */}
          {selectedUf === 'MT' && (
            <MtCredenciamentoSection />
          )}
        </TabsContent>
      </Tabs>

      {/* Footer com suporte */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                As regras podem variar por estado e município. Em caso de dúvida, consulte seu contador ou a SEFAZ/ANTT.
              </p>
            </div>
            <Button onClick={handleContactSupport} variant="outline">
              <MessageCircle className="h-4 w-4 mr-2" />
              Falar com Suporte
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ============= COMPONENTES AUXILIARES =============

const DocumentEligibilityCard: React.FC<{ document: DocumentEligibility }> = ({ document }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-sm ${
        document.status === 'PERMITIDO' ? 'border-green-500/30' :
        document.status === 'DEPENDE' || document.status === 'VOLUNTARIO' ? 'border-yellow-500/30' :
        'border-muted'
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant={getStatusBadgeVariant(document.status)}>
              {getStatusLabel(document.status)}
            </Badge>
            <div>
              <h4 className="font-medium">{document.label}</h4>
              <p className="text-xs text-muted-foreground">{document.docType}</p>
            </div>
          </div>
          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <p className="text-sm text-muted-foreground">{document.description}</p>
            
            {document.warningMessage && (
              <Alert className="border-yellow-500/30 bg-yellow-500/5">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-sm">{document.warningMessage}</AlertDescription>
              </Alert>
            )}

            {document.requirements && document.requirements.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Requisitos:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {document.requirements.map((req, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <ChevronRight className="h-3 w-3 mt-1 flex-shrink-0" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {document.links && document.links.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {document.links.map((link, idx) => (
                  <Button 
                    key={idx} 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(link.url, '_blank');
                    }}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    {link.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ChecklistItem: React.FC<{
  title: string;
  done: boolean;
  description: string;
  link?: { label: string; url: string };
}> = ({ title, done, description, link }) => (
  <div className="flex items-start gap-3">
    {done ? (
      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
    ) : (
      <XCircle className="h-5 w-5 text-destructive mt-0.5" />
    )}
    <div className="flex-1">
      <p className={`font-medium ${done ? 'text-green-700 dark:text-green-400' : ''}`}>{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
      {link && !done && (
        <Button 
          variant="link" 
          size="sm" 
          className="px-0 h-auto"
          onClick={() => window.open(link.url, '_blank')}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          {link.label}
        </Button>
      )}
    </div>
  </div>
);

const RntrcAnttSection: React.FC = () => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg flex items-center gap-2">
        <Truck className="h-5 w-5" />
        RNTRC / ANTT - Transporte de Cargas
      </CardTitle>
      <CardDescription>
        Registro Nacional de Transportadores Rodoviários de Cargas
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">
        O RNTRC é obrigatório para transportadores rodoviários de carga. 
        Para obter ou renovar, você precisa de conta gov.br nível prata ou ouro.
      </p>

      <div className="p-4 bg-muted rounded-lg space-y-2">
        <h4 className="font-medium">Prova Eletrônica ANTT</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• 30 questões sobre legislação de transporte</li>
          <li>• Duração: 1h15</li>
          <li>• Aprovação: 60% (18 acertos)</li>
          <li>• Pode refazer após 48h se reprovado</li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button 
          variant="outline"
          onClick={() => window.open('https://www.gov.br/antt', '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Portal ANTT (RNTRC)
        </Button>
        <Button 
          variant="outline"
          onClick={() => window.open('https://provaeletronica.antt.gov.br/', '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Prova Eletrônica ANTT
        </Button>
      </div>
    </CardContent>
  </Card>
);

const MtCredenciamentoSection: React.FC = () => (
  <Card className="border-primary/30">
    <CardHeader>
      <CardTitle className="text-lg flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" />
        Mato Grosso (MT) — Credenciamento SEFAZ
      </CardTitle>
      <CardDescription>
        Passo a passo para credenciamento como emissor no MT
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Badge className="bg-primary text-primary-foreground">1</Badge>
          <div>
            <p className="font-medium">Solicite Senha para Contribuinte</p>
            <p className="text-sm text-muted-foreground">
              Acesse o portal SEFAZ-MT e solicite sua senha de contribuinte
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Badge className="bg-primary text-primary-foreground">2</Badge>
          <div>
            <p className="font-medium">Aguarde e-mail com códigos</p>
            <p className="text-sm text-muted-foreground">
              A SEFAZ enviará por e-mail: Número de Solicitação e Código de Liberação
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Badge className="bg-primary text-primary-foreground">3</Badge>
          <div>
            <p className="font-medium">Libere sua senha</p>
            <p className="text-sm text-muted-foreground">
              Use os códigos recebidos para criar sua senha definitiva
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Badge className="bg-primary text-primary-foreground">4</Badge>
          <div>
            <p className="font-medium">Acesse o portal e-PAC</p>
            <p className="text-sm text-muted-foreground">
              Com a senha criada, acesse o e-PAC para gerenciar sua situação fiscal
            </p>
          </div>
        </div>
      </div>

      <Alert className="border-blue-500/30 bg-blue-500/5">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription>
          <strong>Campos necessários:</strong> Inscrição Estadual, Número de Solicitação, Código de Liberação, Senha.
          Você receberá os códigos por e-mail.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-2">
        <Button 
          onClick={() => window.open('https://www5.sefaz.mt.gov.br/servicos?c=6346394&e=6398811', '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Credenciamento SEFAZ-MT (OFICIAL)
        </Button>
        <Button 
          variant="outline"
          onClick={() => window.open('https://www.sefaz.mt.gov.br/acesso/pages/login/login.xhtml', '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Webservice (verificar credenciamento)
        </Button>
        <Button 
          variant="outline"
          onClick={() => window.open('https://www5.sefaz.mt.gov.br/portal-de-atendimento-ao-contribuinte', '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Portal de Atendimento
        </Button>
      </div>
    </CardContent>
  </Card>
);

export default FiscalCentralHub;

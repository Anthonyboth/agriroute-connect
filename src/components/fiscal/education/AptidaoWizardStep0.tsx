/**
 * Etapa 0 do Wizard de Emissão - Documento Correto + Aptidão
 * 
 * DEVE SER EXIBIDO ANTES DE QUALQUER EMISSÃO/PAGAMENTO PIX
 * 
 * Verifica:
 * 1. Tipo de usuário (MEI, TAC, Transportadora, etc.)
 * 2. Documento correto para o perfil
 * 3. Aptidão fiscal (certificado, IE, credenciamento)
 * 
 * ⚠️ MEI geralmente emite NF-a (NFA) e não NF-e
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NfaAssistedWizard } from '@/components/fiscal/nfa/NfaAssistedWizard';
import { isFeatureEnabled } from '@/config/featureFlags';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  MessageCircle,
  FileText,
  Truck,
  Info,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { 
  FiscalProfileType,
  getProfileEligibility,
  getProfileLabel,
  canEmitDocument,
  getStatusLabel,
  EligibilityStatus,
} from '@/lib/fiscal-eligibility-rules';
import { DocumentType, BRAZILIAN_UFS } from '@/lib/fiscal-requirements';

interface AptidaoStep0Context {
  isMei?: boolean;
  userType?: string;
  selectedUf?: string;
}

interface AptidaoWizardStep0Props {
  documentType: DocumentType;
  onContinue: (context?: AptidaoStep0Context) => void;
  onCancel: () => void;
  onUseAlternative?: (altDocType: string) => void;
  defaultUf?: string;
  fiscalIssuer?: any;
  hasCertificate?: boolean;
  hasIE?: boolean;
}

export const AptidaoWizardStep0: React.FC<AptidaoWizardStep0Props> = ({
  documentType,
  onContinue,
  onCancel,
  onUseAlternative,
  defaultUf = 'MT',
  fiscalIssuer,
  hasCertificate = false,
  hasIE = false,
}) => {
  const [isMei, setIsMei] = useState<'sim' | 'nao' | null>(null);
  const [userType, setUserType] = useState<string | null>(null);
  const [selectedUf, setSelectedUf] = useState(fiscalIssuer?.uf || defaultUf);
  const [acknowledged, setAcknowledged] = useState(false);
  const [showNfaWizard, setShowNfaWizard] = useState(false);

  // Determinar perfil fiscal baseado nas respostas
  const fiscalProfile = useMemo((): FiscalProfileType | null => {
    if (!userType) return null;
    
    if (userType === 'TAC') {
      return isMei === 'sim' ? 'TAC_MEI' : 'TAC_AUTONOMO';
    }
    if (userType === 'TRANSPORTADORA') return 'TRANSPORTADORA';
    if (userType === 'PRODUTOR') return 'PRODUTOR_RURAL';
    if (userType === 'PRESTADOR') return 'PRESTADOR_SERVICOS';
    if (userType === 'COMERCIO') {
      return isMei === 'sim' ? 'MEI_COMERCIO' : 'EMPRESA_GERAL';
    }
    return null;
  }, [userType, isMei]);

  // Verificar elegibilidade
  const eligibility = useMemo((): EligibilityStatus | null => {
    if (!fiscalProfile) return null;
    return canEmitDocument(fiscalProfile, documentType);
  }, [fiscalProfile, documentType]);

  // Verificar aptidão
  const aptidaoIssues = useMemo(() => {
    const issues: string[] = [];
    
    if (!fiscalIssuer) issues.push('Emissor fiscal não configurado');
    if (!hasCertificate) issues.push('Certificado A1 não enviado');
    if (!hasIE && documentType !== 'NFSE' && documentType !== 'GTA') {
      issues.push('Inscrição Estadual pendente');
    }
    
    return issues;
  }, [fiscalIssuer, hasCertificate, hasIE, documentType]);

  const showMeiWarning = useMemo(() => {
    return (
      isMei === 'sim' &&
      (documentType === 'NFE' || documentType === 'CTE' || documentType === 'MDFE') &&
      (eligibility === 'DEPENDE' || eligibility === 'VOLUNTARIO')
    );
  }, [isMei, documentType, eligibility]);

  const canProceed = useMemo(() => {
    // ❌ Não aplicável = nunca pode emitir
    if (eligibility === 'NAO_APLICAVEL') return false;

    // ⚠️ MEI tentando NF-e/CT-e/MDF-e = só pode continuar se reconhecer explicitamente
    if (showMeiWarning && !acknowledged) return false;

    // ⚠️ Pendências técnicas = só pode continuar se reconhecer
    if (aptidaoIssues.length > 0 && !acknowledged) return false;

    return true;
  }, [eligibility, aptidaoIssues, acknowledged, showMeiWarning]);

  const handleContactSupport = () => {
    const message = encodeURIComponent(
      `🌱 *AgriRoute - Dúvida sobre Emissão*\n\n` +
      `Olá! Tenho dúvidas sobre emitir ${documentType}.\n\n` +
      `*Sou MEI:* ${isMei || 'Não informado'}\n` +
      `*Tipo:* ${userType || 'Não informado'}\n` +
      `*UF:* ${selectedUf}\n\n` +
      `Por favor, me ajudem a entender se posso emitir este documento.`
    );
    window.open(`https://wa.me/5566992734632?text=${message}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Antes de emitir {documentType}
          </CardTitle>
          <CardDescription>
            Vamos verificar se este é o documento correto para você
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pergunta 1: MEI? */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Você é MEI (Microempreendedor Individual)?</Label>
            <RadioGroup 
              value={isMei || ''} 
              onValueChange={(v) => setIsMei(v as 'sim' | 'nao')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sim" id="mei-sim" />
                <Label htmlFor="mei-sim">Sim</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="nao" id="mei-nao" />
                <Label htmlFor="mei-nao">Não</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Pergunta 2: Tipo de usuário */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Qual sua principal atividade?</Label>
            <Select value={userType || ''} onValueChange={setUserType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TAC">Transportador Autônomo (caminhoneiro)</SelectItem>
                <SelectItem value="TRANSPORTADORA">Transportadora (empresa)</SelectItem>
                <SelectItem value="PRODUTOR">Produtor Rural / Contratante</SelectItem>
                <SelectItem value="COMERCIO">Comércio (venda de produtos)</SelectItem>
                <SelectItem value="PRESTADOR">Prestador de Serviços</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pergunta 3: UF */}
          <div className="space-y-3">
            <Label className="text-base font-medium">UF principal:</Label>
            <Select value={selectedUf} onValueChange={setSelectedUf}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRAZILIAN_UFS.map((item) => (
                  <SelectItem key={item.uf} value={item.uf}>{item.uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Resultado da verificação */}
      {fiscalProfile && eligibility && (
        <Card className={
          eligibility === 'PERMITIDO' ? 'border-green-500/30' :
          eligibility === 'DEPENDE' || eligibility === 'VOLUNTARIO' ? 'border-yellow-500/30' :
          'border-destructive/30'
        }>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {eligibility === 'PERMITIDO' && <CheckCircle className="h-5 w-5 text-green-600" />}
              {(eligibility === 'DEPENDE' || eligibility === 'VOLUNTARIO') && <AlertTriangle className="h-5 w-5 text-yellow-600" />}
              {eligibility === 'NAO_APLICAVEL' && <XCircle className="h-5 w-5 text-destructive" />}
              Resultado: {getStatusLabel(eligibility)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Alerta MEI para NF-e/CT-e/MDF-e */}
            {showMeiWarning && (
              <Alert className="border-amber-500/30 bg-amber-500/5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-700 dark:text-amber-400">MEI — Verificação de credenciamento</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p className="text-sm">
                    Como MEI, você pode emitir NF-e <strong>se já possuir credenciamento na SEFAZ</strong>.
                    Caso contrário, a alternativa é emitir NF-a (Nota Fiscal Avulsa) pelo portal SEFAZ.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2">
                    {isFeatureEnabled('enable_nfa_assisted_emission') && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowNfaWizard(true)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Emitir NF-a (alternativa)
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open('https://www.sefaz.mt.gov.br/nfae/emissao', '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Portal SEFAZ-MT (NF-a)
                    </Button>
                  </div>

                  {/* Confirmação simplificada */}
                  {documentType === 'NFE' && (
                    <div className="flex items-start gap-2 bg-muted/50 p-3 rounded-md border mt-2">
                      <input
                        type="checkbox"
                        id="acknowledge-voluntary"
                        checked={acknowledged}
                        onChange={(e) => setAcknowledged(e.target.checked)}
                        className="h-4 w-4 mt-0.5"
                      />
                      <label htmlFor="acknowledge-voluntary" className="text-sm cursor-pointer">
                        <strong>Confirmo que possuo credenciamento SEFAZ</strong> e estou autorizado a emitir NF-e como MEI.
                      </label>
                    </div>
                  )}

                  {(documentType === 'CTE' || documentType === 'MDFE') && (
                    <div className="flex items-start gap-2 bg-muted/50 p-3 rounded-md border mt-2">
                      <input
                        type="checkbox"
                        id="acknowledge-voluntary"
                        checked={acknowledged}
                        onChange={(e) => setAcknowledged(e.target.checked)}
                        className="h-4 w-4 mt-0.5"
                      />
                      <label htmlFor="acknowledge-voluntary" className="text-sm cursor-pointer">
                        <strong>Confirmo que possuo RNTRC, credenciamento SEFAZ e certificado A1</strong> para emitir {documentType}.
                      </label>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Não aplicável */}
            {eligibility === 'NAO_APLICAVEL' && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Documento não aplicável</AlertTitle>
                <AlertDescription>
                  O documento {documentType} não se aplica ao seu perfil de <strong>{fiscalProfile ? getProfileLabel(fiscalProfile) : 'desconhecido'}</strong>. 
                  Verifique se selecionou a opção correta ou fale com nosso suporte.
                </AlertDescription>
              </Alert>
            )}

            {/* Pendências de aptidão */}
            {aptidaoIssues.length > 0 && eligibility !== 'NAO_APLICAVEL' && (
              <Alert className="border-destructive/30 bg-destructive/5">
                <XCircle className="h-4 w-4 text-destructive" />
                <AlertTitle>Pendências encontradas</AlertTitle>
                <AlertDescription>
                  <p className="mb-2">
                    Você precisa resolver as seguintes pendências antes de emitir:
                  </p>
                  <ul className="space-y-1">
                    {aptidaoIssues.map((issue, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <XCircle className="h-3 w-3 text-destructive" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Tudo OK */}
            {eligibility === 'PERMITIDO' && aptidaoIssues.length === 0 && (
              <Alert className="border-green-500/30 bg-green-500/5">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle>Você pode emitir</AlertTitle>
                <AlertDescription>
                  Seu perfil permite a emissão de {documentType} e sua aptidão fiscal está OK.
                </AlertDescription>
              </Alert>
            )}

            {/* Links úteis MT */}
            {selectedUf === 'MT' && (documentType === 'NFE' || documentType === 'CTE' || documentType === 'MDFE') && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-2">Links úteis SEFAZ-MT:</p>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open('https://www5.sefaz.mt.gov.br/servicos?c=6346394&e=6398811', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Credenciamento SEFAZ-MT
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open('https://www.sefaz.mt.gov.br/acesso/pages/login/login.xhtml', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Webservice (verificar credenciamento)
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open('https://www5.sefaz.mt.gov.br/portal-de-atendimento-ao-contribuinte', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Portal de Atendimento
                  </Button>
                </div>
              </div>
            )}

            {/* Links ANTT para transporte */}
            {(documentType === 'CTE' || documentType === 'MDFE') && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-2">Links ANTT (Transporte):</p>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open('https://www.gov.br/antt', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Portal ANTT (RNTRC)
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open('https://provaeletronica.antt.gov.br/', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Prova Eletrônica
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Footer com ações */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t">
        <Button variant="ghost" onClick={handleContactSupport}>
          <MessageCircle className="h-4 w-4 mr-2" />
          Falar com Suporte
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          
          {showMeiWarning && !acknowledged ? (
            <Button disabled variant="secondary">
              <XCircle className="h-4 w-4 mr-2" />
              Confirme o credenciamento acima
            </Button>
          ) : (
            <Button 
              onClick={() => onContinue({ isMei: isMei === 'sim', userType: userType || undefined, selectedUf })}
              disabled={!canProceed || eligibility === 'NAO_APLICAVEL'}
            >
              Continuar com {documentType}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Aviso legal */}
      <p className="text-xs text-muted-foreground text-center">
        As regras podem variar por estado e município. Em caso de dúvida, consulte seu contador ou a SEFAZ/ANTT.
      </p>

      {/* NFA Assisted Wizard */}
      <NfaAssistedWizard
        isOpen={showNfaWizard}
        onClose={() => setShowNfaWizard(false)}
      />
    </div>
  );
};

export default AptidaoWizardStep0;

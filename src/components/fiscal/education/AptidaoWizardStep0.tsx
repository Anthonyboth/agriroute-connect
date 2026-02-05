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

interface AptidaoWizardStep0Props {
  documentType: DocumentType;
  onContinue: () => void;
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
            {/* Alerta MEI para NF-e/CT-e/MDF-e - Redirecionamento para NF-a */}
            {showMeiWarning && (
              <Alert className="border-destructive/30 bg-destructive/5">
                <XCircle className="h-4 w-4 text-destructive" />
                <AlertTitle className="text-destructive">⚠️ MEI - Use NF-a (Nota Fiscal Avulsa)</AlertTitle>
                <AlertDescription className="space-y-4">
                  {/* Informação do Sebrae sobre MEI e NF */}
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-2">
                    <p className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      MEI é obrigado a emitir Nota Fiscal?
                    </p>
                    <p className="text-sm">
                      <strong>Em regra, não.</strong> Porém você pode ter a obrigação em alguns casos:
                    </p>
                    <ul className="text-sm list-disc list-inside space-y-1">
                      <li>Sempre que vender ou prestar serviços para <strong>outras pessoas jurídicas</strong> (empresas ou governo)</li>
                      <li>Quando seus clientes (pessoa física) <strong>solicitarem</strong></li>
                      <li>Sempre que precisar <strong>enviar seu produto</strong> para o cliente (ex: venda pela internet)</li>
                    </ul>
                    <p className="text-xs text-muted-foreground mt-2">
                      Fonte: Portal Sebrae - "Nota Fiscal para MEI"
                    </p>
                  </div>

                  <p className="font-semibold">
                    <strong>MEI que NÃO tem credenciamento SEFAZ pode emitir notas avulsas (NF-a)</strong> diretamente 
                    no portal da SEFAZ com login e senha, sem precisar de certificado digital.
                  </p>
                  
                  {/* Bloco de instruções para NF-a */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-3">
                    <p className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Como emitir NF-a no Portal SEFAZ-MT:
                    </p>
                    <ol className="list-decimal list-inside text-sm space-y-2">
                      <li>Acesse o portal SEFAZ-MT com sua <strong>senha de contribuinte</strong> (e-PAC)</li>
                      <li>Navegue até <strong>"NFA-e → Emissão de NFA-e"</strong></li>
                      <li>Preencha os dados da nota (destinatário, produtos, valores)</li>
                      <li>Transmita e imprima o <strong>DANFA-e</strong></li>
                    </ol>
                    
                    <Button 
                      variant="default" 
                      size="lg" 
                      onClick={() => window.open('https://www.sefaz.mt.gov.br/nfae/emissao', '_blank')}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Acessar Portal SEFAZ-MT para NF-a
                    </Button>
                    
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>💡 <strong>Primeira vez?</strong> Solicite a senha de contribuinte no <strong>e-PAC</strong> antes.</p>
                      <p>🔒 <strong>Não precisa de certificado digital A1</strong> para emitir NF-a como MEI.</p>
                    </div>
                  </div>

                  {/* Sobre a diferença NF-e vs NFA */}
                  <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
                    <p className="font-medium">Qual a diferença entre NF-e e NF-a?</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1">NF-e</th>
                          <th className="text-left py-1">NF-a (Avulsa)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="py-1">Exige credenciamento SEFAZ</td>
                          <td className="py-1">Apenas login/senha</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-1">Exige certificado A1</td>
                          <td className="py-1">Não exige certificado</td>
                        </tr>
                        <tr>
                          <td className="py-1">Para empresas credenciadas</td>
                          <td className="py-1">Para MEI ou vendas eventuais</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Aviso sobre NF-e voluntária */}
                  {documentType === 'NFE' && (
                    <div className="pt-3 border-t border-dashed space-y-3">
                      <p className="text-sm text-muted-foreground">
                        <strong>Insiste em emitir NF-e?</strong> É voluntário para MEI e exige:
                        IE ativa + credenciamento SEFAZ + certificado A1. <strong>A SEFAZ pode rejeitar.</strong>
                      </p>

                      <div className="flex items-start gap-2 bg-destructive/10 p-3 rounded-md">
                        <input
                          type="checkbox"
                          id="acknowledge-voluntary"
                          checked={acknowledged}
                          onChange={(e) => setAcknowledged(e.target.checked)}
                          className="h-4 w-4 mt-0.5"
                        />
                        <label htmlFor="acknowledge-voluntary" className="text-sm cursor-pointer">
                          <strong>Entendo que NF-e não é obrigatória para MEI</strong>, que a SEFAZ pode rejeitar minha emissão,
                          e que a opção correta é emitir NF-a pelo portal SEFAZ-MT.
                        </label>
                      </div>
                    </div>
                  )}
                  
                  {(documentType === 'CTE' || documentType === 'MDFE') && (
                    <p className="text-sm pt-2 border-t">
                      CT-e e MDF-e para MEI são <strong>voluntários</strong> e exigem:
                      RNTRC + credenciamento SEFAZ + certificado A1 + programa emissor.
                    </p>
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
                    onClick={() => window.open('https://www.sefaz.mt.gov.br/epac/', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Portal e-PAC
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
              Reconheça ou escolha NF-a
            </Button>
          ) : (
            <Button 
              onClick={onContinue}
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
    </div>
  );
};

export default AptidaoWizardStep0;

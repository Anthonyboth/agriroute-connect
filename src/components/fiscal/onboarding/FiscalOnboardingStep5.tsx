import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  Loader2, 
  CheckCircle2,
  Shield,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { useFiscalIssuer } from '@/hooks/useFiscalIssuer';

interface FiscalOnboardingStep5Props {
  onComplete?: () => void;
  onBack: () => void;
}

export function FiscalOnboardingStep5({ onComplete, onBack }: FiscalOnboardingStep5Props) {
  const { loading, issuer, acceptTerms } = useFiscalIssuer();
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  const isAlreadyAccepted = issuer?.onboarding_completed === true;

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    const isAtBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 10;
    if (isAtBottom) {
      setHasScrolledToEnd(true);
    }
  };

  const handleAccept = async () => {
    if (!isChecked || !hasScrolledToEnd) return;

    const success = await acceptTerms();
    
    if (success) {
      onComplete?.();
    }
  };

  if (isAlreadyAccepted) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Termo de Responsabilidade</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Você já aceitou o termo de responsabilidade fiscal
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 py-8">
          <CheckCircle2 className="h-16 w-16 text-green-600" />
          <div className="text-center">
            <h4 className="font-semibold text-green-700">Onboarding Concluído!</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Seu emissor fiscal está ativo e pronto para uso.
            </p>
          </div>
        </div>

        <Button onClick={onComplete} className="w-full">
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Concluir
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Termo de Responsabilidade Fiscal
        </h3>
        <p className="text-muted-foreground text-sm mt-1">
          Leia atentamente e aceite para concluir o cadastro
        </p>
      </div>

      <ScrollArea 
        className="h-[300px] border rounded-md p-4"
        onScrollCapture={handleScroll}
      >
        <div className="space-y-4 text-sm">
          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200 font-medium">
              <strong>IMPORTANTE:</strong> O AgriRoute atua como intermediador tecnológico. 
              A responsabilidade fiscal permanece integralmente com o emissor.
            </AlertDescription>
          </Alert>

          <h4 className="font-semibold text-base">
            TERMO DE RESPONSABILIDADE FISCAL – EMISSÃO DE NF-E VIA AGRIROUTE
          </h4>

          <p>Ao utilizar o serviço de emissão de NF-e do AgriRoute, declaro que:</p>

          <div className="space-y-3 ml-4">
            <p>
              <strong>1. NATUREZA DO SERVIÇO</strong><br />
              O AgriRoute atua como <strong>plataforma tecnológica</strong> de intermediação para 
              emissão de documentos fiscais eletrônicos (NF-e, CT-e), sem substituir a responsabilidade 
              fiscal do emissor perante a SEFAZ e demais órgãos reguladores.
            </p>

            <p>
              <strong>2. RESPONSABILIDADE FISCAL</strong><br />
              Sou <strong>integralmente responsável</strong> pela veracidade das informações inseridas, 
              pela correta classificação tributária, e pelo cumprimento de todas as obrigações fiscais 
              decorrentes da emissão.
            </p>

            <p>
              <strong>3. CERTIFICADO DIGITAL</strong><br />
              O certificado digital A1 utilizado é de minha exclusiva propriedade e responsabilidade. 
              Autorizo o AgriRoute a utilizá-lo <strong>exclusivamente</strong> para assinatura dos 
              documentos fiscais solicitados por mim.
            </p>

            <p>
              <strong>4. COBRANÇA POR EMISSÃO</strong><br />
              Compreendo que o AgriRoute cobra uma taxa de <strong>serviço tecnológico</strong> por 
              emissão realizada. Esta taxa remunera o uso da plataforma e não constitui cobrança de tributos.
            </p>

            <p>
              <strong>5. ESTORNO EM CASO DE REJEIÇÃO</strong><br />
              Em caso de rejeição da NF-e pela SEFAZ, o valor cobrado será <strong>estornado</strong> 
              automaticamente para minha carteira no sistema.
            </p>

            <p>
              <strong>6. ARMAZENAMENTO E COMPLIANCE</strong><br />
              Autorizo o armazenamento dos XMLs e DANFEs pelo período legal de 5 anos, 
              conforme exigência da legislação fiscal vigente.
            </p>

            <p>
              <strong>7. AUDITORIA E LGPD</strong><br />
              Autorizo o registro de todas as operações fiscais para fins de auditoria interna, 
              em conformidade com a Lei Geral de Proteção de Dados (LGPD).
            </p>

            <p>
              <strong>8. PENALIDADES</strong><br />
              Reconheço que eventuais autuações, multas ou penalidades decorrentes de irregularidades 
              nos documentos fiscais emitidos são de <strong>minha exclusiva responsabilidade</strong>.
            </p>
          </div>

          <div className="flex items-start gap-2 p-3 bg-muted rounded-lg mt-4">
            <FileText className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-muted-foreground text-xs">
              Este aceite possui validade jurídica nos termos do art. 10, §2º da MP 2.200-2/2001.
              Data, hora e IP do aceite serão registrados.
            </p>
          </div>

          <p className="text-muted-foreground text-xs mt-4">
            Versão do termo: 2.0 | Última atualização: Janeiro/2025
          </p>
        </div>
      </ScrollArea>

      {!hasScrolledToEnd && (
        <p className="text-xs text-muted-foreground text-center">
          Role até o final do termo para continuar
        </p>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox 
          id="accept-fiscal-term" 
          checked={isChecked}
          onCheckedChange={(checked) => setIsChecked(checked === true)}
          disabled={!hasScrolledToEnd}
        />
        <label 
          htmlFor="accept-fiscal-term" 
          className={`text-sm ${!hasScrolledToEnd ? 'text-muted-foreground' : ''}`}
        >
          Li, compreendi e aceito integralmente o Termo de Responsabilidade Fiscal
        </label>
      </div>

      <div className="flex gap-4 pt-4">
        <Button variant="outline" onClick={onBack} disabled={loading}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Button 
          onClick={handleAccept}
          className="flex-1" 
          disabled={!isChecked || !hasScrolledToEnd || loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Aceitar e Concluir
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

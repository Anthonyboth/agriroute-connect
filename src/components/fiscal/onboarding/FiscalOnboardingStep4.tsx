import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowRight, 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Shield,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { useFiscalIssuer } from '@/hooks/useFiscalIssuer';

interface FiscalOnboardingStep4Props {
  onNext: () => void;
  onBack: () => void;
}

type ValidationStatus = 'idle' | 'validating' | 'success' | 'error';

export function FiscalOnboardingStep4({ onNext, onBack }: FiscalOnboardingStep4Props) {
  const { loading, issuer, validateWithSefaz } = useFiscalIssuer();
  const [status, setStatus] = useState<ValidationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const isAlreadyValidated = issuer?.status === 'sefaz_validated' || issuer?.status === 'active';

  const handleValidate = async () => {
    setStatus('validating');
    setErrorMessage('');

    const success = await validateWithSefaz();

    if (success) {
      setStatus('success');
    } else {
      setStatus('error');
      setErrorMessage('Falha na comunicação com SEFAZ. Verifique o certificado e tente novamente.');
    }
  };

  const handleContinue = () => {
    if (isAlreadyValidated || status === 'success') {
      onNext();
    }
  };

  const renderStatusContent = () => {
    if (isAlreadyValidated) {
      return (
        <Card className="border-green-500/50 bg-green-50/50">
          <CardContent className="flex items-center gap-4 p-6">
            <CheckCircle2 className="h-12 w-12 text-green-600 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-green-700">Validação Concluída</h4>
              <p className="text-sm text-green-600 mt-1">
                Seu emissor foi validado com sucesso junto à SEFAZ.
              </p>
              {issuer?.sefaz_validated_at && (
                <p className="text-xs text-muted-foreground mt-2">
                  Validado em: {new Date(issuer.sefaz_validated_at).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }

    switch (status) {
      case 'validating':
        return (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-8">
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
              <div className="text-center">
                <h4 className="font-semibold">Validando com a SEFAZ...</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Estamos emitindo uma NF-e de teste em ambiente de homologação
                </p>
              </div>
            </CardContent>
          </Card>
        );

      case 'success':
        return (
          <Card className="border-green-500/50 bg-green-50/50">
            <CardContent className="flex items-center gap-4 p-6">
              <CheckCircle2 className="h-12 w-12 text-green-600 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-green-700">Validação Concluída!</h4>
                <p className="text-sm text-green-600 mt-1">
                  Seu emissor foi validado com sucesso. Você pode prosseguir para o próximo passo.
                </p>
              </div>
            </CardContent>
          </Card>
        );

      case 'error':
        return (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-4 p-6">
              <XCircle className="h-12 w-12 text-destructive flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-destructive">Falha na Validação</h4>
                <p className="text-sm text-destructive/80 mt-1">
                  {errorMessage}
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={handleValidate}
                  disabled={loading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Validação SEFAZ
              </CardTitle>
              <CardDescription>
                Vamos emitir uma NF-e de teste para validar seu cadastro
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">O que acontece nesta etapa:</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">1.</span>
                    Emitimos uma NF-e em ambiente de <strong>homologação</strong> (teste)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">2.</span>
                    Validamos a resposta da SEFAZ do seu estado
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">3.</span>
                    Se aprovado, seu emissor estará pronto para emitir em produção
                  </li>
                </ul>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Esta é uma emissão de <strong>teste</strong>. Nenhum documento fiscal real será gerado 
                  e não haverá cobrança.
                </AlertDescription>
              </Alert>

              <Button 
                onClick={handleValidate} 
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Iniciar Validação
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Validação com a SEFAZ</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Teste de comunicação com a Secretaria da Fazenda
        </p>
      </div>

      {renderStatusContent()}

      <div className="flex gap-4 pt-4">
        <Button 
          variant="outline" 
          onClick={onBack} 
          disabled={loading || status === 'validating'}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Button 
          onClick={handleContinue} 
          className="flex-1" 
          disabled={!isAlreadyValidated && status !== 'success'}
        >
          Continuar
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

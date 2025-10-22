import React from 'react';
import { Clock, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

interface PendingApprovalScreenProps {
  companyName?: string;
}

export const PendingApprovalScreen: React.FC<PendingApprovalScreenProps> = ({ 
  companyName = 'a transportadora' 
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-8">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-12 pb-8 text-center space-y-6">
          {/* Ícone de relógio animado */}
          <div className="mx-auto w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center">
            <Clock className="h-10 w-10 text-yellow-600 animate-pulse" />
          </div>
          
          {/* Título e descrição */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              Aguardando Aprovação
            </h2>
            <p className="text-muted-foreground">
              Sua solicitação de vínculo com <strong className="text-foreground">{companyName}</strong> está em análise.
            </p>
          </div>

          {/* Alerta informativo */}
          <Alert className="border-yellow-500/50 bg-yellow-50/10 text-left">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-700">O que acontece agora?</AlertTitle>
            <AlertDescription className="space-y-3 text-sm">
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>A transportadora receberá uma notificação sobre sua solicitação</li>
                <li>Um responsável analisará seu cadastro</li>
                <li>Você será notificado por email quando for aprovado</li>
              </ol>
              <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3" />
                <span>Tempo médio de aprovação: 24-48 horas</span>
              </div>
            </AlertDescription>
          </Alert>

          {/* Botão de verificar status */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Verificar Status da Aprovação
          </Button>

          {/* Informação adicional */}
          <p className="text-xs text-muted-foreground">
            Você receberá um email assim que sua solicitação for processada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

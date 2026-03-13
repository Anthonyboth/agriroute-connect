import React from 'react';
import { Clock, AlertCircle, RefreshCw, CheckCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { resolvePostAuthRoute } from '@/lib/route-after-auth';

const AwaitingApproval = () => {
  const { profile, signOut, refreshProfile, user } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = React.useState(false);

  // Se o usuário já foi aprovado, redirecionar para o dashboard
  React.useEffect(() => {
    if (profile?.status === 'APPROVED') {
      const redirect = async () => {
        const destination = await resolvePostAuthRoute({
          id: profile.id,
          role: profile.role || 'PRODUTOR',
          status: 'APPROVED',
          selfie_url: profile.selfie_url || null,
          document_photo_url: profile.document_photo_url || null,
        });
        navigate(destination, { replace: true });
      };
      redirect();
    }
  }, [profile?.status]);

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      await refreshProfile?.();
      // O useEffect acima vai redirecionar se aprovado
      setTimeout(() => setChecking(false), 1500);
    } catch {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center bg-background p-6">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-12 pb-8 text-center space-y-6">
          {/* Ícone de relógio animado */}
          <div className="mx-auto w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <Clock className="h-10 w-10 text-yellow-600 dark:text-yellow-400 animate-pulse" />
          </div>
          
          {/* Título e descrição */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              Aguardando Aprovação
            </h2>
            <p className="text-muted-foreground">
              Seu cadastro está sendo analisado pela equipe AgriRoute.
            </p>
          </div>

          {/* Alerta informativo */}
          <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20 text-left">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertTitle className="text-yellow-700 dark:text-yellow-300">O que acontece agora?</AlertTitle>
            <AlertDescription className="space-y-3 text-sm">
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>Sua documentação será revisada pela equipe</li>
                <li>Um administrador analisará seus dados</li>
                <li>Você será notificado quando o cadastro for aprovado</li>
              </ol>
              <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3" />
                <span>Tempo médio de aprovação: 24-48 horas</span>
              </div>
            </AlertDescription>
          </Alert>

          {/* Botões */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleCheckStatus}
              disabled={checking}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Verificando...' : 'Verificar Status da Aprovação'}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>

          {/* Informação adicional */}
          <p className="text-xs text-muted-foreground">
            Você receberá uma notificação assim que seu cadastro for processado.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AwaitingApproval;

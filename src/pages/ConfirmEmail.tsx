import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, CheckCircle, AlertTriangle, Mail } from 'lucide-react';
import { BackButton } from '@/components/BackButton';

const ConfirmEmail = () => {
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        // Verificar se há tokens na URL
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        const type = searchParams.get('type');

        if (!accessToken || !refreshToken) {
          setError('Link de confirmação inválido ou expirado');
          setLoading(false);
          return;
        }

        // Configurar a sessão com os tokens
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          console.error('Erro ao definir sessão:', sessionError);
          setError('Erro ao confirmar email. Link pode estar expirado.');
          setLoading(false);
          return;
        }

        // Verificar se o email foi confirmado
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          console.error('Erro ao obter usuário:', userError);
          setError('Erro ao confirmar email');
          setLoading(false);
          return;
        }

        if (user.email_confirmed_at) {
          setConfirmed(true);
          toast.success('Email confirmado com sucesso!');
          
          // Redirecionar após alguns segundos
          setTimeout(() => {
            navigate('/auth');
          }, 3000);
        } else {
          setError('Email ainda não confirmado');
        }

      } catch (error) {
        console.error('Erro inesperado:', error);
        setError('Erro inesperado ao confirmar email');
      } finally {
        setLoading(false);
      }
    };

    confirmEmail();
  }, [searchParams, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Confirmando email...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6 py-10">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-between mb-4">
              <BackButton to="/auth" />
              <div className="flex-1"></div>
            </div>
            <div className="flex justify-center mb-4">
              <AlertTriangle className="h-16 w-16 text-amber-500" />
            </div>
            <CardTitle>Erro na Confirmação</CardTitle>
            <CardDescription>
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Tente solicitar um novo email de confirmação ou entre em contato com o suporte.
            </p>
            <Button 
              onClick={() => navigate('/auth')} 
              className="w-full"
            >
              Voltar para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6 py-10">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle>Email Confirmado!</CardTitle>
            <CardDescription>
              Seu email foi confirmado com sucesso. Agora você pode fazer login na plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/auth')} 
              className="w-full"
            >
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-between mb-4">
            <BackButton to="/auth" />
            <div className="flex-1"></div>
          </div>
          <div className="flex justify-center mb-4">
            <Mail className="h-16 w-16 text-primary" />
          </div>
          <CardTitle>Confirme seu Email</CardTitle>
          <CardDescription>
            Clique no link enviado para seu email para continuar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => navigate('/auth')} 
            variant="outline"
            className="w-full"
          >
            Voltar para Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmEmail;
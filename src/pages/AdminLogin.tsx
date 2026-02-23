/**
 * AdminLogin — Página de login exclusiva para o painel administrativo.
 * SEM opção de cadastro. Apenas login por email + senha.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';
import { PasswordInput } from '@/components/ui/password-input';
import { ForgotPasswordModal } from '@/components/ForgotPasswordModal';
import { useAuth } from '@/hooks/useAuth';

const AdminLogin = () => {
  const [loading, setLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Se já autenticado, ir direto para o admin
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/admin-v2/dashboard', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          navigate('/admin-v2/dashboard', { replace: true });
          return;
        }
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        setIsCheckingSession(false);
      }
    };
    checkSession();
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        if (error.message?.includes('Invalid login credentials')) {
          toast.error('Email ou senha incorretos.');
        } else if (error.message?.includes('Email not confirmed')) {
          toast.error('Email não confirmado. Verifique sua caixa de entrada.');
        } else {
          toast.error(error.message || 'Erro ao fazer login.');
        }
        setLoading(false);
        return;
      }

      if (data.session) {
        toast.success('Login realizado com sucesso!');
        navigate('/admin-v2/dashboard', { replace: true });
      }
    } catch (err) {
      console.error('Login error:', err);
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (isCheckingSession || authLoading) {
    return <AppSpinner fullscreen />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center px-4 sm:px-6">
          <div className="flex items-center justify-center mb-4">
            <ShieldCheck className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-xl">Painel Administrativo</CardTitle>
          <CardDescription>
            Acesso restrito. Faça login com suas credenciais de administrador.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSignIn} className="space-y-4" autoComplete="on">
            <div className="space-y-2">
              <Label htmlFor="adminEmail">Email</Label>
              <Input
                id="adminEmail"
                name="username"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@exemplo.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminPassword">Senha</Label>
              <PasswordInput
                id="adminPassword"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full h-12" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>

          <div className="text-center mt-4">
            <Button
              variant="link"
              className="text-sm text-muted-foreground hover:text-primary"
              onClick={() => setShowForgotPassword(true)}
            >
              Esqueci minha senha
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Este painel é de uso exclusivo de administradores autorizados.
          </p>
        </CardContent>
      </Card>

      <ForgotPasswordModal
        open={showForgotPassword}
        onOpenChange={setShowForgotPassword}
      />
    </div>
  );
};

export default AdminLogin;

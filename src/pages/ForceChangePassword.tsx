import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { validatePasswordStrength, PASSWORD_REQUIREMENTS_TEXT, PASSWORD_MIN_LENGTH } from '@/utils/passwordValidation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Lock, ShieldAlert, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { PasswordInput } from '@/components/ui/password-input';

const ForceChangePassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validation = validatePasswordStrength(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = validation.valid && passwordsMatch && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    try {
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      // Get current user to find profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Clear force_password_change flag on ALL profiles of this user
        await supabase
          .from('profiles')
          .update({ force_password_change: false })
          .eq('user_id', user.id);
      }

      toast.success('Senha alterada com sucesso!', {
        description: 'Sua nova senha foi salva. Você será redirecionado.',
      });

      // Small delay for toast visibility, then redirect
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1500);
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);
      toast.error('Erro ao alterar senha', {
        description: error.message || 'Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-warning" />
          </div>
          <CardTitle className="text-xl">Alteração de Senha Obrigatória</CardTitle>
          <CardDescription>
            Sua senha foi redefinida por um administrador. Por segurança, você precisa criar uma nova senha pessoal antes de continuar.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <PasswordInput
                id="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua nova senha"
                autoComplete="new-password"
                required
              />
              {password.length > 0 && (
                <ul className="text-xs space-y-1 mt-2">
                  {[
                    { check: password.length >= PASSWORD_MIN_LENGTH, text: `Mínimo ${PASSWORD_MIN_LENGTH} caracteres` },
                    { check: /[A-Z]/.test(password), text: 'Letra maiúscula' },
                    { check: /[a-z]/.test(password), text: 'Letra minúscula' },
                    { check: /[0-9]/.test(password), text: 'Número' },
                    { check: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password), text: 'Caractere especial' },
                  ].map(({ check, text }) => (
                    <li key={text} className={`flex items-center gap-1.5 ${check ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {check ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {text}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme sua nova senha"
                autoComplete="new-password"
                required
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-destructive">As senhas não coincidem</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Salvar Nova Senha
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForceChangePassword;

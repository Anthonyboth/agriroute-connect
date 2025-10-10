import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Mail, CheckCircle } from 'lucide-react';

interface ForgotPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ForgotPasswordModal = ({ open, onOpenChange }: ForgotPasswordModalProps) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error('Por favor, insira seu e-mail');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.error('Erro ao enviar email de recuperação:', error);
        toast.error('Erro ao enviar email de recuperação. Tente novamente.');
      } else {
        setEmailSent(true);
        toast.success('Email de recuperação enviado! Verifique sua caixa de entrada e pasta de spam.');
      }
    } catch (error) {
      console.error('Erro inesperado:', error);
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setEmailSent(false);
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(openState) => { 
      if (!openState) handleClose();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Recuperar Senha
          </DialogTitle>
          <DialogDescription>
            {emailSent 
              ? 'Instruções para redefinir sua senha foram enviadas para seu e-mail.'
              : 'Digite seu e-mail para receber instruções de recuperação de senha.'
            }
          </DialogDescription>
        </DialogHeader>

        {emailSent ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Um e-mail foi enviado para <strong>{email}</strong>
              </p>
            <p className="text-sm text-muted-foreground">
              Clique no link no e-mail para redefinir sua senha. Se não encontrar o e-mail, 
              verifique sua pasta de spam ou lixo eletrônico. O link é válido por 24 horas.
            </p>
            </div>
            <div className="flex justify-center">
              <Button onClick={handleClose} className="w-full max-w-xs">
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">E-mail cadastrado</Label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                disabled={loading}
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
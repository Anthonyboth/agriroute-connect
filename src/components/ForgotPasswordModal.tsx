import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { MessageCircle, Clock } from 'lucide-react';

interface ForgotPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ForgotPasswordModal = ({ open, onOpenChange }: ForgotPasswordModalProps) => {
  const handleWhatsAppSupport = () => {
    const phoneNumber = '5566999426656';
    const message = encodeURIComponent(
      'Olá! Esqueci minha senha e preciso redefinir. ' +
      'Meu e-mail cadastrado é: [DIGITE SEU EMAIL AQUI]'
    );
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
    toast.success('Você será redirecionado para o WhatsApp do suporte');
    onOpenChange(false);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(openState) => { 
      if (!openState) handleClose();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Recuperar Senha
          </DialogTitle>
          <DialogDescription>
            Para redefinir sua senha, entre em contato com nosso suporte via WhatsApp. 
            Nossa equipe irá ajudá-lo de forma rápida e segura.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-4">
              <MessageCircle className="h-12 w-12 text-green-600 dark:text-green-500" />
            </div>
            
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">WhatsApp Suporte</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-500">
                (66) 9 9942-6656
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Seg-Sex: 8h-18h | Sáb: 8h-12h</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleWhatsAppSupport}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Abrir WhatsApp
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="w-full"
            >
              Fechar
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Por favor, tenha seu e-mail cadastrado em mãos para agilizar o atendimento
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
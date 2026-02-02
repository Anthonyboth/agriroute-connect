import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Mail, Phone } from 'lucide-react';
import { openSupport, getSupportFallbackInfo, SupportContext } from '@/lib/support';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SupportButtonProps {
  context?: SupportContext;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  fullWidth?: boolean;
}

export const SupportButton: React.FC<SupportButtonProps> = ({
  context,
  variant = 'default',
  size = 'default',
  className = '',
  fullWidth = false,
}) => {
  const [showFallback, setShowFallback] = React.useState(false);
  const supportInfo = getSupportFallbackInfo();

  const handleClick = () => {
    // Se não tem canal configurado, mostra modal
    if (!supportInfo.whatsapp && supportInfo.email === 'suporte@agriroute.com.br') {
      setShowFallback(true);
      return;
    }
    openSupport(context);
  };

  return (
    <>
      <Button 
        variant={variant} 
        size={size}
        onClick={handleClick}
        className={`${fullWidth ? 'w-full' : ''} ${className}`}
      >
        <MessageCircle className="h-4 w-4 mr-2" />
        Falar com Suporte
      </Button>

      <Dialog open={showFallback} onOpenChange={setShowFallback}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              {supportInfo.title}
            </DialogTitle>
            <DialogDescription>
              {supportInfo.message}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">E-mail</p>
                <a 
                  href={`mailto:${supportInfo.email}`}
                  className="text-sm text-primary hover:underline"
                >
                  {supportInfo.email}
                </a>
              </div>
            </div>

            {supportInfo.whatsapp && (
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">WhatsApp</p>
                  <a 
                    href={`https://wa.me/${supportInfo.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {supportInfo.whatsapp}
                  </a>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
              Nossa equipe responde em até 24 horas úteis.
            </p>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowFallback(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SupportButton;

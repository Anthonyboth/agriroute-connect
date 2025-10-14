import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { Loader2, Link2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface CompanyInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CompanyInviteModal: React.FC<CompanyInviteModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { createInvite } = useTransportCompany();
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleGenerateLink = async () => {
    setIsLoading(true);

    try {
      const invite = await createInvite({ invite_type: 'LINK' });
      const link = `https://www.agriroute-connect.com.br/company-invite/${invite.invite_code}`;
      console.log('Link de convite gerado:', link);
      setGeneratedLink(link);
      toast.success('Link gerado com sucesso! Compartilhe com os motoristas.');
    } catch (error) {
      console.error('Erro ao gerar link:', error);
      toast.error('Erro ao gerar link de convite');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success('Link copiado! Envie para os motoristas via WhatsApp, SMS ou email.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Convidar Motoristas</DialogTitle>
          <DialogDescription>
            Gere um link de convite para compartilhar com motoristas via WhatsApp, SMS ou email.
            Ao se cadastrar, o motorista ficará automaticamente vinculado à sua transportadora.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O link de convite permite que motoristas se cadastrem e sejam vinculados automaticamente à sua transportadora.
          </p>

          {!generatedLink ? (
            <Button onClick={handleGenerateLink} disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando Link...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Gerar Link de Convite
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-lg break-all text-sm font-mono">
                {generatedLink}
              </div>
              <Button
                onClick={() => copyToClipboard(generatedLink)}
                variant="outline"
                className="w-full"
              >
                {copiedLink ? (
                  <>
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                    Link Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Link
                  </>
                )}
              </Button>
              <Button
                onClick={() => setGeneratedLink(null)}
                variant="ghost"
                size="sm"
                className="w-full"
              >
                Gerar Novo Link
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

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
  const { createInvite, company } = useTransportCompany();
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSimpleLink, setCopiedSimpleLink] = useState(false);
  
  const simpleSignupLink = company ? `https://www.agriroute-connect.com.br/cadastro-afiliado/${company.id}` : null;

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

        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Opção 1: Link Simples (Recomendado)</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Link direto para cadastro - mais fácil de compartilhar via WhatsApp.
              </p>
              {simpleSignupLink && (
                <div className="space-y-3">
                  <div className="p-3 bg-muted rounded-lg break-all text-sm font-mono">
                    {simpleSignupLink}
                  </div>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(simpleSignupLink);
                      setCopiedSimpleLink(true);
                      setTimeout(() => setCopiedSimpleLink(false), 2000);
                      toast.success('Link copiado! Envie para os motoristas via WhatsApp.');
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    {copiedSimpleLink ? (
                      <>
                        <Check className="mr-2 h-4 w-4 text-green-500" />
                        Link Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar Link Simples
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Opção 2: Link com Código</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Gera um código único de convite.
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
                      Gerar Link com Código
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

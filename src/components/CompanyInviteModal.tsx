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
  const { createInvite, createDriverInvite, company } = useTransportCompany();
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedSafeLink, setGeneratedSafeLink] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSafeLink, setCopiedSafeLink] = useState(false);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);

  const handleGenerateLink = async () => {
    setIsLoading(true);

    try {
      const invite = await createInvite({ invite_type: 'LINK' });
      const link = `https://www.agriroute-connect.com.br/company-invite/${invite.invite_code}`;
      const safeLink = `https://www.agriroute-connect.com.br/?invite=${invite.invite_code}`;
      console.log('Link de convite gerado:', link);
      console.log('Link seguro gerado:', safeLink);
      setGeneratedLink(link);
      setGeneratedSafeLink(safeLink);
      toast.success('Links gerados com sucesso! Use o Link Seguro (recomendado).');
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
            Escolha o método para convidar motoristas à sua transportadora.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            {/* Novo Sistema de Convite com Token */}
            <div className="border-2 border-primary/50 rounded-lg p-4 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold">✅ Link de Convite Direto</h3>
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">RECOMENDADO</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Link direto para cadastro com validação de token e vinculação automática
              </p>
              {!inviteLink ? (
                <Button 
                  onClick={async () => {
                    setIsLoading(true);
                    try {
                      const result = await createDriverInvite.mutateAsync();
                      const link = `https://www.agriroute-connect.com.br/cadastro-motorista?inviteToken=${result.token}`;
                      setInviteLink(link);
                      navigator.clipboard.writeText(link);
                      toast.success('Link de convite copiado!');
                    } catch (error) {
                      console.error('Erro:', error);
                    } finally {
                      setIsLoading(false);
                    }
                  }} 
                  disabled={isLoading || createDriverInvite.isPending}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {isLoading || createDriverInvite.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando link...
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
                  <div className="p-3 bg-background rounded-lg break-all text-sm font-mono border-2 border-primary/30">
                    {inviteLink}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink);
                        setCopiedInviteLink(true);
                        setTimeout(() => setCopiedInviteLink(false), 2000);
                        toast.success('Link copiado novamente!');
                      }}
                      className="flex-1"
                      size="sm"
                    >
                      {copiedInviteLink ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => setInviteLink(null)}
                      variant="outline"
                      size="sm"
                    >
                      Novo Link
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ✓ Válido por 7 dias. Envie para o motorista via WhatsApp, SMS ou email.
                  </p>
                </div>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">método alternativo</span>
              </div>
            </div>

            {/* Links de Aceite - Sistema Legado */}
            <div className="opacity-80">
              <h3 className="text-sm font-semibold mb-2">Links de Aceite (Sistema Legado)</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Links que exigem aceite explícito do motorista
              </p>
              {!generatedLink ? (
                <Button onClick={handleGenerateLink} disabled={isLoading} variant="outline" className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando Links...
                    </>
                  ) : (
                    <>
                      <Link2 className="mr-2 h-4 w-4" />
                      Gerar Link com Código
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-4">
                  {/* Link Seguro com Código */}
                  <div className="border rounded-lg p-3 bg-muted/50">
                    <span className="text-xs font-semibold mb-1 block">Link Seguro</span>
                    <div className="p-2 bg-background rounded-lg break-all text-xs font-mono mb-2">
                      {generatedSafeLink}
                    </div>
                    <Button
                      onClick={() => {
                        if (generatedSafeLink) {
                          navigator.clipboard.writeText(generatedSafeLink);
                          setCopiedSafeLink(true);
                          setTimeout(() => setCopiedSafeLink(false), 2000);
                          toast.success('Link copiado!');
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      {copiedSafeLink ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Link Direto */}
                  <div className="opacity-70">
                    <span className="text-xs font-semibold mb-1 block">Link Direto</span>
                    <div className="p-2 bg-muted rounded-lg break-all text-xs font-mono mb-2">
                      {generatedLink}
                    </div>
                    <Button
                      onClick={() => copyToClipboard(generatedLink || '')}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar
                        </>
                      )}
                    </Button>
                  </div>

                  <Button
                    onClick={() => {
                      setGeneratedLink(null);
                      setGeneratedSafeLink(null);
                    }}
                    variant="ghost"
                    size="sm"
                    className="w-full"
                  >
                    Gerar Novos Links
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

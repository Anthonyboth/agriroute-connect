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
  const [generatedSafeLink, setGeneratedSafeLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSafeLink, setCopiedSafeLink] = useState(false);
  const [copiedSimpleLink, setCopiedSimpleLink] = useState(false);
  const [copiedSimpleSafeLink, setCopiedSimpleSafeLink] = useState(false);
  
  const simpleSignupLink = company ? `https://www.agriroute-connect.com.br/cadastro-afiliado/${company.id}` : null;
  const simpleSafeSignupLink = company ? `https://www.agriroute-connect.com.br/?cadastro_afiliado=${company.id}` : null;

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
            Gere um link de convite para compartilhar com motoristas via WhatsApp, SMS ou email.
            Ao se cadastrar, o motorista ficará automaticamente vinculado à sua transportadora.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            {/* Link Seguro Simples - RECOMENDADO */}
            <div className="border-2 border-primary/50 rounded-lg p-4 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold">✅ Link Seguro - RECOMENDADO</h3>
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">MELHOR OPÇÃO</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Link garantido que funciona em qualquer situação. Use este!
              </p>
              {simpleSafeSignupLink && (
                <div className="space-y-3">
                  <div className="p-3 bg-background rounded-lg break-all text-sm font-mono border-2 border-primary/30">
                    {simpleSafeSignupLink}
                  </div>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(simpleSafeSignupLink);
                      setCopiedSimpleSafeLink(true);
                      setTimeout(() => setCopiedSimpleSafeLink(false), 2000);
                      toast.success('Link Seguro copiado! 🎉 Envie para os motoristas.');
                    }}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    {copiedSimpleSafeLink ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Link Seguro Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar Link Seguro
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
                <span className="bg-background px-2 text-muted-foreground">alternativa</span>
              </div>
            </div>

            {/* Link Simples Alternativo */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Link Direto (alternativo)</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Pode não funcionar se houver problemas de DNS.
              </p>
              {simpleSignupLink && (
                <div className="space-y-3">
                  <div className="p-3 bg-muted rounded-lg break-all text-sm font-mono opacity-70">
                    {simpleSignupLink}
                  </div>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(simpleSignupLink);
                      setCopiedSimpleLink(true);
                      setTimeout(() => setCopiedSimpleLink(false), 2000);
                      toast.success('Link alternativo copiado.');
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
                        Copiar Link Alternativo
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

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Opção 2: Link com Código Único</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Gera um código único de convite com rastreamento.
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
                  {/* Link Seguro com Código - RECOMENDADO */}
                  <div className="border-2 border-primary/50 rounded-lg p-3 bg-primary/5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold">✅ Link Seguro com Código</span>
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">RECOMENDADO</span>
                    </div>
                    <div className="p-2 bg-background rounded-lg break-all text-xs font-mono border-2 border-primary/30 mb-2">
                      {generatedSafeLink}
                    </div>
                    <Button
                      onClick={() => {
                        if (generatedSafeLink) {
                          navigator.clipboard.writeText(generatedSafeLink);
                          setCopiedSafeLink(true);
                          setTimeout(() => setCopiedSafeLink(false), 2000);
                          toast.success('Link Seguro copiado! 🎉');
                        }
                      }}
                      className="w-full bg-primary hover:bg-primary/90"
                      size="sm"
                    >
                      {copiedSafeLink ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Link Seguro Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar Link Seguro
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Link Direto Alternativo */}
                  <div className="opacity-70">
                    <span className="text-xs font-semibold mb-1 block">Link Direto (alternativo)</span>
                    <div className="p-2 bg-muted rounded-lg break-all text-xs font-mono mb-2">
                      {generatedLink}
                    </div>
                    <Button
                      onClick={() => copyToClipboard(generatedLink)}
                      variant="outline"
                      size="sm"
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
                          Copiar Link Alternativo
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

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { Loader2, Mail, Link2, Hash, Copy, Check } from 'lucide-react';
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
  const [email, setEmail] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleInviteByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await createInvite({
        invite_type: 'EMAIL',
        invited_email: email,
      });
      setEmail('');
      toast.success('Convite enviado por email!');
    } catch (error) {
      console.error('Erro ao enviar convite:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    setIsLoading(true);

    try {
      const invite = await createInvite({ invite_type: 'CODE' });
      setGeneratedCode(invite.invite_code);
      toast.success('Código gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar código:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    setIsLoading(true);

    try {
      const invite = await createInvite({ invite_type: 'LINK' });
      const link = `${window.location.origin}/company-invite/${invite.invite_code}`;
      setGeneratedLink(link);
      toast.success('Link gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar link:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'code' | 'link') => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
    toast.success('Copiado!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Convidar Motoristas</DialogTitle>
          <DialogDescription>
            Escolha como deseja convidar motoristas para sua transportadora
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="email" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="email">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </TabsTrigger>
            <TabsTrigger value="link">
              <Link2 className="h-4 w-4 mr-2" />
              Link
            </TabsTrigger>
            <TabsTrigger value="code">
              <Hash className="h-4 w-4 mr-2" />
              Código
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4">
            <form onSubmit={handleInviteByEmail} className="space-y-4">
              <div>
                <Label htmlFor="email">Email do Motorista</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="motorista@exemplo.com"
                  required
                />
              </div>

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar Convite por Email
                  </>
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="link" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Gere um link de convite que você pode compartilhar por WhatsApp, SMS ou outras plataformas
            </p>

            {!generatedLink ? (
              <Button onClick={handleGenerateLink} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
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
                <div className="p-3 bg-muted rounded-lg break-all text-sm">
                  {generatedLink}
                </div>
                <Button
                  onClick={() => copyToClipboard(generatedLink, 'link')}
                  variant="outline"
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
          </TabsContent>

          <TabsContent value="code" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Gere um código que o motorista pode usar para se juntar à sua transportadora
            </p>

            {!generatedCode ? (
              <Button onClick={handleGenerateCode} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Hash className="mr-2 h-4 w-4" />
                    Gerar Código de Convite
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="p-6 bg-muted rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-2">Código de Convite</p>
                  <p className="text-3xl font-bold tracking-wider">{generatedCode}</p>
                </div>
                <Button
                  onClick={() => copyToClipboard(generatedCode, 'code')}
                  variant="outline"
                  className="w-full"
                >
                  {copiedCode ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar Código
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setGeneratedCode(null)}
                  variant="ghost"
                  size="sm"
                  className="w-full"
                >
                  Gerar Novo Código
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

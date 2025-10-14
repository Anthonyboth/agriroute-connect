import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { Loader2, Link2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { CompanyInvitesList } from './CompanyInvitesList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CompanyInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CompanyInviteModal: React.FC<CompanyInviteModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { company } = useTransportCompany();
  const [affiliatedInviteLink, setAffiliatedInviteLink] = useState<string | null>(null);
  const [copiedAffiliatedLink, setCopiedAffiliatedLink] = useState(false);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convidar Motoristas</DialogTitle>
          <DialogDescription>
            Gere links de convite e acompanhe o status dos convites enviados.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Criar Convite</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-6 mt-4">
            <div className="space-y-4">
            {/* Link para Motorista Afiliado */}
            <div className="border-2 border-primary/50 rounded-lg p-4 bg-primary/5">
              <div className="mb-2">
                <h3 className="text-sm font-semibold">Link de Convite para Motorista Afiliado</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Compartilhe este link para que motoristas se cadastrem automaticamente como afiliados da sua transportadora
              </p>
              {!affiliatedInviteLink ? (
                <Button 
                  onClick={() => {
                    if (company?.company_cnpj) {
                      const link = `https://www.agriroute-connect.com.br/cadastro-motorista-afiliado?companyCNPJ=${company.company_cnpj}`;
                      setAffiliatedInviteLink(link);
                      navigator.clipboard.writeText(link);
                      toast.success('Link copiado! Envie para os motoristas via WhatsApp, SMS ou email.');
                    } else {
                      toast.error('CNPJ da empresa não encontrado');
                    }
                  }}
                  disabled={!company?.company_cnpj}
                  className="w-full"
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Gerar Link para Afiliado
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-background rounded-lg break-all text-sm font-mono border-2 border-primary/30">
                    {affiliatedInviteLink}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(affiliatedInviteLink);
                        setCopiedAffiliatedLink(true);
                        setTimeout(() => setCopiedAffiliatedLink(false), 2000);
                        toast.success('Link copiado novamente!');
                      }}
                      className="flex-1"
                      size="sm"
                    >
                      {copiedAffiliatedLink ? (
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
                      onClick={() => setAffiliatedInviteLink(null)}
                      variant="outline"
                      size="sm"
                    >
                      Novo Link
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    💡 O motorista será automaticamente vinculado como afiliado à sua empresa
                  </p>
                </div>
              )}
            </div>
          </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <CompanyInvitesList />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

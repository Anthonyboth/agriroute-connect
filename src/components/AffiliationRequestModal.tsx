import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building2, Link2, Hash, AlertCircle, Loader2 } from 'lucide-react';

interface AffiliationRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: any;
}

export const AffiliationRequestModal: React.FC<AffiliationRequestModalProps> = ({
  isOpen,
  onClose,
  currentProfile
}) => {
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [activeTab, setActiveTab] = useState('url');

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 14) {
      return numbers
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return value;
  };

  const checkExistingAffiliation = async () => {
    const { data } = await supabase
      .from('company_drivers')
      .select('id, status, company:company_id(company_name)')
      .eq('driver_profile_id', currentProfile.id)
      .in('status', ['ACTIVE', 'PENDING'])
      .maybeSingle();

    return data;
  };

  const validateInvite = async (code: string) => {
    const { data, error } = await supabase
      .from('company_invites')
      .select('*, company:company_id(id, company_name, company_cnpj)')
      .eq('invite_code', code)
      .eq('status', 'PENDING')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data;
  };

  const createAffiliationRequest = async (companyId: string) => {
    const { error } = await supabase
      .from('company_drivers')
      .insert({
        company_id: companyId,
        driver_profile_id: currentProfile.id,
        status: 'PENDING',
        affiliation_type: 'AFFILIATED',
        can_accept_freights: false,
        can_manage_vehicles: false
      });

    if (error) throw error;

    // Notificar transportadora
    const { data: companyData } = await supabase
      .from('transport_companies')
      .select('profile_id')
      .eq('id', companyId)
      .single();

    if (companyData?.profile_id) {
      await supabase.from('notifications').insert({
        user_id: companyData.profile_id,
        title: 'Nova Solicitação de Afiliação',
        message: `${currentProfile.full_name} solicitou afiliação à sua transportadora`,
        type: 'affiliation_request',
        data: {
          driver_id: currentProfile.id,
          driver_name: currentProfile.full_name
        }
      });
    }
  };

  const handleUrlSubmit = async () => {
    setLoading(true);
    try {
      // Verificar afiliação existente
      const existing = await checkExistingAffiliation();
      if (existing) {
        const statusMsg = existing.status === 'ACTIVE' 
          ? `Você já está afiliado à ${existing.company?.company_name}`
          : `Você já tem uma solicitação pendente`;
        toast.error(statusMsg);
        setLoading(false);
        return;
      }

      // Extrair código do convite da URL
      const urlMatch = inviteUrl.match(/\/convite\/([a-zA-Z0-9]+)$/);
      if (!urlMatch) {
        toast.error('URL de convite inválida');
        setLoading(false);
        return;
      }

      const code = urlMatch[1];
      const invite = await validateInvite(code);

      if (!invite) {
        toast.error('Convite inválido ou expirado');
        setLoading(false);
        return;
      }

      await createAffiliationRequest(invite.company_id);
      
      toast.success(`Solicitação enviada para ${invite.company.company_name}!`);
      onClose();
    } catch (error: any) {
      console.error('Erro ao solicitar afiliação:', error);
      toast.error('Erro ao enviar solicitação');
    } finally {
      setLoading(false);
    }
  };

  const handleCnpjSubmit = async () => {
    setLoading(true);
    try {
      // Verificar afiliação existente
      const existing = await checkExistingAffiliation();
      if (existing) {
        const statusMsg = existing.status === 'ACTIVE' 
          ? `Você já está afiliado à ${existing.company?.company_name}`
          : `Você já tem uma solicitação pendente`;
        toast.error(statusMsg);
        setLoading(false);
        return;
      }

      // Limpar CNPJ
      const cleanCnpj = cnpj.replace(/\D/g, '');
      if (cleanCnpj.length !== 14) {
        toast.error('CNPJ inválido');
        setLoading(false);
        return;
      }

      // Buscar empresa por CNPJ
      const { data: companyData, error } = await supabase
        .rpc('find_company_by_cnpj', { p_cnpj: cleanCnpj });

      if (error || !companyData || companyData.length === 0) {
        toast.error('Empresa não encontrada');
        setLoading(false);
        return;
      }

      const company = companyData[0];
      await createAffiliationRequest(company.id);
      
      toast.success(`Solicitação enviada para ${company.company_name}!`);
      onClose();
    } catch (error: any) {
      console.error('Erro ao solicitar afiliação:', error);
      toast.error('Erro ao enviar solicitação');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async () => {
    setLoading(true);
    try {
      // Verificar afiliação existente
      const existing = await checkExistingAffiliation();
      if (existing) {
        const statusMsg = existing.status === 'ACTIVE' 
          ? `Você já está afiliado à ${existing.company?.company_name}`
          : `Você já tem uma solicitação pendente`;
        toast.error(statusMsg);
        setLoading(false);
        return;
      }

      const invite = await validateInvite(inviteCode.trim());

      if (!invite) {
        toast.error('Código de convite inválido ou expirado');
        setLoading(false);
        return;
      }

      await createAffiliationRequest(invite.company_id);
      
      toast.success(`Solicitação enviada para ${invite.company.company_name}!`);
      onClose();
    } catch (error: any) {
      console.error('Erro ao solicitar afiliação:', error);
      toast.error('Erro ao enviar solicitação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Solicitar Afiliação a Transportadora</DialogTitle>
          <DialogDescription>
            Escolha uma das formas abaixo para enviar sua solicitação
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="url" className="text-xs">
              <Link2 className="h-4 w-4 mr-1" />
              URL
            </TabsTrigger>
            <TabsTrigger value="cnpj" className="text-xs">
              <Building2 className="h-4 w-4 mr-1" />
              CNPJ
            </TabsTrigger>
            <TabsTrigger value="code" className="text-xs">
              <Hash className="h-4 w-4 mr-1" />
              Código
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Cole o link completo do convite que você recebeu
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="invite-url">URL do Convite</Label>
              <Input
                id="invite-url"
                placeholder="https://agriroute.com/convite/ABC123XY"
                value={inviteUrl}
                onChange={(e) => setInviteUrl(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button 
              onClick={handleUrlSubmit} 
              className="w-full"
              disabled={loading || !inviteUrl.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Solicitação'
              )}
            </Button>
          </TabsContent>

          <TabsContent value="cnpj" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Digite o CNPJ da transportadora que você deseja se afiliar
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ da Transportadora</Label>
              <Input
                id="cnpj"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                maxLength={18}
                disabled={loading}
              />
            </div>

            <Button 
              onClick={handleCnpjSubmit} 
              className="w-full"
              disabled={loading || cnpj.replace(/\D/g, '').length !== 14}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando empresa...
                </>
              ) : (
                'Enviar Solicitação'
              )}
            </Button>
          </TabsContent>

          <TabsContent value="code" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Digite o código de convite (8 caracteres)
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="invite-code">Código de Convite</Label>
              <Input
                id="invite-code"
                placeholder="ABC123XY"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                maxLength={8}
                disabled={loading}
                className="font-mono text-lg tracking-wider"
              />
            </div>

            <Button 
              onClick={handleCodeSubmit} 
              className="w-full"
              disabled={loading || inviteCode.trim().length < 6}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Solicitação'
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

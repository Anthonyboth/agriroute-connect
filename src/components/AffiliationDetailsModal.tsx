import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { useAffiliationDetails } from '@/hooks/useAffiliationDetails';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AffiliationDirectChat } from '@/components/AffiliationDirectChat';
import { 
  Building2, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Loader2, 
  AlertTriangle,
  MapPin,
  FileText,
  LogOut,
  MessageSquare,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AffiliationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AffiliationDetailsModal: React.FC<AffiliationDetailsModalProps> = ({ isOpen, onClose }) => {
  const { profile } = useAuth();
  const { affiliationDetails, isLoading, hasAffiliation } = useAffiliationDetails();
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const queryClient = useQueryClient();

  const formatCnpj = (cnpj: string) => {
    if (!cnpj) return '';
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const handleLeaveCompany = async () => {
    if (!profile?.id || !affiliationDetails?.companyId) {
      toast.error('Dados incompletos. Atualize a página e tente novamente.');
      return;
    }

    setIsLeaving(true);

    try {
      const { data, error } = await supabase
        .from('company_drivers')
        .update({ 
          status: 'INACTIVE',
          left_at: new Date().toISOString()
        })
        .eq('driver_profile_id', profile.id)
        .eq('company_id', affiliationDetails.companyId)
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        throw new Error('Não foi possível sair da transportadora. Verifique suas permissões.');
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'MOTORISTA' })
        .eq('id', profile.id);

      if (profileError) console.warn('Erro ao atualizar role:', profileError);

      queryClient.invalidateQueries({ queryKey: ['affiliation-details'] });
      queryClient.invalidateQueries({ queryKey: ['company-driver'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });

      toast.success(`Você saiu da ${affiliationDetails.companyName}`);
      setShowLeaveConfirmation(false);
      onClose();
    } catch (error: any) {
      console.error('Erro ao sair da transportadora:', error);
      toast.error(error?.message || 'Erro ao sair da transportadora');
    } finally {
      setIsLeaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-500/10 text-green-700 border-green-500/20">Ativo</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20">Pendente</Badge>;
      case 'INACTIVE':
        return <Badge className="bg-gray-500/10 text-gray-700 border-gray-500/20">Inativo</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'AFFILIATED':
        return <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/20">Afiliado</Badge>;
      case 'EMPLOYEE':
        return <Badge className="bg-purple-500/10 text-purple-700 border-purple-500/20">Funcionário</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Building2 className="h-6 w-6 text-primary" />
              Minha Afiliação
            </DialogTitle>
            <DialogDescription>
              Informações sobre sua afiliação com a transportadora
            </DialogDescription>
          </DialogHeader>

          {isLoading && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Carregando informações...</p>
            </div>
          )}

          {!isLoading && !hasAffiliation && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Sem Afiliação</AlertTitle>
              <AlertDescription>
                Você não está afiliado a nenhuma transportadora no momento.
              </AlertDescription>
            </Alert>
          )}

          {!isLoading && affiliationDetails && (
            <div className="space-y-4">
              {/* Informações da Transportadora */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="h-5 w-5 text-primary" />
                    Informações da Transportadora
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Nome</p>
                    <p className="text-base font-semibold">{affiliationDetails.companyName}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">CNPJ</p>
                    <p className="text-base">{formatCnpj(affiliationDetails.companyCnpj)}</p>
                  </div>

                  {affiliationDetails.companyAntt && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">ANTT</p>
                      <p className="text-base">{affiliationDetails.companyAntt}</p>
                    </div>
                  )}

                  {(affiliationDetails.companyAddress || affiliationDetails.companyCity) && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Endereço
                      </p>
                      <p className="text-base">
                        {affiliationDetails.companyAddress && `${affiliationDetails.companyAddress}, `}
                        {affiliationDetails.companyCity}
                        {affiliationDetails.companyState && ` - ${affiliationDetails.companyState}`}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Contatos do Responsável */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="h-5 w-5 text-primary" />
                    Contatos do Responsável
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Nome</p>
                    <p className="text-base font-semibold">
                      {affiliationDetails.ownerName && affiliationDetails.ownerName !== 'Não informado'
                        ? affiliationDetails.ownerName
                        : <span className="text-muted-foreground italic">Não informado</span>
                      }
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    {affiliationDetails.ownerEmail && affiliationDetails.ownerEmail !== 'Não informado' && (
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <a href={`mailto:${affiliationDetails.ownerEmail}`}>
                          <Mail className="h-4 w-4 mr-2" />
                          {affiliationDetails.ownerEmail}
                        </a>
                      </Button>
                    )}
                    
                    {affiliationDetails.ownerPhone && (
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <a href={`tel:${affiliationDetails.ownerPhone}`}>
                          <Phone className="h-4 w-4 mr-2" />
                          {formatPhone(affiliationDetails.ownerPhone)}
                        </a>
                      </Button>
                    )}

                    {!affiliationDetails.ownerEmail && !affiliationDetails.ownerPhone && affiliationDetails.ownerName === 'Não informado' && (
                      <p className="text-sm text-muted-foreground italic">
                        Dados de contato não disponíveis
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Chat Permanente com a Transportadora */}
              <Card className="border-primary/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      Chat com a Transportadora
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowChat(!showChat)}
                      className="h-8"
                    >
                      {showChat ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-1" />
                          Ocultar
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          Abrir Chat
                        </>
                      )}
                    </Button>
                  </div>
                  {!showChat && (
                    <p className="text-sm text-muted-foreground">
                      Canal de comunicação permanente — sempre ativo enquanto você estiver afiliado
                    </p>
                  )}
                </CardHeader>
                {showChat && (
                  <CardContent className="pt-0">
                    <AffiliationDirectChat
                      companyId={affiliationDetails.companyId}
                      companyName={affiliationDetails.companyName}
                    />
                  </CardContent>
                )}
              </Card>

              {/* Status da Afiliação */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-primary" />
                    Status da Afiliação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {getTypeBadge(affiliationDetails.affiliationType)}
                    {getStatusBadge(affiliationDetails.status)}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Afiliado desde
                    </p>
                    <p className="text-base">{formatDate(affiliationDetails.affiliatedAt)}</p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Permissões:</p>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        {affiliationDetails.canAcceptFreights ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={affiliationDetails.canAcceptFreights ? 'text-foreground' : 'text-muted-foreground'}>
                          Aceitar fretes
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {affiliationDetails.canManageVehicles ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={affiliationDetails.canManageVehicles ? 'text-foreground' : 'text-muted-foreground'}>
                          Gerenciar veículos
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Botão Sair da Transportadora */}
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setShowLeaveConfirmation(true)}
                disabled={isLeaving || isLoading || !affiliationDetails}
              >
                {isLeaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saindo...
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair da Transportadora
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação de Saída */}
      <AlertDialog open={showLeaveConfirmation} onOpenChange={setShowLeaveConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Deseja sair da transportadora?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você perderá acesso aos fretes e veículos da <strong>{affiliationDetails?.companyName}</strong>. 
              Esta ação não pode ser desfeita e você precisará ser convidado novamente para voltar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveCompany}
              disabled={isLeaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLeaving ? 'Saindo...' : 'Confirmar Saída'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

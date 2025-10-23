import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { useAffiliationDetails } from '@/hooks/useAffiliationDetails';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { toast } from 'sonner';
import { 
  Building2, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  Check, 
  X, 
  Loader2, 
  AlertTriangle,
  MapPin,
  FileText,
  LogOut
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AffiliationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AffiliationDetailsModal: React.FC<AffiliationDetailsModalProps> = ({ isOpen, onClose }) => {
  const { affiliationDetails, isLoading, hasAffiliation } = useAffiliationDetails();
  const { leaveCompany } = useTransportCompany();
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);

  const formatCnpj = (cnpj: string) => {
    if (!cnpj) return '';
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    return phone.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const handleLeaveCompany = () => {
    leaveCompany.mutate(undefined, {
      onSuccess: () => {
        toast.success(`Você saiu da ${affiliationDetails?.companyName}`);
        setShowLeaveConfirmation(false);
        onClose();
      },
      onError: (error: any) => {
        toast.error(error?.message || 'Erro ao sair da transportadora');
      }
    });
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
                    <p className="text-base font-semibold">{affiliationDetails.ownerName}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    {affiliationDetails.ownerEmail && (
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
                  </div>
                </CardContent>
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
                disabled={leaveCompany.isPending}
              >
                {leaveCompany.isPending ? (
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
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveCompany}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Saída
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

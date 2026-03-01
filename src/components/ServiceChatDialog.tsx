import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Phone, UserX, MessageSquare } from 'lucide-react';
import { ServiceChat } from '@/components/ServiceChat';

interface ServiceChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  serviceRequest: any;
  currentUserProfile: any;
}

export const ServiceChatDialog: React.FC<ServiceChatDialogProps> = ({
  isOpen,
  onClose,
  serviceRequest,
  currentUserProfile,
}) => {
  const isGuestClient = !serviceRequest.client_id;
  
  const getWhatsAppUrl = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    return `https://wa.me/55${cleanPhone}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Chat do Serviço
            {isGuestClient && (
              <Badge variant="destructive" className="ml-2">
                <UserX className="h-3 w-3 mr-1" />
                Cliente não cadastrado
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {isGuestClient ? (
            <div className="space-y-4">
              <Alert variant="destructive" className="border-2">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle className="text-lg font-semibold">
                  Chat Indisponível
                </AlertTitle>
                <AlertDescription className="mt-2 space-y-3">
                  <p>
                    Este cliente solicitou o serviço <strong>sem criar uma conta</strong> na plataforma.
                  </p>
                  <p>
                    O sistema de chat interno só está disponível para clientes cadastrados.
                  </p>
                  <div className="bg-destructive/10 p-3 rounded-md mt-3">
                    <p className="font-semibold text-sm mb-2">
                      💡 Como contatar o cliente:
                    </p>
                    <p className="text-sm">
                      Use o WhatsApp para entrar em contato diretamente com o cliente.
                      As informações de contato estão disponíveis nos detalhes do serviço.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 p-6 rounded-lg border-2 border-green-200 dark:border-green-800">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Phone className="h-5 w-5 text-green-600" />
                  Contato via WhatsApp
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Nome do cliente:</p>
                    <p className="font-medium">{serviceRequest.contact_name || 'Cliente'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Telefone:</p>
                    <p className="font-medium">{serviceRequest.contact_phone}</p>
                  </div>
                  <Button
                    onClick={() => window.open(getWhatsAppUrl(serviceRequest.contact_phone), '_blank')}
                    className="w-full bg-green-600 hover:bg-green-700 mt-3"
                    size="lg"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Abrir WhatsApp
                  </Button>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 overflow-hidden min-h-0">
              <ServiceChat
                serviceRequestId={serviceRequest.id}
                currentUserProfile={currentUserProfile}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

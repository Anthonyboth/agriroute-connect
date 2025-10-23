import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, AlertCircle } from 'lucide-react';

interface DocumentRequestModalProps {
  request: any;
  isOpen: boolean;
  onClose: () => void;
  onGoToProfile?: () => void;
}

// Mapa de campos (importar do outro componente se necessário)
const FIELD_LABELS: Record<string, string> = {
  full_name: 'Nome Completo',
  cpf_cnpj: 'CPF/CNPJ',
  contact_phone: 'Telefone',
  profile_photo_url: 'Foto de Perfil',
  selfie_url: 'Selfie',
  cnh_photo_url: 'Foto da CNH',
  document_photo_url: 'Foto do Documento',
  cnh_category: 'Categoria da CNH',
  cnh_expiry_date: 'Validade da CNH',
  rntrc: 'RNTRC',
  address_street: 'Rua',
  address_number: 'Número',
  address_city: 'Cidade',
  address_state: 'Estado',
  address_zip: 'CEP',
  emergency_contact_name: 'Nome Contato Emergência',
  emergency_contact_phone: 'Telefone Contato Emergência',
};

export const DocumentRequestModal = ({ 
  request, 
  isOpen, 
  onClose,
  onGoToProfile 
}: DocumentRequestModalProps) => {
  const requestedFields = (request?.requested_fields || []) as string[];

  const handleGoToProfile = () => {
    onClose();
    if (onGoToProfile) {
      onGoToProfile();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            Documentos Solicitados
          </DialogTitle>
          <DialogDescription>
            A transportadora solicitou que você complete as seguintes informações:
          </DialogDescription>
        </DialogHeader>

        <Card>
          <CardContent className="pt-6 space-y-3">
            {requestedFields.map(field => (
              <div key={field} className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {FIELD_LABELS[field] || field}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {request?.notes && (
          <Alert>
            <AlertDescription>
              <strong>Observações:</strong>
              <p className="mt-1 text-sm">{request.notes}</p>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Depois
          </Button>
          <Button onClick={handleGoToProfile} className="flex-1">
            Completar Agora
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

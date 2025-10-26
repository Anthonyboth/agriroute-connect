import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, AlertCircle, CheckCircle } from 'lucide-react';

interface DocumentRequestCardProps {
  requestData: {
    requested_fields: string[];
    notes?: string;
    company_name?: string;
    status: string;
    created_at?: string;
  };
  onGoToProfile?: () => void;
  onReplyInChat?: () => void;
}

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

export const DocumentRequestCard = ({ 
  requestData, 
  onGoToProfile,
  onReplyInChat
}: DocumentRequestCardProps) => {
  const isCompleted = requestData.status === 'COMPLETED';

  return (
    <Card className={`border-2 ${isCompleted ? 'border-success bg-success/5' : 'border-warning bg-warning/5'}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {isCompleted ? (
            <>
              <CheckCircle className="h-5 w-5 text-success" />
              Documentos Completados
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-warning" />
              Documentos Solicitados
            </>
          )}
        </CardTitle>
        {requestData.company_name && (
          <p className="text-sm text-muted-foreground">
            Por: {requestData.company_name}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Campos solicitados:</h4>
          <div className="grid gap-2">
            {requestData.requested_fields.map(field => (
              <div key={field} className="flex items-center gap-2 p-2 rounded-md bg-card">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm">
                  {FIELD_LABELS[field] || field}
                </span>
              </div>
            ))}
          </div>
        </div>

        {requestData.notes && (
          <Alert>
            <AlertDescription>
              <strong>Observações:</strong>
              <p className="mt-1 text-sm whitespace-pre-wrap">{requestData.notes}</p>
            </AlertDescription>
          </Alert>
        )}

        {!isCompleted && (
          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={onReplyInChat}
              className="flex-1"
              size="sm"
            >
              Responder no Chat
            </Button>
            <Button 
              onClick={onGoToProfile}
              className="flex-1"
              size="sm"
            >
              Completar Agora
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

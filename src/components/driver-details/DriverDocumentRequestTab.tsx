import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  FileText, 
  Image, 
  Send,
  AlertCircle,
  Loader2 
} from 'lucide-react';
import { useDocumentRequest } from '@/hooks/useDocumentRequest';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DriverDocumentRequestTabProps {
  driverData: any;
  companyId: string;
}

// Mapa de campos com labels amigáveis
const DRIVER_FIELDS: Record<string, { label: string; icon: any; category: string }> = {
  // Dados Pessoais
  full_name: { label: 'Nome Completo', icon: FileText, category: 'Dados Pessoais' },
  cpf_cnpj: { label: 'CPF/CNPJ', icon: FileText, category: 'Dados Pessoais' },
  contact_phone: { label: 'Telefone de Contato', icon: FileText, category: 'Dados Pessoais' },
  
  // Fotos
  profile_photo_url: { label: 'Foto de Perfil', icon: Image, category: 'Fotos' },
  selfie_url: { label: 'Selfie', icon: Image, category: 'Fotos' },
  
  // Documentos
  cnh_photo_url: { label: 'Foto da CNH', icon: Image, category: 'Documentos' },
  document_photo_url: { label: 'Foto do Documento', icon: Image, category: 'Documentos' },
  
  // CNH
  cnh_category: { label: 'Categoria da CNH', icon: FileText, category: 'CNH' },
  cnh_expiry_date: { label: 'Validade da CNH', icon: FileText, category: 'CNH' },
  
  // Registros
  rntrc: { label: 'RNTRC', icon: FileText, category: 'Registros' },
  
  // Endereço
  address_street: { label: 'Rua', icon: FileText, category: 'Endereço' },
  address_number: { label: 'Número', icon: FileText, category: 'Endereço' },
  address_city: { label: 'Cidade', icon: FileText, category: 'Endereço' },
  address_state: { label: 'Estado', icon: FileText, category: 'Endereço' },
  address_zip: { label: 'CEP', icon: FileText, category: 'Endereço' },
  
  // Emergência
  emergency_contact_name: { label: 'Nome Contato Emergência', icon: FileText, category: 'Emergência' },
  emergency_contact_phone: { label: 'Tel. Contato Emergência', icon: FileText, category: 'Emergência' },
};

export const DriverDocumentRequestTab = ({ 
  driverData, 
  companyId 
}: DriverDocumentRequestTabProps) => {
  const driverProfileId = driverData?.driver_profile_id || driverData?.id;
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  
  const { pendingRequest, isLoading, createRequest } = useDocumentRequest(
    companyId, 
    driverProfileId
  );

  // Buscar dados do motorista usando view segura para proteção de PII
  const { data: driverProfile } = useQuery({
    queryKey: ['driver-profile-secure', driverProfileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles_secure')
        .select('id, full_name, cpf_cnpj, phone, contact_phone, address_street, address_city, address_state, profile_photo_url, status, rating, total_ratings, created_at, updated_at, service_types, base_city_name, base_state, aprovado, validation_status')
        .eq('id', driverProfileId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!driverProfileId,
  });

  // Verificar quais campos estão preenchidos
  const isFieldFilled = (fieldName: string): boolean => {
    const value = driverProfile?.[fieldName];
    return value !== null && value !== undefined && value !== '';
  };

  // Agrupar campos por categoria
  const fieldsByCategory = Object.entries(DRIVER_FIELDS).reduce((acc, [key, field]) => {
    if (!acc[field.category]) acc[field.category] = [];
    acc[field.category].push({ key, ...field });
    return acc;
  }, {} as Record<string, any[]>);

  // Calcular estatísticas
  const totalFields = Object.keys(DRIVER_FIELDS).length;
  const filledFields = Object.keys(DRIVER_FIELDS).filter(isFieldFilled).length;
  const completionPercentage = Math.round((filledFields / totalFields) * 100);

  const handleToggleField = (fieldKey: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldKey) 
        ? prev.filter(f => f !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  const handleSelectEmpty = () => {
    const emptyFields = Object.keys(DRIVER_FIELDS).filter(key => !isFieldFilled(key));
    setSelectedFields(emptyFields);
  };

  const handleSelectAll = () => {
    setSelectedFields(Object.keys(DRIVER_FIELDS));
  };

  const handleDeselectAll = () => {
    setSelectedFields([]);
  };

  const handleSendRequest = () => {
    if (selectedFields.length === 0) {
      toast.error('Selecione pelo menos um campo');
      return;
    }

    createRequest.mutate({ fields: selectedFields, notes });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status da Completude */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Status do Perfil</span>
            <Badge variant={completionPercentage === 100 ? 'default' : 'secondary'}>
              {completionPercentage}% Completo
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Campos preenchidos: {filledFields}/{totalFields}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Solicitação Pendente */}
      {pendingRequest && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Solicitação Pendente</strong>
            <p className="text-sm mt-1">
              Você já solicitou {(pendingRequest.requested_fields as string[]).length} campos em{' '}
              {new Date(pendingRequest.requested_at).toLocaleDateString('pt-BR')}
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Ações Rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectEmpty}>
              Selecionar Vazios ({Object.keys(DRIVER_FIELDS).filter(k => !isFieldFilled(k)).length})
            </Button>
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              Selecionar Todos
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeselectAll}>
              Limpar Seleção
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Campos por Categoria */}
      {Object.entries(fieldsByCategory).map(([category, fields]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-base">{category}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {fields.map(field => {
                const filled = isFieldFilled(field.key);
                const Icon = field.icon;
                
                return (
                  <div 
                    key={field.key}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Checkbox
                        id={field.key}
                        checked={selectedFields.includes(field.key)}
                        onCheckedChange={() => handleToggleField(field.key)}
                      />
                      <Label 
                        htmlFor={field.key} 
                        className="flex items-center gap-2 cursor-pointer flex-1"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span>{field.label}</span>
                      </Label>
                    </div>
                    
                    {filled ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-300" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Observações */}
      <Card>
        <CardHeader>
          <CardTitle>Observações (Opcional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Ex: Precisamos desses documentos para liberar novos fretes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Botão de Envio */}
      <Card className="border-primary">
        <CardContent className="pt-6">
          <Button 
            className="w-full" 
            size="lg"
            onClick={handleSendRequest}
            disabled={selectedFields.length === 0 || createRequest.isPending}
          >
            {createRequest.isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                Solicitar {selectedFields.length} Informações ao Motorista
              </>
            )}
          </Button>
          <p className="text-sm text-muted-foreground text-center mt-2">
            O motorista receberá uma notificação e poderá completar os dados no perfil dele.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

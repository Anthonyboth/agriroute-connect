import React, { useState, useEffect } from 'react';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-avatar-image';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  FileText, 
  MapPin, 
  Clock, 
  DollarSign, 
  Shield, 
  CheckCircle, 
  XCircle,
  Eye,
  ExternalLink
} from 'lucide-react';

interface ServiceProvider {
  id: string;
  profile_id: string;
  service_type: string;
  service_radius_km: number;
  base_price: number | null;
  hourly_rate: number | null;
  emergency_service: boolean;
  work_hours_start: string;
  work_hours_end: string;
  works_weekends: boolean;
  works_holidays: boolean;
  equipment_description: string;
  specialties: string[] | null;
  certifications: string[] | null;
  service_area_cities: string[] | null;
  created_at: string;
  profiles: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    validation_status: string;
    profile_photo_url: string | null;
    document_rg_url: string | null;
    document_cpf_url: string | null;
    cnh_url: string | null;
    address_proof_url: string | null;
  };
}

export const AdminServiceProviderValidation: React.FC = () => {
  const { toast } = useToast();
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [validationNotes, setValidationNotes] = useState('');
  const [processingValidation, setProcessingValidation] = useState(false);

  const fetchProviders = async () => {
    try {
      const { data, error } = await supabase
        .from('service_providers')
        .select(`
          *,
          profiles!service_providers_profile_id_fkey (
            id,
            full_name,
            email,
            phone,
            validation_status,
            profile_photo_url,
            document_rg_url,
            document_cpf_url,
            cnh_url,
            address_proof_url
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProviders(data as any || []);
    } catch (error) {
      console.error('Erro ao buscar prestadores:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar prestadores de serviços",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleValidation = async (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedProvider) return;

    setProcessingValidation(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          validation_status: status,
          status: status, // Sincronizar status de acesso
          validated_at: new Date().toISOString(),
          // validated_by seria o ID do admin atual
        })
        .eq('id', selectedProvider.profile_id);

      if (error) throw error;

      // Adicionar ao histórico de validação
      const { error: historyError } = await supabase
        .from('validation_history')
        .insert({
          profile_id: selectedProvider.profile_id,
          validation_type: 'SERVICE_PROVIDER',
          status: status,
          notes: validationNotes,
          // validated_by seria o ID do admin atual
        });

      if (historyError) throw historyError;

      toast({
        title: "Sucesso",
        description: `Prestador ${status === 'APPROVED' ? 'aprovado' : 'rejeitado'} com sucesso!`,
      });

      setSelectedProvider(null);
      setValidationNotes('');
      fetchProviders();
    } catch (error) {
      console.error('Erro na validação:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar validação",
        variant: "destructive",
      });
    } finally {
      setProcessingValidation(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-500';
      case 'REJECTED': return 'bg-red-500';
      default: return 'bg-yellow-500';
    }
  };

  const openDocument = (url: string) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return <CenteredSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Validação de Prestadores de Serviços</h2>
        <Badge variant="outline">
          {providers.length} prestadores cadastrados
        </Badge>
      </div>

      <div className="grid gap-6">
        {providers.map((provider) => (
          <Card key={provider.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-12 w-12">
                    <SignedAvatarImage src={provider.profiles.profile_photo_url} />
                    <AvatarFallback>
                      <User className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{provider.profiles.full_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {provider.service_type.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge 
                    className={`${getStatusColor(provider.profiles.validation_status)} text-white`}
                  >
                    {provider.profiles.validation_status}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedProvider(provider)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Analisar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{provider.service_radius_km}km raio</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{provider.work_hours_start} - {provider.work_hours_end}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>R$ {provider.base_price || 'N/A'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>{provider.emergency_service ? '24h' : 'Comercial'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal de Detalhes */}
      <Dialog open={!!selectedProvider} onOpenChange={(open) => !open && setSelectedProvider(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Validação - {selectedProvider?.profiles.full_name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Análise completa do prestador de serviços para validação
            </DialogDescription>
          </DialogHeader>

          {selectedProvider && (
            <Tabs defaultValue="personal" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="personal">Pessoal</TabsTrigger>
                <TabsTrigger value="professional">Profissional</TabsTrigger>
                <TabsTrigger value="documents">Documentos</TabsTrigger>
                <TabsTrigger value="validation">Validação</TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Dados Pessoais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-16 w-16">
                        <SignedAvatarImage src={selectedProvider.profiles.profile_photo_url} />
                        <AvatarFallback>
                          <User className="h-8 w-8" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-lg font-semibold">{selectedProvider.profiles.full_name}</h3>
                        <p className="text-muted-foreground">{selectedProvider.profiles.email}</p>
                        <p className="text-muted-foreground">{selectedProvider.profiles.phone}</p>
                      </div>
                    </div>

                    <div>
                      <Label>Tipo de Serviço</Label>
                      <p className="font-medium">{selectedProvider.service_type.replace(/_/g, ' ')}</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="professional" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Dados Profissionais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Raio de Atendimento</Label>
                        <p className="font-medium">{selectedProvider.service_radius_km} km</p>
                      </div>
                      <div>
                        <Label>Preço Base</Label>
                        <p className="font-medium">R$ {selectedProvider.base_price || 'N/A'}</p>
                      </div>
                      <div>
                        <Label>Valor por Hora</Label>
                        <p className="font-medium">R$ {selectedProvider.hourly_rate || 'N/A'}</p>
                      </div>
                      <div>
                        <Label>Emergência 24h</Label>
                        <p className="font-medium">{selectedProvider.emergency_service ? 'Sim' : 'Não'}</p>
                      </div>
                    </div>

                    <div>
                      <Label>Horário de Funcionamento</Label>
                      <p className="font-medium">
                        {selectedProvider.work_hours_start} às {selectedProvider.work_hours_end}
                      </p>
                    </div>

                    <div>
                      <Label>Trabalha Finais de Semana/Feriados</Label>
                      <p className="font-medium">
                        {selectedProvider.works_weekends ? 'Finais de semana: Sim' : 'Finais de semana: Não'} • 
                        {selectedProvider.works_holidays ? ' Feriados: Sim' : ' Feriados: Não'}
                      </p>
                    </div>

                    <div>
                      <Label>Especialidades</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {selectedProvider.specialties?.map((specialty) => (
                          <Badge key={specialty} variant="secondary">{specialty}</Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Certificações</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {selectedProvider.certifications?.map((cert) => (
                          <Badge key={cert} variant="outline">{cert}</Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Cidades de Atendimento</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {selectedProvider.service_area_cities?.map((city) => (
                          <Badge key={city} variant="secondary">{city}</Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Equipamentos</Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedProvider.equipment_description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="documents" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Documentos Enviados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'RG', url: selectedProvider.profiles.document_rg_url },
                        { label: 'CPF', url: selectedProvider.profiles.document_cpf_url },
                        { label: 'CNH', url: selectedProvider.profiles.cnh_url },
                        { label: 'Comprovante Endereço', url: selectedProvider.profiles.address_proof_url },
                      ].map((doc) => (
                        <div key={doc.label} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4" />
                              <span className="font-medium">{doc.label}</span>
                            </div>
                            {doc.url ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDocument(doc.url)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Badge variant="destructive">Não enviado</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="validation" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Validação do Prestador</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="notes">Observações da Validação</Label>
                      <Textarea
                        id="notes"
                        placeholder="Adicione observações sobre a validação..."
                        value={validationNotes}
                        onChange={(e) => setValidationNotes(e.target.value)}
                        rows={4}
                      />
                    </div>

                    <div className="flex space-x-4">
                      <Button
                        className="flex-1"
                        onClick={() => handleValidation('APPROVED')}
                        disabled={processingValidation}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Aprovar Prestador
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleValidation('REJECTED')}
                        disabled={processingValidation}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Rejeitar Prestador
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
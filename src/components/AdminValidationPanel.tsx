import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  User, 
  Car, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock,
  Eye,
  Download,
  Calendar,
  Phone,
  MapPin,
  AlertTriangle
} from 'lucide-react';

interface PendingProfile {
  id: string;
  full_name: string;
  role: string;
  status: string;
  document_validation_status: string;
  cnh_validation_status: string;
  rntrc_validation_status: string;
  phone: string;
  cpf_cnpj: string;
  rntrc: string;
  cnh_expiry_date: string;
  cnh_category: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  created_at: string;
  selfie_url: string;
  document_photo_url: string;
  cnh_photo_url: string;
  address_proof_url: string;
  vehicles?: Vehicle[];
}

interface Vehicle {
  id: string;
  license_plate: string;
  vehicle_type: string;
  max_capacity_tons: number;
  axle_count: number;
  crlv_expiry_date: string;
  insurance_expiry_date: string;
  vehicle_validation_status: string;
  vehicle_photo_url: string;
  crlv_url: string;
  insurance_document_url: string;
  inspection_certificate_url: string;
}

export const AdminValidationPanel: React.FC = () => {
  const { profile } = useAuth();
  const [pendingProfiles, setPendingProfiles] = useState<PendingProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<PendingProfile | null>(null);
  const [validationNotes, setValidationNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  // Verificar se é admin
  if (!profile || profile.role !== 'ADMIN') {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            Acesso negado. Apenas administradores podem acessar esta funcionalidade.
          </p>
        </CardContent>
      </Card>
    );
  }

  useEffect(() => {
    fetchPendingProfiles();
  }, []);

  const fetchPendingProfiles = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          *,
          vehicles (*)
        `)
        .in('status', ['PENDING'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingProfiles(profiles || []);
    } catch (error) {
      console.error('Erro ao buscar perfis pendentes:', error);
      toast.error('Erro ao carregar perfis pendentes');
    } finally {
      setLoading(false);
    }
  };

  const validateDocument = async (profileId: string, validationType: string, status: string) => {
    try {
      // Inserir no histórico de validação
      const { error: historyError } = await supabase
        .from('validation_history')
        .insert({
          profile_id: profileId,
          validation_type: validationType,
          status: status,
          validated_by: profile?.id,
          notes: validationNotes
        });

      if (historyError) throw historyError;

      // Atualizar o status específico do documento
      const updateData: any = {
        validation_notes: validationNotes
      };

      switch (validationType) {
        case 'DOCUMENT':
          updateData.document_validation_status = status;
          break;
        case 'CNH':
          updateData.cnh_validation_status = status;
          break;
        case 'RNTRC':
          updateData.rntrc_validation_status = status;
          break;
        case 'BACKGROUND_CHECK':
          updateData.background_check_status = status;
          break;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profileId);

      if (updateError) throw updateError;

      // Enviar notificação para o usuário
      const statusMessage = status === 'APPROVED' ? 'aprovado' : 'rejeitado';
      await supabase.rpc('send_notification', {
        p_user_id: profileId,
        p_title: `Documento ${statusMessage}`,
        p_message: `Seu ${validationType.toLowerCase()} foi ${statusMessage}. ${validationNotes || ''}`,
        p_type: status === 'APPROVED' ? 'success' : 'warning'
      });

      toast.success(`${validationType} ${statusMessage} com sucesso`);
      setValidationNotes('');
      fetchPendingProfiles();
    } catch (error) {
      console.error('Erro ao validar documento:', error);
      toast.error('Erro ao validar documento');
    }
  };

  const approveProfile = async (profileId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          status: 'APPROVED',
          validation_notes: validationNotes 
        })
        .eq('id', profileId);

      if (error) throw error;

      // Enviar notificação
      await supabase.rpc('send_notification', {
        p_user_id: profileId,
        p_title: 'Cadastro Aprovado!',
        p_message: `Seu cadastro foi aprovado e você já pode aceitar fretes. ${validationNotes || ''}`,
        p_type: 'success'
      });

      toast.success('Perfil aprovado com sucesso');
      setValidationNotes('');
      fetchPendingProfiles();
    } catch (error) {
      console.error('Erro ao aprovar perfil:', error);
      toast.error('Erro ao aprovar perfil');
    }
  };

  const rejectProfile = async (profileId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          status: 'REJECTED',
          validation_notes: validationNotes 
        })
        .eq('id', profileId);

      if (error) throw error;

      // Enviar notificação
      await supabase.rpc('send_notification', {
        p_user_id: profileId,
        p_title: 'Cadastro Rejeitado',
        p_message: `Seu cadastro foi rejeitado. Motivo: ${validationNotes || 'Documentos inválidos'}`,
        p_type: 'error'
      });

      toast.success('Perfil rejeitado');
      setValidationNotes('');
      fetchPendingProfiles();
    } catch (error) {
      console.error('Erro ao rejeitar perfil:', error);
      toast.error('Erro ao rejeitar perfil');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="text-yellow-600"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'VALIDATED':
      case 'APPROVED':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Aprovado</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejeitado</Badge>;
      case 'EXPIRED':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Vencido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isDocumentExpired = (expiryDate: string) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center">Carregando perfis pendentes...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Painel de Validação de Cadastros
          </CardTitle>
          <CardDescription>
            Validação manual de documentos e aprovação de cadastros de motoristas
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending">Pendentes ({pendingProfiles.length})</TabsTrigger>
          <TabsTrigger value="validation">Validação Individual</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingProfiles.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">Nenhum perfil pendente de validação</p>
              </CardContent>
            </Card>
          ) : (
            pendingProfiles.map((profile) => (
              <Card key={profile.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={profile.selfie_url || ''} />
                        <AvatarFallback>
                          {profile.full_name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="space-y-2">
                        <div>
                          <h3 className="font-semibold text-lg">{profile.full_name}</h3>
                          <p className="text-muted-foreground">{profile.role}</p>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          {getStatusBadge(profile.status)}
                          <Badge variant="outline" className="text-blue-600">
                            <FileText className="w-3 h-3 mr-1" />
                            Doc: {profile.document_validation_status}
                          </Badge>
                          <Badge variant="outline" className={isDocumentExpired(profile.cnh_expiry_date) ? 'text-red-600' : 'text-blue-600'}>
                            <Calendar className="w-3 h-3 mr-1" />
                            CNH: {profile.cnh_validation_status}
                          </Badge>
                          <Badge variant="outline" className="text-blue-600">
                            <Car className="w-3 h-3 mr-1" />
                            RNTRC: {profile.rntrc_validation_status}
                          </Badge>
                        </div>

                        <div className="text-sm text-muted-foreground space-y-1">
                          <p><Phone className="w-3 h-3 inline mr-1" />{profile.phone}</p>
                          <p><FileText className="w-3 h-3 inline mr-1" />CPF/CNPJ: {profile.cpf_cnpj}</p>
                          <p><Car className="w-3 h-3 inline mr-1" />RNTRC: {profile.rntrc}</p>
                          {profile.cnh_expiry_date && (
                            <p className={isDocumentExpired(profile.cnh_expiry_date) ? 'text-red-600 font-medium' : ''}>
                              <Calendar className="w-3 h-3 inline mr-1" />
                              CNH vence: {new Date(profile.cnh_expiry_date).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setSelectedProfile(profile)}>
                            <Eye className="w-4 h-4 mr-1" />
                            Detalhes
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Validação de Cadastro - {profile.full_name}</DialogTitle>
                            <DialogDescription>
                              Análise completa dos documentos e informações do motorista
                            </DialogDescription>
                          </DialogHeader>

                          {selectedProfile && (
                            <div className="space-y-6">
                              {/* Informações Pessoais */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Nome Completo</Label>
                                  <p className="font-medium">{selectedProfile.full_name}</p>
                                </div>
                                <div>
                                  <Label>CPF/CNPJ</Label>
                                  <p className="font-medium">{selectedProfile.cpf_cnpj}</p>
                                </div>
                                <div>
                                  <Label>Telefone</Label>
                                  <p className="font-medium">{selectedProfile.phone}</p>
                                </div>
                                <div>
                                  <Label>RNTRC</Label>
                                  <p className="font-medium">{selectedProfile.rntrc}</p>
                                </div>
                                <div>
                                  <Label>Categoria CNH</Label>
                                  <p className="font-medium">{selectedProfile.cnh_category}</p>
                                </div>
                                <div>
                                  <Label>Validade CNH</Label>
                                  <p className={`font-medium ${isDocumentExpired(selectedProfile.cnh_expiry_date) ? 'text-red-600' : ''}`}>
                                    {selectedProfile.cnh_expiry_date ? new Date(selectedProfile.cnh_expiry_date).toLocaleDateString('pt-BR') : 'Não informado'}
                                  </p>
                                </div>
                              </div>

                              {/* Contato de Emergência */}
                              {selectedProfile.emergency_contact_name && (
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Contato de Emergência</Label>
                                    <p className="font-medium">{selectedProfile.emergency_contact_name}</p>
                                  </div>
                                  <div>
                                    <Label>Telefone de Emergência</Label>
                                    <p className="font-medium">{selectedProfile.emergency_contact_phone}</p>
                                  </div>
                                </div>
                              )}

                              {/* Documentos */}
                              <div className="space-y-4">
                                <h4 className="font-semibold">Documentos Enviados</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  {selectedProfile.selfie_url && (
                                    <div>
                                      <Label>Foto Selfie</Label>
                                      <div className="mt-2">
                                        <img src={selectedProfile.selfie_url} alt="Selfie" className="w-32 h-32 object-cover rounded border" />
                                      </div>
                                    </div>
                                  )}
                                  {selectedProfile.document_photo_url && (
                                    <div>
                                      <Label>Documento</Label>
                                      <div className="mt-2">
                                        <img src={selectedProfile.document_photo_url} alt="Documento" className="w-32 h-32 object-cover rounded border" />
                                      </div>
                                    </div>
                                  )}
                                  {selectedProfile.cnh_photo_url && (
                                    <div>
                                      <Label>CNH</Label>
                                      <div className="mt-2">
                                        <img src={selectedProfile.cnh_photo_url} alt="CNH" className="w-32 h-32 object-cover rounded border" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Veículos */}
                              {selectedProfile.vehicles && selectedProfile.vehicles.length > 0 && (
                                <div className="space-y-4">
                                  <h4 className="font-semibold">Veículos Cadastrados</h4>
                                  {selectedProfile.vehicles.map((vehicle) => (
                                    <Card key={vehicle.id}>
                                      <CardContent className="p-4">
                                        <div className="grid grid-cols-3 gap-4">
                                          <div>
                                            <Label>Placa</Label>
                                            <p className="font-medium">{vehicle.license_plate}</p>
                                          </div>
                                          <div>
                                            <Label>Tipo</Label>
                                            <p className="font-medium">{vehicle.vehicle_type}</p>
                                          </div>
                                          <div>
                                            <Label>Capacidade</Label>
                                            <p className="font-medium">{vehicle.max_capacity_tons}t</p>
                                          </div>
                                          <div>
                                            <Label>CRLV Válido até</Label>
                                            <p className={`font-medium ${isDocumentExpired(vehicle.crlv_expiry_date) ? 'text-red-600' : ''}`}>
                                              {vehicle.crlv_expiry_date ? new Date(vehicle.crlv_expiry_date).toLocaleDateString('pt-BR') : 'Não informado'}
                                            </p>
                                          </div>
                                          <div>
                                            <Label>Seguro Válido até</Label>
                                            <p className={`font-medium ${isDocumentExpired(vehicle.insurance_expiry_date) ? 'text-red-600' : ''}`}>
                                              {vehicle.insurance_expiry_date ? new Date(vehicle.insurance_expiry_date).toLocaleDateString('pt-BR') : 'Não informado'}
                                            </p>
                                          </div>
                                          <div>
                                            <Label>Status</Label>
                                            {getStatusBadge(vehicle.vehicle_validation_status)}
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              )}

                              {/* Ações de Validação */}
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="validation-notes">Observações da Validação</Label>
                                  <Textarea
                                    id="validation-notes"
                                    placeholder="Digite suas observações sobre a validação..."
                                    value={validationNotes}
                                    onChange={(e) => setValidationNotes(e.target.value)}
                                    className="mt-2"
                                  />
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <Button 
                                    onClick={() => validateDocument(selectedProfile.id, 'DOCUMENT', 'APPROVED')}
                                    variant="outline"
                                    size="sm"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Aprovar Documentos
                                  </Button>
                                  <Button 
                                    onClick={() => validateDocument(selectedProfile.id, 'DOCUMENT', 'REJECTED')}
                                    variant="outline"
                                    size="sm"
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Rejeitar Documentos
                                  </Button>
                                  <Button 
                                    onClick={() => validateDocument(selectedProfile.id, 'CNH', 'VALIDATED')}
                                    variant="outline"
                                    size="sm"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Validar CNH
                                  </Button>
                                  <Button 
                                    onClick={() => validateDocument(selectedProfile.id, 'RNTRC', 'VALIDATED')}
                                    variant="outline"
                                    size="sm"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Validar RNTRC
                                  </Button>
                                </div>

                                <div className="flex gap-4 pt-4 border-t">
                                  <Button 
                                    onClick={() => approveProfile(selectedProfile.id)}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Aprovar Cadastro Completo
                                  </Button>
                                  <Button 
                                    onClick={() => rejectProfile(selectedProfile.id)}
                                    variant="destructive"
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Rejeitar Cadastro
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="validation">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-center">
                Selecione um perfil da aba "Pendentes" para fazer a validação detalhada.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
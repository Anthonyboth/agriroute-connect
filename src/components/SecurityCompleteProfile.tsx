import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DocumentUpload } from '@/components/DocumentUpload';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  User, 
  FileText, 
  Calendar, 
  Phone, 
  MapPin,
  CheckCircle,
  AlertTriangle,
  Camera,
  Upload,
  Shield,
  Car
} from 'lucide-react';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { useCompanyDriver } from '@/hooks/useCompanyDriver';

export const SecurityCompleteProfile: React.FC = () => {
  const { profile } = useAuth();
  const { company, isTransportCompany } = useTransportCompany();
  const { isCompanyDriver } = useCompanyDriver();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cnh_expiry_date: '',
    cnh_category: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    cpf_cnpj: '',
    rntrc: '',
    phone: ''
  });
  
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  useEffect(() => {
    if (profile) {
      setFormData({
        cnh_expiry_date: profile.cnh_expiry_date || '',
        cnh_category: profile.cnh_category || '',
        emergency_contact_name: profile.emergency_contact_name || '',
        emergency_contact_phone: profile.emergency_contact_phone || '',
        cpf_cnpj: profile.cpf_cnpj || '',
        rntrc: profile.rntrc || '',
        phone: profile.phone || ''
      });
      calculateCompletion();
    }
  }, [profile]);

  const calculateCompletion = () => {
    if (!profile) return;

    // Campos obrigatórios baseados no tipo de perfil
    let requiredFields: string[] = [
      'full_name',
      'cpf_cnpj', 
      'phone',
      'emergency_contact_name',
      'emergency_contact_phone',
      'selfie_url',
      'document_photo_url',
      'address_proof_url'
    ];

    // Adicionar CNH e RNTRC apenas para motoristas (não para transportadoras)
    if (profile.role === 'MOTORISTA' && !isTransportCompany) {
      requiredFields = [
        ...requiredFields,
        'cnh_expiry_date',
        'cnh_category',
        'cnh_photo_url',
        'rntrc'
      ];
    }

    const missing: string[] = [];
    let completed = 0;

    requiredFields.forEach(field => {
      const value = field.includes('_') ? 
        (profile as any)[field] || formData[field as keyof typeof formData] :
        (profile as any)[field];
        
      if (value && value.trim() !== '') {
        completed++;
      } else {
        missing.push(getFieldLabel(field));
      }
    });

    const percentage = Math.round((completed / requiredFields.length) * 100);
    setCompletionPercentage(percentage);
    setMissingFields(missing);
  };

  const getFieldLabel = (field: string): string => {
    const labels: { [key: string]: string } = {
      'full_name': 'Nome Completo',
      'cpf_cnpj': 'CPF/CNPJ',
      'phone': 'Telefone',
      'cnh_expiry_date': 'Data de Vencimento da CNH',
      'cnh_category': 'Categoria da CNH',
      'rntrc': 'RNTRC',
      'emergency_contact_name': 'Nome do Contato de Emergência',
      'emergency_contact_phone': 'Telefone do Contato de Emergência',
      'selfie_url': 'Foto Selfie',
      'document_photo_url': 'Foto do Documento',
      'cnh_photo_url': 'Foto da CNH',
      'address_proof_url': 'Comprovante de Endereço'
    };
    return labels[field] || field;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(formData)
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('Informações salvas com sucesso!');
      
      // Recalcular após salvar
      setTimeout(calculateCompletion, 500);

      // SEGURANÇA: PRESTADOR_SERVICOS NÃO pode se auto-aprovar.
      // Apenas PRODUTOR e TRANSPORTADORA são auto-aprovados via AutomaticApprovalService.
      // Prestadores requerem aprovação manual/admin.
      
    } catch (error) {
      console.error('Erro ao salvar informações:', error);
      toast.error('Erro ao salvar informações');
    } finally {
      setLoading(false);
    }
  };

  const isDocumentExpired = (expiryDate: string) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const getValidationStatus = (field: string) => {
    if (!profile) return 'pending';
    
    switch (field) {
      case 'document':
        return profile.document_validation_status?.toLowerCase() || 'pending';
      case 'cnh':
        if (isDocumentExpired(formData.cnh_expiry_date)) return 'expired';
        return profile.cnh_validation_status?.toLowerCase() || 'pending';
      case 'rntrc':
        return profile.rntrc_validation_status?.toLowerCase() || 'pending';
      default:
        return 'pending';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'validated':
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Rejeitado</Badge>;
      case 'expired':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Vencido</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-6">
      {/* Status de Completude */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Status do Cadastro de Segurança
          </CardTitle>
          <CardDescription>
            Complete todas as informações obrigatórias para aprovação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Progresso do Cadastro</span>
              <span className="text-sm text-muted-foreground">{completionPercentage}%</span>
            </div>
            <Progress value={completionPercentage} className="w-full" />
          </div>

          {missingFields.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Campos Pendentes:</p>
                  <ul className="text-yellow-700 mt-1">
                    {missingFields.map((field) => (
                      <li key={field}>• {field}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Status Geral do Cadastro */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="font-medium">Status do Cadastro</p>
              <p className="text-sm text-muted-foreground">
                {profile.status === 'PENDING' ? 'Aguardando aprovação' : 
                 profile.status === 'APPROVED' ? 'Aprovado - Pode aceitar fretes' :
                 'Rejeitado - Verifique as pendências'}
              </p>
            </div>
            <div className="flex gap-2">
              {getStatusBadge(profile.status?.toLowerCase() || 'pending')}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informações Pessoais Obrigatórias */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Informações Pessoais Obrigatórias
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cpf-cnpj">CPF/CNPJ *</Label>
              <Input
                id="cpf-cnpj"
                value={formData.cpf_cnpj}
                onChange={(e) => handleInputChange('cpf_cnpj', e.target.value)}
                placeholder="Digite seu CPF ou CNPJ"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="phone">Telefone WhatsApp *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div>
              <Label htmlFor="rntrc">RNTRC *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="rntrc"
                  value={formData.rntrc}
                  onChange={(e) => handleInputChange('rntrc', e.target.value)}
                  placeholder="Digite o RNTRC"
                />
                {getStatusBadge(getValidationStatus('rntrc'))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informações da CNH - Apenas para motoristas não-transportadoras */}
      {profile.role === 'MOTORISTA' && !isTransportCompany && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Informações da CNH
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cnh-category">Categoria da CNH *</Label>
              <Select value={formData.cnh_category} onValueChange={(value) => handleInputChange('cnh_category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A - Motocicleta</SelectItem>
                  <SelectItem value="B">B - Carro</SelectItem>
                  <SelectItem value="C">C - Veículo de Carga</SelectItem>
                  <SelectItem value="D">D - Ônibus</SelectItem>
                  <SelectItem value="E">E - Articulado/Carreta</SelectItem>
                  <SelectItem value="AB">AB</SelectItem>
                  <SelectItem value="AC">AC</SelectItem>
                  <SelectItem value="AD">AD</SelectItem>
                  <SelectItem value="AE">AE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="cnh-expiry">Data de Vencimento da CNH *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="cnh-expiry"
                  type="date"
                  value={formData.cnh_expiry_date}
                  onChange={(e) => handleInputChange('cnh_expiry_date', e.target.value)}
                />
                {getStatusBadge(getValidationStatus('cnh'))}
              </div>
              {isDocumentExpired(formData.cnh_expiry_date) && (
                <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  CNH vencida - Renove para continuar
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Contato de Emergência */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Contato de Emergência
          </CardTitle>
          <CardDescription>
            Pessoa para contatar em caso de emergência durante o transporte
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="emergency-name">Nome do Contato *</Label>
              <Input
                id="emergency-name"
                value={formData.emergency_contact_name}
                onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)}
                placeholder="Nome completo"
              />
            </div>

            <div>
              <Label htmlFor="emergency-phone">Telefone do Contato *</Label>
              <Input
                id="emergency-phone"
                value={formData.emergency_contact_phone}
                onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload de Documentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Documentos Obrigatórios
          </CardTitle>
          <CardDescription>
            Faça upload de todos os documentos necessários
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label>Foto Selfie *</Label>
                {profile.selfie_url && <CheckCircle className="w-4 h-4 text-green-600" />}
              </div>
              <DocumentUpload
                onUploadComplete={(url) => console.log('Selfie uploaded:', url)}
                acceptedTypes={['image/*']}
                maxSize={5}
                currentFile={profile.selfie_url}
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label>Documento com Foto (RG/CNH) *</Label>
                {profile.document_photo_url && <CheckCircle className="w-4 h-4 text-green-600" />}
                {getStatusBadge(getValidationStatus('document'))}
              </div>
              <DocumentUpload
                onUploadComplete={(url) => console.log('Document uploaded:', url)}
                acceptedTypes={['image/*']}
                maxSize={5}
                currentFile={profile.document_photo_url}
              />
            </div>

            {/* CNH - Apenas para motoristas não-transportadoras */}
            {profile.role === 'MOTORISTA' && !isTransportCompany && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label>CNH (Frente e Verso) *</Label>
                {profile.cnh_photo_url && <CheckCircle className="w-4 h-4 text-green-600" />}
                {getStatusBadge(getValidationStatus('cnh'))}
              </div>
              <DocumentUpload
                onUploadComplete={(url) => console.log('CNH uploaded:', url)}
                acceptedTypes={['image/*']}
                maxSize={5}
                currentFile={profile.cnh_photo_url}
              />
            </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label>Comprovante de Endereço *</Label>
                {profile.address_proof_url && <CheckCircle className="w-4 h-4 text-green-600" />}
              </div>
              <DocumentUpload
                onUploadComplete={(url) => console.log('Address proof uploaded:', url)}
                acceptedTypes={['image/*', 'application/pdf']}
                maxSize={5}
                currentFile={profile.address_proof_url}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão de Salvar */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={loading}
          size="lg"
        >
          {loading ? 'Salvando...' : 'Salvar Informações'}
        </Button>
      </div>

      {/* Observações da Validação */}
      {profile.validation_notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-600">
              <FileText className="w-5 h-5" />
              Observações da Validação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{profile.validation_notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
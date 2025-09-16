import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollButtons } from '@/components/ui/scroll-buttons';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { X, Plus, FileText, IdCard, Building, CreditCard, User, Shield } from 'lucide-react';
import { DocumentUpload } from './DocumentUpload';
import { ProfilePhotoUpload } from './ProfilePhotoUpload';

interface ServiceProviderRegistrationFormProps {
  isOpen: boolean;
  onClose: () => void;
}

const serviceTypes = [
  { value: 'GUINCHO', label: 'Guincho/Reboque', requiresCNH: true },
  { value: 'MECANICO', label: 'Mecânico', requiresCNH: false },
  { value: 'BORRACHEIRO', label: 'Borracheiro', requiresCNH: true },
  { value: 'ELETRICISTA_AUTOMOTIVO', label: 'Eletricista Automotivo', requiresCNH: false },
  { value: 'AUTO_ELETRICA', label: 'Auto-Elétrica', requiresCNH: false },
  { value: 'COMBUSTIVEL', label: 'Entrega de Combustível', requiresCNH: true },
  { value: 'CHAVEIRO', label: 'Chaveiro', requiresCNH: true },
  { value: 'SOLDADOR', label: 'Soldador', requiresCNH: false },
  { value: 'PINTURA', label: 'Pintura Automotiva', requiresCNH: false },
  { value: 'VIDRACEIRO', label: 'Vidraceiro', requiresCNH: true },
  { value: 'AR_CONDICIONADO', label: 'Ar Condicionado', requiresCNH: false },
  { value: 'FREIOS', label: 'Sistema de Freios', requiresCNH: false },
  { value: 'SUSPENSAO', label: 'Suspensão', requiresCNH: false }
];

const specialtyOptions = [
  'Carros de passeio', 'Motocicletas', 'Caminhões', 'Carretas', 'Ônibus',
  'Tratores', 'Máquinas agrícolas', 'Veículos pesados', 'Sistema de freios',
  'Sistema elétrico', 'Sistema de auto-elétrica', 'Motor diesel', 'Motor flex', 'Transmissão manual',
  'Transmissão automática', 'Sistema hidráulico'
];

const certificationOptions = [
  'SENAI - Mecânica Automotiva', 'SENAI - Eletricista Automotivo', 'SENAI - Auto-Elétrica',
  'Certificação ISO 9001', 'Curso Bosch', 'Certificação Volvo',
  'Certificação Scania', 'Certificação Mercedes-Benz', 'NR-20 (Combustíveis)',
  'NR-35 (Trabalho em Altura)', 'Bombeiro Civil'
];

interface FormData {
  // Dados pessoais
  serviceType: string;
  profilePhoto: string;
  
  // Documentos pessoais
  rgCpf: string;
  cnhNumber: string;
  cnhCategory: string;
  cnhExpiry: string;
  
  // Endereço
  address: string;
  city: string;
  state: string;
  zipCode: string;
  
  // Dados profissionais
  serviceRadiusKm: number;  
  basePrice: string;
  hourlyRate: string;
  emergencyService: boolean;
  workHoursStart: string;
  workHoursEnd: string;
  worksWeekends: boolean;
  worksHolidays: boolean;
  equipmentDescription: string;
  experienceYears: string;
  
  // Arrays
  specialties: string[];
  certifications: string[];
  serviceAreaCities: string[];
  
  // Campos temporários para adicionar itens
  newCity: string;
  newSpecialty: string;
  newCertification: string;
  
  // Empresa (opcional)
  hasCompany: boolean;
  companyName: string;
  cnpj: string;
  
  // Dados bancários
  bankName: string;
  accountType: string;
  agency: string;
  account: string;
  pixKey: string;
  
  // URLs de documentos
  rgUrl: string;
  cpfUrl: string;
  cnhUrl: string;
  addressProofUrl: string;
  cnpjUrl: string;
  meiCertificateUrl: string;
  businessLicenseUrl: string;
  insuranceUrl: string;
  certificationUrls: string[];
}

export const ServiceProviderRegistrationForm: React.FC<ServiceProviderRegistrationFormProps> = ({
  isOpen,
  onClose
}) => {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  
  const [formData, setFormData] = useState<FormData>({
    serviceType: '',
    profilePhoto: '',
    rgCpf: '',
    cnhNumber: '',
    cnhCategory: '',
    cnhExpiry: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    serviceRadiusKm: 50,
    basePrice: '',
    hourlyRate: '',
    emergencyService: true,
    workHoursStart: '08:00',
    workHoursEnd: '18:00',
    worksWeekends: false,
    worksHolidays: false,
    equipmentDescription: '',
    experienceYears: '',
    specialties: [],
    certifications: [],
    serviceAreaCities: [],
    newCity: '',
    newSpecialty: '',
    newCertification: '',
    hasCompany: false,
    companyName: '',
    cnpj: '',
    bankName: '',
    accountType: 'corrente',
    agency: '',
    account: '',
    pixKey: '',
    rgUrl: '',
    cpfUrl: '',
    cnhUrl: '',
    addressProofUrl: '',
    cnpjUrl: '',
    meiCertificateUrl: '',
    businessLicenseUrl: '',
    insuranceUrl: '',
    certificationUrls: []
  });

  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState('personal');

  const selectedServiceType = serviceTypes.find(st => st.value === formData.serviceType);
  const requiresCNH = selectedServiceType?.requiresCNH || false;

  const validatePersonalData = () => {
    const requiredFields = [
      'serviceType', 'rgCpf', 'address', 'city', 'state', 'zipCode',
      'rgUrl', 'cpfUrl', 'addressProofUrl'
    ];
    
    if (requiresCNH) {
      requiredFields.push('cnhNumber', 'cnhCategory', 'cnhExpiry', 'cnhUrl');
    }

    for (const field of requiredFields) {
      if (!formData[field as keyof FormData]) {
        return `Campo obrigatório: ${field}`;
      }
    }
    return null;
  };

  const validateProfessionalData = () => {
    const requiredFields = ['experienceYears', 'equipmentDescription'];
    
    for (const field of requiredFields) {
      if (!formData[field as keyof FormData]) {
        return `Campo obrigatório: ${field}`;
      }
    }

    if (formData.specialties.length === 0) {
      return 'Selecione pelo menos uma especialidade';
    }

    if (formData.serviceAreaCities.length === 0) {
      return 'Adicione pelo menos uma cidade de atendimento';
    }

    return null;
  };

  const validateFinancialData = () => {
    const requiredFields = ['pixKey'];
    
    for (const field of requiredFields) {
      if (!formData[field as keyof FormData]) {
        return `Campo obrigatório: ${field}`;
      }
    }

    if (formData.hasCompany && (!formData.companyName || !formData.cnpj || !formData.cnpjUrl)) {
      return 'Dados da empresa incompletos';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !profile) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para se cadastrar.",
        variant: "destructive",
      });
      return;
    }

    // Validar dados por aba
    const personalError = validatePersonalData();
    if (personalError) {
      setCurrentTab('personal');
      toast({
        title: "Dados pessoais incompletos",
        description: personalError,
        variant: "destructive",
      });
      return;
    }

    const professionalError = validateProfessionalData();
    if (professionalError) {
      setCurrentTab('professional');
      toast({
        title: "Dados profissionais incompletos", 
        description: professionalError,
        variant: "destructive",
      });
      return;
    }

    const financialError = validateFinancialData();
    if (financialError) {
      setCurrentTab('financial');
      toast({
        title: "Dados financeiros incompletos",
        description: financialError,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const serviceData = {
        profile_id: profile.id,
        service_type: formData.serviceType,
        service_radius_km: formData.serviceRadiusKm,
        base_price: formData.basePrice ? parseFloat(formData.basePrice) : null,
        hourly_rate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
        emergency_service: formData.emergencyService,
        work_hours_start: formData.workHoursStart,
        work_hours_end: formData.workHoursEnd,
        works_weekends: formData.worksWeekends,
        works_holidays: formData.worksHolidays,
        equipment_description: formData.equipmentDescription,
        specialties: formData.specialties,
        certifications: formData.certifications,
        service_area_cities: formData.serviceAreaCities
      };

      const { error } = await supabase
        .from('service_providers')
        .insert(serviceData);

      if (error) throw error;

      // Atualizar profile com documentos
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          document_rg_url: formData.rgUrl,
          document_cpf_url: formData.cpfUrl,
          cnh_url: requiresCNH ? formData.cnhUrl : null,
          address_proof_url: formData.addressProofUrl,
          profile_photo_url: formData.profilePhoto,
          validation_status: 'PENDING'
        })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      toast({
        title: "Sucesso!",
        description: "Cadastro realizado! Aguarde a aprovação do administrador.",
      });

      onClose();
      
    } catch (error) {
      console.error('Erro ao cadastrar prestador:', error);
      toast({
        title: "Erro",
        description: "Erro ao realizar cadastro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addItem = (type: 'city' | 'specialty' | 'certification') => {
    const fieldMap = {
      city: { array: 'serviceAreaCities', input: 'newCity' },
      specialty: { array: 'specialties', input: 'newSpecialty' },
      certification: { array: 'certifications', input: 'newCertification' }
    };

    const field = fieldMap[type];
    const value = formData[field.input as keyof FormData] as string;

    if (value.trim()) {
      const currentArray = formData[field.array as keyof FormData] as string[];
      if (!currentArray.includes(value.trim())) {
        setFormData(prev => ({
          ...prev,
          [field.array]: [...currentArray, value.trim()],
          [field.input]: ''
        }));
      }
    }
  };

  const removeItem = (type: 'serviceAreaCities' | 'specialties' | 'certifications', item: string) => {
    setFormData(prev => ({
      ...prev,
      [type]: (prev[type] as string[]).filter(i => i !== item)
    }));
  };

  const addPredefinedItem = (type: 'specialties' | 'certifications', item: string) => {
    const currentArray = formData[type] as string[];
    if (!currentArray.includes(item)) {
      setFormData(prev => ({
        ...prev,
        [type]: [...currentArray, item]
      }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Cadastro Completo de Prestador de Serviços
          </DialogTitle>
        </DialogHeader>

        <ScrollButtons className="flex-1">
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full pr-2">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="personal" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Pessoal
            </TabsTrigger>
            <TabsTrigger value="professional" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Profissional
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Financeiro
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="space-y-6">
            <TabsContent value="personal" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IdCard className="h-5 w-5" />
                    Dados Pessoais
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ProfilePhotoUpload
                    currentPhotoUrl={formData.profilePhoto}
                    onUploadComplete={(url) => setFormData(prev => ({ ...prev, profilePhoto: url }))}
                    userName={profile?.full_name}
                    size="lg"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="serviceType">Tipo de Serviço Principal *</Label>
                      <Select 
                        value={formData.serviceType} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, serviceType: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo de serviço" />
                        </SelectTrigger>
                        <SelectContent>
                          {serviceTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="rgCpf">RG/CPF *</Label>
                      <Input
                        id="rgCpf"
                        value={formData.rgCpf}
                        onChange={(e) => setFormData(prev => ({ ...prev, rgCpf: e.target.value }))}
                        placeholder="12345678901"
                        required
                      />
                    </div>
                  </div>

                  {requiresCNH && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="cnhNumber">Número da CNH *</Label>
                        <Input
                          id="cnhNumber"
                          value={formData.cnhNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, cnhNumber: e.target.value }))}
                          placeholder="12345678901"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="cnhCategory">Categoria CNH *</Label>
                        <Select 
                          value={formData.cnhCategory} 
                          onValueChange={(value) => setFormData(prev => ({ ...prev, cnhCategory: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">A</SelectItem>
                            <SelectItem value="B">B</SelectItem>
                            <SelectItem value="C">C</SelectItem>
                            <SelectItem value="D">D</SelectItem>
                            <SelectItem value="E">E</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="cnhExpiry">Validade CNH *</Label>
                        <Input
                          id="cnhExpiry"
                          type="date"
                          value={formData.cnhExpiry}
                          onChange={(e) => setFormData(prev => ({ ...prev, cnhExpiry: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="address">Endereço Completo *</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Rua, número, bairro"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">Cidade *</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="state">Estado *</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="zipCode">CEP *</Label>
                      <Input
                        id="zipCode"
                        value={formData.zipCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
                        placeholder="12345-678"
                        required
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="professional" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Dados Profissionais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="experienceYears">Anos de Experiência *</Label>
                      <Input
                        id="experienceYears"
                        type="number"
                        value={formData.experienceYears}
                        onChange={(e) => setFormData(prev => ({ ...prev, experienceYears: e.target.value }))}
                        min="0"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="serviceRadius">Raio de Atendimento (km)</Label>
                      <Input
                        id="serviceRadius"
                        type="number"
                        value={formData.serviceRadiusKm}
                        onChange={(e) => setFormData(prev => ({ ...prev, serviceRadiusKm: parseInt(e.target.value) }))}
                        min="1"
                        max="500"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="equipmentDescription">Descrição de Equipamentos *</Label>
                    <Textarea
                      id="equipmentDescription"
                      value={formData.equipmentDescription}
                      onChange={(e) => setFormData(prev => ({ ...prev, equipmentDescription: e.target.value }))}
                      placeholder="Descreva os equipamentos e ferramentas que você possui..."
                      required
                    />
                  </div>

                  {/* Especialidades */}
                  <div>
                    <Label>Especialidades *</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                      {specialtyOptions.map(specialty => (
                        <Button
                          key={specialty}
                          type="button" 
                          variant={formData.specialties.includes(specialty) ? "default" : "outline"}
                          size="sm"
                          onClick={() => addPredefinedItem('specialties', specialty)}
                          className="justify-start h-auto py-2 text-xs"
                        >
                          {specialty}
                        </Button>
                      ))}
                    </div>
                    
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="Adicionar especialidade personalizada"
                        value={formData.newSpecialty}
                        onChange={(e) => setFormData(prev => ({ ...prev, newSpecialty: e.target.value }))}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addItem('specialty'))}
                      />
                      <Button type="button" onClick={() => addItem('specialty')} variant="outline">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {formData.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.specialties.map(specialty => (
                          <Badge key={specialty} variant="secondary" className="cursor-pointer">
                            {specialty}
                            <X className="h-3 w-3 ml-1" onClick={() => removeItem('specialties', specialty)} />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Cidades de Atendimento */}
                  <div>
                    <Label>Cidades de Atendimento *</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        placeholder="Digite uma cidade"
                        value={formData.newCity}
                        onChange={(e) => setFormData(prev => ({ ...prev, newCity: e.target.value }))}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addItem('city'))}
                      />
                      <Button type="button" onClick={() => addItem('city')} variant="outline">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.serviceAreaCities.map(city => (
                        <Badge key={city} variant="secondary" className="cursor-pointer">
                          {city}
                          <X className="h-3 w-3 ml-1" onClick={() => removeItem('serviceAreaCities', city)} />
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Horários */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="workStart">Horário de Início</Label>
                      <Input
                        id="workStart"
                        type="time"
                        value={formData.workHoursStart}
                        onChange={(e) => setFormData(prev => ({ ...prev, workHoursStart: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="workEnd">Horário de Fim</Label>
                      <Input
                        id="workEnd"
                        type="time"
                        value={formData.workHoursEnd}
                        onChange={(e) => setFormData(prev => ({ ...prev, workHoursEnd: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="emergency"
                        checked={formData.emergencyService}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, emergencyService: !!checked }))}
                      />
                      <Label htmlFor="emergency">Atendimento de emergência 24h</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="weekends"
                        checked={formData.worksWeekends}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, worksWeekends: !!checked }))}
                      />
                      <Label htmlFor="weekends">Trabalha aos finais de semana</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="holidays"
                        checked={formData.worksHolidays}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, worksHolidays: !!checked }))}
                      />
                      <Label htmlFor="holidays">Trabalha em feriados</Label>
                    </div>
                  </div>

                  {/* Preços */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="basePrice">Preço Base (R$)</Label>
                      <Input
                        id="basePrice"
                        type="number"
                        step="0.01"
                        value={formData.basePrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, basePrice: e.target.value }))}
                        placeholder="Ex: 150.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hourlyRate">Valor por Hora (R$)</Label>
                      <Input
                        id="hourlyRate"
                        type="number"
                        step="0.01"
                        value={formData.hourlyRate}
                        onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: e.target.value }))}
                        placeholder="Ex: 80.00"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Documentos Obrigatórios</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DocumentUpload
                      label="RG (Frente e Verso)"
                      fileType="rg"
                      bucketName="driver-documents"
                      onUploadComplete={(url) => setFormData(prev => ({ ...prev, rgUrl: url }))}
                      required
                    />
                    
                    <DocumentUpload
                      label="CPF"
                      fileType="cpf"
                      bucketName="driver-documents"
                      onUploadComplete={(url) => setFormData(prev => ({ ...prev, cpfUrl: url }))}
                      required
                    />
                  </div>

                  {requiresCNH && (
                    <DocumentUpload
                      label="CNH (Frente e Verso)"
                      fileType="cnh"
                      bucketName="driver-documents"
                      onUploadComplete={(url) => setFormData(prev => ({ ...prev, cnhUrl: url }))}
                      required
                    />
                  )}

                  <DocumentUpload
                    label="Comprovante de Endereço (máx. 3 meses)"
                    fileType="address_proof"
                    bucketName="driver-documents"
                    onUploadComplete={(url) => setFormData(prev => ({ ...prev, addressProofUrl: url }))}
                    required
                  />

                  <DocumentUpload
                    label="Seguro de Responsabilidade Civil (Opcional)"
                    fileType="insurance"
                    bucketName="driver-documents"
                    onUploadComplete={(url) => setFormData(prev => ({ ...prev, insuranceUrl: url }))}
                  />
                </CardContent>
              </Card>

              {/* Certificações */}
              <Card>
                <CardHeader>
                  <CardTitle>Certificações Profissionais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Selecione suas certificações:</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      {certificationOptions.map(cert => (
                        <Button
                          key={cert}
                          type="button"
                          variant={formData.certifications.includes(cert) ? "default" : "outline"}
                          size="sm"
                          onClick={() => addPredefinedItem('certifications', cert)}
                          className="justify-start h-auto py-2 text-xs"
                        >
                          {cert}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Adicionar certificação personalizada"
                      value={formData.newCertification}
                      onChange={(e) => setFormData(prev => ({ ...prev, newCertification: e.target.value }))}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addItem('certification'))}
                    />
                    <Button type="button" onClick={() => addItem('certification')} variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {formData.certifications.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.certifications.map(cert => (
                        <Badge key={cert} variant="secondary" className="cursor-pointer">
                          {cert}
                          <X className="h-3 w-3 ml-1" onClick={() => removeItem('certifications', cert)} />
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financial" className="space-y-6">
              {/* Dados da Empresa */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Dados da Empresa (Opcional)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasCompany"
                      checked={formData.hasCompany}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasCompany: !!checked }))}
                    />
                    <Label htmlFor="hasCompany">Possuo empresa (CNPJ/MEI)</Label>
                  </div>

                  {formData.hasCompany && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="companyName">Nome da Empresa</Label>
                          <Input
                            id="companyName"
                            value={formData.companyName}
                            onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                            required={formData.hasCompany}
                          />
                        </div>
                        <div>
                          <Label htmlFor="cnpj">CNPJ</Label>
                          <Input
                            id="cnpj"
                            value={formData.cnpj}
                            onChange={(e) => setFormData(prev => ({ ...prev, cnpj: e.target.value }))}
                            placeholder="12.345.678/0001-90"
                            required={formData.hasCompany}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DocumentUpload
                          label="Cartão CNPJ/Certificado MEI"
                          fileType="cnpj"
                          bucketName="driver-documents"
                          onUploadComplete={(url) => setFormData(prev => ({ ...prev, cnpjUrl: url }))}
                          required={formData.hasCompany}
                        />
                        
                        <DocumentUpload
                          label="Alvará de Funcionamento (se aplicável)"
                          fileType="business_license"
                          bucketName="driver-documents"
                          onUploadComplete={(url) => setFormData(prev => ({ ...prev, businessLicenseUrl: url }))}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Dados Bancários */}
              <Card>
                <CardHeader>
                  <CardTitle>Dados para Recebimento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="pixKey">Chave PIX *</Label>
                    <Input
                      id="pixKey"
                      value={formData.pixKey}
                      onChange={(e) => setFormData(prev => ({ ...prev, pixKey: e.target.value }))}
                      placeholder="CPF, e-mail, telefone ou chave aleatória"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="bankName">Banco (opcional)</Label>
                      <Input
                        id="bankName"
                        value={formData.bankName}
                        onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                        placeholder="Ex: Banco do Brasil"
                      />
                    </div>
                    <div>
                      <Label htmlFor="agency">Agência (opcional)</Label>
                      <Input
                        id="agency"
                        value={formData.agency}
                        onChange={(e) => setFormData(prev => ({ ...prev, agency: e.target.value }))}
                        placeholder="1234"
                      />
                    </div>
                    <div>
                      <Label htmlFor="account">Conta (opcional)</Label>
                      <Input
                        id="account"
                        value={formData.account}
                        onChange={(e) => setFormData(prev => ({ ...prev, account: e.target.value }))}
                        placeholder="12345-6"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <div className="flex justify-between pt-6">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              
              <div className="flex gap-2">
                {currentTab !== 'personal' && (
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      const tabs = ['personal', 'professional', 'documents', 'financial'];
                      const currentIndex = tabs.indexOf(currentTab);
                      if (currentIndex > 0) {
                        setCurrentTab(tabs[currentIndex - 1]);
                      }
                    }}
                  >
                    Anterior
                  </Button>
                )}
                
                {currentTab !== 'financial' ? (
                  <Button 
                    type="button"
                    onClick={() => {
                      const tabs = ['personal', 'professional', 'documents', 'financial'];
                      const currentIndex = tabs.indexOf(currentTab);
                      if (currentIndex < tabs.length - 1) {
                        setCurrentTab(tabs[currentIndex + 1]);
                      }
                    }}
                  >
                    Próximo
                  </Button>
                ) : (
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Enviando...' : 'Finalizar Cadastro'}
                  </Button>
                )}
              </div>
            </div>
          </form>
          </Tabs>
        </ScrollButtons>
      </DialogContent>
    </Dialog>
  );
};
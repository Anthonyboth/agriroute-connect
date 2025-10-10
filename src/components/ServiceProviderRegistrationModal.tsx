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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { X, Plus } from 'lucide-react';

interface ServiceProviderRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const serviceTypes = [
  'GUINCHO',
  'MECANICO',
  'BORRACHEIRO', 
  'ELETRICISTA_AUTOMOTIVO',
  'AUTO_ELETRICA',
  'COMBUSTIVEL',
  'CHAVEIRO',
  'SOLDADOR',
  'PINTURA',
  'VIDRACEIRO',
  'AR_CONDICIONADO',
  'FREIOS',
  'SUSPENSAO'
];

const specialtyOptions = [
  'Carros de passeio',
  'Motocicletas', 
  'Caminhões',
  'Carretas',
  'Ônibus',
  'Tratores',
  'Máquinas agrícolas',
  'Veículos pesados',
  'Sistema de freios',
  'Sistema elétrico',
  'Sistema de auto-elétrica',
  'Motor diesel',
  'Motor flex',
  'Transmissão manual',
  'Transmissão automática',
  'Sistema hidráulico'
];

const certificationOptions = [
  'SENAI - Mecânica Automotiva',
  'SENAI - Eletricista Automotivo',
  'Certificação ISO 9001',
  'Curso Bosch',
  'Certificação Volvo',
  'Certificação Scania',
  'Certificação Mercedes-Benz',
  'NR-20 (Combustíveis)',
  'NR-35 (Trabalho em Altura)',
  'Bombeiro Civil'
];

export const ServiceProviderRegistrationModal: React.FC<ServiceProviderRegistrationModalProps> = ({
  isOpen,
  onClose
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    serviceType: '',
    serviceRadiusKm: 50,
    basePrice: '',
    hourlyRate: '',
    emergencyService: true,
    workHoursStart: '08:00',
    workHoursEnd: '18:00',
    worksWeekends: false,
    worksHolidays: false,
    equipmentDescription: '',
    specialties: [] as string[],
    certifications: [] as string[],
    serviceAreaCities: [] as string[],
    newCity: '',
    newSpecialty: '',
    newCertification: ''
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para se cadastrar.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.serviceType) {
      toast({
        title: "Erro", 
        description: "Selecione pelo menos um tipo de serviço.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Buscar o profile do usuário
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile) {
        throw new Error('Profile não encontrado');
      }

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

      toast({
        title: "Sucesso!",
        description: "Cadastro de prestador de serviços realizado com sucesso!",
      });

      onClose();
      
      // Reset form
      setFormData({
        serviceType: '',
        serviceRadiusKm: 50,
        basePrice: '',
        hourlyRate: '',
        emergencyService: true,
        workHoursStart: '08:00',
        workHoursEnd: '18:00',
        worksWeekends: false,
        worksHolidays: false,
        equipmentDescription: '',
        specialties: [],
        certifications: [],
        serviceAreaCities: [],
        newCity: '',
        newSpecialty: '',
        newCertification: ''
      });

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
    const value = formData[field.input as keyof typeof formData] as string;

    if (value.trim()) {
      const currentArray = formData[field.array as keyof typeof formData] as string[];
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Cadastro de Prestador de Serviços
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo de Serviço */}
          <Card>
            <CardHeader>
              <CardTitle>Tipo de Serviço Principal</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={formData.serviceType} onValueChange={(value) => setFormData(prev => ({ ...prev, serviceType: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de serviço" />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Área de Atendimento */}
          <Card>
            <CardHeader>
              <CardTitle>Área de Atendimento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <Label>Cidades de Atendimento</Label>
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
            </CardContent>
          </Card>

          {/* Preços */}
          <Card>
            <CardHeader>
              <CardTitle>Preços</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </CardContent>
          </Card>

          {/* Horário de Funcionamento */}
          <Card>
            <CardHeader>
              <CardTitle>Horário de Funcionamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="workStart">Início</Label>
                  <Input
                    id="workStart"
                    type="time"
                    value={formData.workHoursStart}
                    onChange={(e) => setFormData(prev => ({ ...prev, workHoursStart: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="workEnd">Fim</Label>
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
            </CardContent>
          </Card>

          {/* Especialidades */}
          <Card>
            <CardHeader>
              <CardTitle>Especialidades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Selecione suas especialidades:</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {specialtyOptions.map(specialty => (
                    <Button
                      key={specialty}
                      type="button"
                      variant={formData.specialties.includes(specialty) ? "default" : "outline"}
                      size="sm"
                      onClick={() => addPredefinedItem('specialties', specialty)}
                      className="justify-start h-auto py-2"
                    >
                      {specialty}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Adicionar especialidade personalizada:</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="Digite uma especialidade"
                    value={formData.newSpecialty}
                    onChange={(e) => setFormData(prev => ({ ...prev, newSpecialty: e.target.value }))}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addItem('specialty'))}
                  />
                  <Button type="button" onClick={() => addItem('specialty')} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {formData.specialties.length > 0 && (
                <div>
                  <Label>Especialidades selecionadas:</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {formData.specialties.map(specialty => (
                      <Badge key={specialty} variant="secondary" className="cursor-pointer">
                        {specialty}
                        <X className="h-3 w-3 ml-1" onClick={() => removeItem('specialties', specialty)} />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Certificações */}
          <Card>
            <CardHeader>
              <CardTitle>Certificações</CardTitle>
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
                      className="justify-start h-auto py-2"
                    >
                      {cert}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Adicionar certificação personalizada:</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="Digite uma certificação"
                    value={formData.newCertification}
                    onChange={(e) => setFormData(prev => ({ ...prev, newCertification: e.target.value }))}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addItem('certification'))}
                  />
                  <Button type="button" onClick={() => addItem('certification')} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {formData.certifications.length > 0 && (
                <div>
                  <Label>Certificações selecionadas:</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {formData.certifications.map(cert => (
                      <Badge key={cert} variant="secondary" className="cursor-pointer">
                        {cert}
                        <X className="h-3 w-3 ml-1" onClick={() => removeItem('certifications', cert)} />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Equipamentos */}
          <Card>
            <CardHeader>
              <CardTitle>Equipamentos e Ferramentas</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="equipment">Descreva seus equipamentos:</Label>
              <Textarea
                id="equipment"
                value={formData.equipmentDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, equipmentDescription: e.target.value }))}
                placeholder="Ex: Guincho de 15 toneladas, ferramentas completas para mecânica geral, equipamentos de solda..."
                rows={4}
              />
            </CardContent>
          </Card>

          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Cadastrando...' : 'Cadastrar Prestador'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
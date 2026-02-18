import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { MapPin, Plus, Edit, Trash2, Navigation, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedLocationInput, type LocationData } from './UnifiedLocationInput';

interface ServiceProviderArea {
  id: string;
  city_name: string;
  state?: string;
  lat: number;
  lng: number;
  radius_km: number;
  service_types: string[];
  is_active: boolean;
  created_at: string;
}

interface ServiceAreaFormData {
  city_name: string;
  state: string;
  city_id?: string;
  lat: number;
  lng: number;
  radius_km: number;
  service_types: string[];
  is_active: boolean;
}

const SERVICE_TYPES = [
  'GUINCHO',
  'BORRACHARIA',
  'MECANICA',
  'ELETRICA',
  'REBOQUE',
  'COMBUSTIVEL',
  'CHAVEIRO',
  'LIMPEZA',
  'OUTROS'
];

const SERVICE_TYPE_LABELS: Record<string, string> = {
  GUINCHO: 'Guincho',
  BORRACHARIA: 'Borracharia',
  MECANICA: 'Mecânica',
  ELETRICA: 'Elétrica',
  REBOQUE: 'Reboque',
  COMBUSTIVEL: 'Combustível',
  CHAVEIRO: 'Chaveiro',
  LIMPEZA: 'Limpeza',
  OUTROS: 'Outros'
};

const ServiceProviderAreasManager = () => {
  const [serviceAreas, setServiceAreas] = useState<ServiceProviderArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<ServiceProviderArea | null>(null);
  const [formData, setFormData] = useState<ServiceAreaFormData>({
    city_name: '',
    state: '',
    lat: 0,
    lng: 0,
    radius_km: 30,
    service_types: [],
    is_active: true
  });

  const fetchServiceAreas = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('service-provider-areas', {
        method: 'GET'
      });

      if (error) throw error;

      if (data?.success) {
        setServiceAreas(data.service_areas);
      }
    } catch (error) {
      console.error('Error fetching service provider areas:', error);
      toast.error('Erro ao carregar áreas de atendimento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceAreas();
  }, []);

  // Função para buscar coordenadas automaticamente baseado no nome da cidade
  const geocodeCity = async (cityName: string, state?: string) => {
    if (!cityName.trim()) return;
    
    try {
      // Montar query de busca
      const query = state ? `${cityName}, ${state}, Brasil` : `${cityName}, Brasil`;
      
      // Usar API gratuita de geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br`
      );
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        setFormData(prev => ({
          ...prev,
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon)
        }));
        toast.success(`Coordenadas encontradas para ${cityName}`);
      }
    } catch (error) {
      console.error('Erro no geocoding:', error);
      // Não mostra erro para o usuário, coordenadas não são obrigatórias
    }
  };

  // Função chamada quando o nome da cidade muda
  const handleCityNameChange = (cityName: string) => {
    setFormData(prev => ({ ...prev, city_name: cityName }));
    
    // Buscar coordenadas automaticamente após 1 segundo de pausa
    if (cityName.trim().length > 2) {
      const timeoutId = setTimeout(() => {
        geocodeCity(cityName, formData.state);
      }, 1000);
      
      return timeoutId;
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { getCurrentPositionSafe } = await import('@/utils/location');
      const position = await getCurrentPositionSafe();
      setFormData(prev => ({
        ...prev,
        lat: position.coords.latitude,
        lng: position.coords.longitude
      }));
      toast.success('Localização atual capturada');
    } catch (error) {
      console.error('Error getting location:', error);
      toast.error('Erro ao obter localização atual');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const missingFields: string[] = [];
    
    if (!formData.city_name?.trim()) {
      missingFields.push('Nome da cidade');
    }

    // Se não tem coordenadas, tentar buscar automaticamente antes de falhar
    if ((!formData.lat || !formData.lng) && formData.city_name?.trim()) {
      toast.info('Buscando coordenadas da cidade...');
      await geocodeCity(formData.city_name, formData.state);
      
      // Aguardar um momento para a atualização do estado
      setTimeout(() => {
        // Se ainda não tiver coordenadas, continuar sem elas (não são obrigatórias)
        if (!formData.lat || !formData.lng) {
          toast.warning('Coordenadas não encontradas, mas você pode continuar. As coordenadas podem ser definidas depois.');
        }
      }, 1000);
    }

    if (missingFields.length > 0) {
      const fieldList = missingFields.join(', ');
      const message = missingFields.length === 1 
        ? `Por favor, preencha: ${fieldList}`
        : `Por favor, preencha: ${fieldList}`;
      toast.error(message);
      return;
    }

    try {
      setLoading(true);

      const method = editingArea ? 'PUT' : 'POST';
      const url = editingArea ? `?id=${editingArea.id}` : '';

      const { data, error } = await supabase.functions.invoke(`service-provider-areas${url}`, {
        method,
        body: formData
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(editingArea ? 'Área atualizada com sucesso' : 'Área criada com sucesso');
        setIsDialogOpen(false);
        setEditingArea(null);
        setFormData({
          city_name: '',
          state: '',
          lat: 0,
          lng: 0,
          radius_km: 30,
          service_types: [],
          is_active: true
        });
        fetchServiceAreas();
      }
    } catch (error) {
      console.error('Error saving service provider area:', error);
      toast.error('Erro ao salvar área de atendimento');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (area: ServiceProviderArea) => {
    setEditingArea(area);
    setFormData({
      city_name: area.city_name,
      state: area.state || '',
      lat: area.lat,
      lng: area.lng,
      radius_km: area.radius_km,
      service_types: area.service_types || [],
      is_active: area.is_active
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (areaId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta área de atendimento?')) return;

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke(`service-provider-areas?id=${areaId}`, {
        method: 'DELETE'
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Área excluída com sucesso');
        fetchServiceAreas();
      }
    } catch (error) {
      console.error('Error deleting service provider area:', error);
      toast.error('Erro ao excluir área de atendimento');
    } finally {
      setLoading(false);
    }
  };

  const toggleAreaStatus = async (area: ServiceProviderArea) => {
    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke(`service-provider-areas?id=${area.id}`, {
        method: 'PUT',
        body: { is_active: !area.is_active }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(area.is_active ? 'Área desativada' : 'Área ativada');
        fetchServiceAreas();
      }
    } catch (error) {
      console.error('Error updating area status:', error);
      toast.error('Erro ao alterar status da área');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceTypeChange = (serviceType: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      service_types: checked 
        ? [...prev.service_types, serviceType]
        : prev.service_types.filter(type => type !== serviceType)
    }));
  };

  if (loading && serviceAreas.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Carregando áreas de atendimento...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Áreas de Atendimento
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Configure as regiões e tipos de serviços que você oferece
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingArea(null);
                setFormData({
                  city_name: '',
                  state: '',
                  lat: 0,
                  lng: 0,
                  radius_km: 30,
                  service_types: [],
                  is_active: true
                });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Área
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingArea ? 'Editar Área' : 'Nova Área de Atendimento'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
<UnifiedLocationInput
  label="Cidade de Atendimento *"
  value={formData.city_name && formData.state ? `${formData.city_name}, ${formData.state}` : ''}
  onChange={(value, locationData) => {
    if (locationData && locationData.city && locationData.state) {
      setFormData(prev => ({
        ...prev,
        city_name: locationData.city || '',
        state: locationData.state || '',
        city_id: locationData.cityId,
        lat: locationData.lat ?? prev.lat,
        lng: locationData.lng ?? prev.lng
      }));
    }
  }}
  placeholder="Digite CEP ou nome da cidade"
  required
/>


                <div>
                  <Label htmlFor="radius_km">Raio de Atendimento (km)</Label>
                  <Input
                    id="radius_km"
                    type="number"
                    min="1"
                    max="200"
                    value={formData.radius_km}
                    onChange={(e) => setFormData(prev => ({ ...prev, radius_km: parseInt(e.target.value) || 30 }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Distância máxima que você atende a partir desta localização
                  </p>
                </div>

                <div>
                  <Label>Tipos de Serviços Oferecidos</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {SERVICE_TYPES.map((serviceType) => (
                      <div key={serviceType} className="flex items-center space-x-2">
                        <Checkbox
                          id={serviceType}
                          checked={formData.service_types.includes(serviceType)}
                          onCheckedChange={(checked) => 
                            handleServiceTypeChange(serviceType, checked as boolean)
                          }
                        />
                        <Label htmlFor={serviceType} className="text-sm">
                          {SERVICE_TYPE_LABELS[serviceType]}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Deixe vazio para aceitar todos os tipos de serviço
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {editingArea ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {serviceAreas.length === 0 ? (
            <div className="text-center py-8">
              <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Você ainda não tem áreas de atendimento configuradas
              </p>
              <p className="text-sm text-muted-foreground">
                Configure suas áreas para receber solicitações de serviços da sua região
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {serviceAreas.map((area) => (
                <div
                  key={area.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium">{area.city_name}</h3>
                      {area.state && (
                        <Badge variant="secondary">{area.state}</Badge>
                      )}
                      <Badge variant={area.is_active ? 'default' : 'secondary'}>
                        {area.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Raio: {area.radius_km}km | Coord: {area.lat.toFixed(4)}, {area.lng.toFixed(4)}
                    </p>
                    {area.service_types.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {area.service_types.map((type) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {SERVICE_TYPE_LABELS[type] || type}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleAreaStatus(area)}
                    >
                      {area.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(area)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(area.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ServiceProviderAreasManager;
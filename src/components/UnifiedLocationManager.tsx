import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { MapPin, Plus, Edit, Trash2, Navigation, Settings, Target, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ServiceArea {
  id: string;
  city_name: string;
  state?: string;
  lat: number;
  lng: number;
  radius_km: number;
  service_types?: string[];
  is_active: boolean;
  created_at: string;
}

interface ServiceAreaFormData {
  city_name: string;
  state: string;
  lat: number;
  lng: number;
  radius_km: number;
  service_types: string[];
  is_active: boolean;
}

interface UnifiedLocationManagerProps {
  userType: 'MOTORISTA' | 'PRESTADOR_SERVICOS' | 'PRODUTOR' | 'TRANSPORTADORA';
  onAreasUpdate?: () => void;
}

// Tipos de serviços para prestadores
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

// Configurações por tipo de usuário
const USER_TYPE_CONFIG = {
  MOTORISTA: {
    title: 'Áreas de Atendimento - Fretes',
    description: 'Configure as regiões onde você atende fretes',
    emptyMessage: 'Configure suas áreas para receber fretes relevantes da sua região',
    defaultRadius: 50,
    maxRadius: 500,
    endpoint: 'driver-service-areas',
    spatialFunction: 'driver-spatial-matching',
    showServiceTypes: false,
    infoText: 'Sistema avançado com matching espacial por GPS. Configure múltiplas bases operacionais com raios específicos para receber apenas fretes relevantes da sua região.'
  },
  PRESTADOR_SERVICOS: {
    title: 'Áreas de Atendimento - Serviços',
    description: 'Configure apenas as regiões de atendimento. Os tipos de serviço são gerenciados na aba Serviços.',
    emptyMessage: 'Configure suas áreas para receber solicitações de serviços da sua região',
    defaultRadius: 30,
    maxRadius: 200,
    endpoint: 'service-provider-areas',
    spatialFunction: 'service-provider-spatial-matching',
    showServiceTypes: false,
    infoText: 'As cidades e raios são gerenciados aqui. Os tipos de serviço são configurados separadamente na aba "Serviços".'
  },
  PRODUTOR: {
    title: 'Áreas de Operação - Produção',
    description: 'Configure as regiões onde você opera/produz',
    emptyMessage: 'Configure suas áreas para melhor matching com motoristas e prestadores',
    defaultRadius: 100,
    maxRadius: 300,
    endpoint: 'producer-service-areas',
    spatialFunction: null,
    showServiceTypes: false,
    infoText: 'Configure suas regiões de operação para facilitar o encontro de motoristas e prestadores de serviços próximos.'
  }
};

const UnifiedLocationManager: React.FC<UnifiedLocationManagerProps> = ({ userType, onAreasUpdate }) => {
  const { profile } = useAuth();
  const config = USER_TYPE_CONFIG[userType];
  
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<ServiceArea | null>(null);
  const [formData, setFormData] = useState<ServiceAreaFormData>({
    city_name: '',
    state: '',
    lat: 0,
    lng: 0,
    radius_km: config.defaultRadius,
    service_types: [],
    is_active: true
  });

  const fetchServiceAreas = async () => {
    try {
      const { data, error } = await supabase.functions.invoke(config.endpoint, {
        method: 'GET'
      });

      if (error) throw error;

      if (data?.success) {
        setServiceAreas(data.service_areas || []);
      }
    } catch (error) {
      console.error(`Error fetching ${userType} service areas:`, error);
      toast.error('Erro ao carregar áreas de atendimento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchServiceAreas();
    }
  }, [profile]);

  const refreshMatches = async () => {
    if (!config.spatialFunction) return;
    
    try {
      await supabase.functions.invoke(config.spatialFunction, {
        method: 'POST',
        body: { refresh: true }
      });
      
      onAreasUpdate?.();
    } catch (error) {
      console.error('Error refreshing matches:', error);
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

  // Função para buscar coordenadas automaticamente baseado no nome da cidade
  const geocodeCity = async (cityName: string, state?: string) => {
    if (!cityName.trim()) return;
    
    try {
      const query = state ? `${cityName}, ${state}, Brasil` : `${cityName}, Brasil`;
      
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
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const missingFields: string[] = [];
    
    if (!formData.city_name?.trim()) {
      missingFields.push('Nome da cidade');
    }

    // Tentar buscar coordenadas se não tiver
    if ((!formData.lat || !formData.lng) && formData.city_name?.trim()) {
      toast.info('Buscando coordenadas da cidade...');
      await geocodeCity(formData.city_name);
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

      const { data, error } = await supabase.functions.invoke(`${config.endpoint}${url}`, {
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
          radius_km: config.defaultRadius,
          service_types: [],
          is_active: true
        });
        fetchServiceAreas();
        
        refreshMatches();
      }
    } catch (error) {
      console.error(`Error saving ${userType} service area:`, error);
      toast.error('Erro ao salvar área de atendimento');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (area: ServiceArea) => {
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

      const { data, error } = await supabase.functions.invoke(`${config.endpoint}?id=${areaId}`, {
        method: 'DELETE'
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Área excluída com sucesso');
        fetchServiceAreas();
        
        refreshMatches();
      }
    } catch (error) {
      console.error(`Error deleting ${userType} service area:`, error);
      toast.error('Erro ao excluir área de atendimento');
    } finally {
      setLoading(false);
    }
  };

  const toggleAreaStatus = async (area: ServiceArea) => {
    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke(`${config.endpoint}?id=${area.id}`, {
        method: 'PUT',
        body: { is_active: !area.is_active }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(area.is_active ? 'Área desativada' : 'Área ativada');
        fetchServiceAreas();
        
        refreshMatches();
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
      {/* Header com informações sobre matching inteligente */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Target className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-primary mb-1">Áreas de Atendimento Inteligentes</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {config.infoText}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {config.title}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {config.description}
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => {
                  setEditingArea(null);
                  setFormData({
                    city_name: '',
                    state: '',
                    lat: 0,
                    lng: 0,
                    radius_km: config.defaultRadius,
                    service_types: [],
                    is_active: true
                  });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Área
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  {editingArea ? 'Editar Área' : 'Nova Área de Atendimento'}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="city_name">Cidade *</Label>
                  <Input
                    id="city_name"
                    value={formData.city_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, city_name: e.target.value }))}
                    placeholder="Ex: Primavera do Leste"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="Ex: MT"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="lat">Latitude *</Label>
                    <Input
                      id="lat"
                      type="number"
                      step="any"
                      value={formData.lat}
                      onChange={(e) => setFormData(prev => ({ ...prev, lat: parseFloat(e.target.value) || 0 }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lng">Longitude *</Label>
                    <Input
                      id="lng"
                      type="number"
                      step="any"
                      value={formData.lng}
                      onChange={(e) => setFormData(prev => ({ ...prev, lng: parseFloat(e.target.value) || 0 }))}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={getCurrentLocation}
                  className="w-full"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Usar Localização Atual
                </Button>

                <div>
                  <Label htmlFor="radius_km">Raio de Atendimento (km)</Label>
                  <Input
                    id="radius_km"
                    type="number"
                    min="1"
                    max={config.maxRadius}
                    value={formData.radius_km}
                    onChange={(e) => setFormData(prev => ({ ...prev, radius_km: parseInt(e.target.value) || config.defaultRadius }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Distância máxima que você atende a partir desta localização
                  </p>
                </div>

                {config.showServiceTypes && (
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
                )}

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
                {config.emptyMessage}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {serviceAreas.map((area) => (
                <div
                  key={area.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium">{area.city_name}</h3>
                      {area.state && (
                        <Badge variant="secondary">{area.state}</Badge>
                      )}
                      <Badge variant={area.is_active ? 'default' : 'secondary'} className={area.is_active ? 'bg-primary text-primary-foreground' : ''}>
                        {area.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Raio: {area.radius_km}km | Coord: {area.lat.toFixed(4)}, {area.lng.toFixed(4)}
                    </p>
                    {config.showServiceTypes && area.service_types && area.service_types.length > 0 && (
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

export default UnifiedLocationManager;
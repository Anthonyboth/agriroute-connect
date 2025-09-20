import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { MapPin, Plus, Edit, Trash2, Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ServiceArea {
  id: string;
  city_name: string;
  state?: string;
  lat: number;
  lng: number;
  radius_km: number;
  is_active: boolean;
  created_at: string;
}

interface ServiceAreaFormData {
  city_name: string;
  state: string;
  lat: number;
  lng: number;
  radius_km: number;
  is_active: boolean;
}

const DriverServiceAreasManager = () => {
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<ServiceArea | null>(null);
  const [formData, setFormData] = useState<ServiceAreaFormData>({
    city_name: '',
    state: '',
    lat: 0,
    lng: 0,
    radius_km: 50,
    is_active: true
  });

  const fetchServiceAreas = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('driver-service-areas', {
        method: 'GET'
      });

      if (error) throw error;

      if (data?.success) {
        setServiceAreas(data.service_areas);
      }
    } catch (error) {
      console.error('Error fetching service areas:', error);
      toast.error('Erro ao carregar áreas de atendimento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceAreas();
  }, []);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }));
          toast.success('Localização atual capturada');
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Erro ao obter localização atual');
        }
      );
    } else {
      toast.error('Geolocalização não suportada neste navegador');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.city_name || !formData.lat || !formData.lng) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setLoading(true);

      const method = editingArea ? 'PUT' : 'POST';
      const url = editingArea ? `?id=${editingArea.id}` : '';

      const { data, error } = await supabase.functions.invoke(`driver-service-areas${url}`, {
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
          radius_km: 50,
          is_active: true
        });
        fetchServiceAreas();
      }
    } catch (error) {
      console.error('Error saving service area:', error);
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
      is_active: area.is_active
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (areaId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta área de atendimento?')) return;

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke(`driver-service-areas?id=${areaId}`, {
        method: 'DELETE'
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Área excluída com sucesso');
        fetchServiceAreas();
      }
    } catch (error) {
      console.error('Error deleting service area:', error);
      toast.error('Erro ao excluir área de atendimento');
    } finally {
      setLoading(false);
    }
  };

  const toggleAreaStatus = async (area: ServiceArea) => {
    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke(`driver-service-areas?id=${area.id}`, {
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
              <MapPin className="h-5 w-5" />
              Áreas de Atendimento
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Configure as regiões onde você atende fretes
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
                  radius_km: 50,
                  is_active: true
                });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Área
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingArea ? 'Editar Área' : 'Nova Área de Atendimento'}
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
                    max="500"
                    value={formData.radius_km}
                    onChange={(e) => setFormData(prev => ({ ...prev, radius_km: parseInt(e.target.value) || 50 }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Distância máxima que você atende a partir desta localização
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
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Você ainda não tem áreas de atendimento configuradas
              </p>
              <p className="text-sm text-muted-foreground">
                Configure suas áreas para receber fretes relevantes da sua região
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
                    <p className="text-sm text-muted-foreground">
                      Raio: {area.radius_km}km | Coord: {area.lat.toFixed(4)}, {area.lng.toFixed(4)}
                    </p>
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

export default DriverServiceAreasManager;
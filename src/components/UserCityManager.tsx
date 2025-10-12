import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { CitySelector } from './CitySelector';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface UserCity {
  id: string;
  city_id: string;
  city_name: string;
  city_state: string;
  type: 'MOTORISTA_ORIGEM' | 'MOTORISTA_DESTINO' | 'PRESTADOR_SERVICO' | 'PRODUTOR_LOCALIZACAO';
  radius_km: number;
  is_active: boolean;
}

interface UserCityManagerProps {
  userRole: 'MOTORISTA' | 'PRESTADOR_SERVICOS' | 'PRODUTOR';
  onCitiesUpdate?: () => void;
}

const TYPE_LABELS = {
  MOTORISTA_ORIGEM: 'Buscar Origem',
  MOTORISTA_DESTINO: 'Buscar Destino',
  PRESTADOR_SERVICO: 'Prestar Serviço',
  PRODUTOR_LOCALIZACAO: 'Localização'
};

const TYPE_OPTIONS = {
  MOTORISTA: ['MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO'],
  PRESTADOR_SERVICOS: ['PRESTADOR_SERVICO'],
  PRODUTOR: ['PRODUTOR_LOCALIZACAO']
};

export function UserCityManager({ userRole, onCitiesUpdate }: UserCityManagerProps) {
  const { user } = useAuth();
  const [cities, setCities] = useState<UserCity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<{ city: string; state: string; id?: string } | null>(null);
  const [selectedType, setSelectedType] = useState<UserCity['type'] | ''>('');
  const [radius, setRadius] = useState(50);

  useEffect(() => {
    if (user) {
      fetchUserCities();
    }
  }, [user]);

  const fetchUserCities = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_cities')
        .select(`
          id,
          city_id,
          type,
          radius_km,
          is_active,
          cities (
            name,
            state
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedCities = data?.map(item => ({
        id: item.id,
        city_id: item.city_id,
        city_name: (item.cities as any)?.name || '',
        city_state: (item.cities as any)?.state || '',
        type: item.type as UserCity['type'],
        radius_km: item.radius_km,
        is_active: item.is_active
      })) || [];

      setCities(formattedCities);
    } catch (error) {
      console.error('Erro ao buscar cidades:', error);
      toast.error('Erro ao carregar suas cidades');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCity = async () => {
    if (!selectedCity || !selectedType || !user) {
      toast.error('Selecione uma cidade e tipo');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_cities')
        .insert([{
          city_id: selectedCity.id,
          type: selectedType,
          radius_km: radius,
          is_active: true
        }]);

      if (error) {
        if (error.code === '23505') {
          toast.error('Esta cidade e tipo já foram adicionados');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Cidade adicionada com sucesso!');
      setIsDialogOpen(false);
      setSelectedCity(null);
      setSelectedType('');
      setRadius(50);
      fetchUserCities();
      onCitiesUpdate?.();
    } catch (error) {
      console.error('Erro ao adicionar cidade:', error);
      toast.error('Erro ao adicionar cidade');
    }
  };

  const handleRemoveCity = async (cityId: string) => {
    try {
      const { error } = await supabase
        .from('user_cities')
        .delete()
        .eq('id', cityId);

      if (error) throw error;

      toast.success('Cidade removida');
      fetchUserCities();
      onCitiesUpdate?.();
    } catch (error) {
      console.error('Erro ao remover cidade:', error);
      toast.error('Erro ao remover cidade');
    }
  };

  const handleToggleActive = async (cityId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('user_cities')
        .update({ is_active: !currentStatus })
        .eq('id', cityId);

      if (error) throw error;

      toast.success(!currentStatus ? 'Cidade ativada' : 'Cidade desativada');
      fetchUserCities();
      onCitiesUpdate?.();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleUpdateRadius = async (cityId: string, newRadius: number) => {
    try {
      const { error } = await supabase
        .from('user_cities')
        .update({ radius_km: newRadius })
        .eq('id', cityId);

      if (error) throw error;

      setCities(prev => prev.map(c => 
        c.id === cityId ? { ...c, radius_km: newRadius } : c
      ));
    } catch (error) {
      console.error('Erro ao atualizar raio:', error);
      toast.error('Erro ao atualizar raio');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const typeOptions = TYPE_OPTIONS[userRole] || [];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Minhas Cidades de Atendimento
              </CardTitle>
              <CardDescription>
                Gerencie as cidades onde você atua (raio máximo: 300km por cidade)
              </CardDescription>
            </div>
            <Button onClick={() => setIsDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Cidade
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {cities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhuma cidade cadastrada ainda</p>
              <p className="text-sm">Adicione cidades para começar a receber solicitações</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cities.map(city => (
                <Card key={city.id} className={!city.is_active ? 'opacity-60' : ''}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{city.city_name}, {city.city_state}</h4>
                          <Badge variant={city.is_active ? 'default' : 'secondary'}>
                            {TYPE_LABELS[city.type]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Raio de atendimento: {city.radius_km}km
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(city.id, city.is_active)}
                        >
                          {city.is_active ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveCity(city.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">
                        Ajustar raio (1-300km)
                      </label>
                      <Slider
                        value={[city.radius_km]}
                        onValueChange={(value) => handleUpdateRadius(city.id, value[0])}
                        min={1}
                        max={300}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Cidade</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Cidade</label>
              <CitySelector
                value={selectedCity ? { city: selectedCity.city, state: selectedCity.state } : undefined}
                onChange={(city) => setSelectedCity({ 
                  city: city.city, 
                  state: city.state
                })}
                placeholder="Digite o nome da cidade..."
              />
              {selectedCity && (
                <p className="text-sm text-muted-foreground mt-1">
                  Selecionada: {selectedCity.city}, {selectedCity.state}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Tipo de Uso</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map(type => (
                    <SelectItem key={type} value={type}>
                      {TYPE_LABELS[type as keyof typeof TYPE_LABELS]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Raio de atendimento: {radius}km
              </label>
              <Slider
                value={[radius]}
                onValueChange={(value) => setRadius(value[0])}
                min={1}
                max={300}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Você receberá solicitações dentro deste raio da cidade selecionada
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddCity}
                disabled={!selectedCity || !selectedType}
              >
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
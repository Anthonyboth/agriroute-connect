import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Plus, X, Settings, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ServiceRegionSelectorProps {
  onClose?: () => void;
}

const BRAZILIAN_STATES = [
  { code: 'AC', name: 'Acre' },
  { code: 'AL', name: 'Alagoas' },
  { code: 'AP', name: 'Amapá' },
  { code: 'AM', name: 'Amazonas' },
  { code: 'BA', name: 'Bahia' },
  { code: 'CE', name: 'Ceará' },
  { code: 'DF', name: 'Distrito Federal' },
  { code: 'ES', name: 'Espírito Santo' },
  { code: 'GO', name: 'Goiás' },
  { code: 'MA', name: 'Maranhão' },
  { code: 'MT', name: 'Mato Grosso' },
  { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MG', name: 'Minas Gerais' },
  { code: 'PA', name: 'Pará' },
  { code: 'PB', name: 'Paraíba' },
  { code: 'PR', name: 'Paraná' },
  { code: 'PE', name: 'Pernambuco' },
  { code: 'PI', name: 'Piauí' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'RN', name: 'Rio Grande do Norte' },
  { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'RO', name: 'Rondônia' },
  { code: 'RR', name: 'Roraima' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'SP', name: 'São Paulo' },
  { code: 'SE', name: 'Sergipe' },
  { code: 'TO', name: 'Tocantins' }
];

export const ServiceRegionSelector: React.FC<ServiceRegionSelectorProps> = ({ onClose }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [serviceCities, setServiceCities] = useState<string[]>([]);
  const [serviceStates, setServiceStates] = useState<string[]>([]);
  const [serviceRadius, setServiceRadius] = useState(50);
  const [newCity, setNewCity] = useState('');
  const [selectedState, setSelectedState] = useState('');

  useEffect(() => {
    if (user) {
      fetchServiceRegions();
    }
  }, [user]);

  const fetchServiceRegions = async () => {
    if (!user) return;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('service_cities, service_states, service_radius_km')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (profile) {
        setServiceCities(profile.service_cities || []);
        setServiceStates(profile.service_states || []);
        setServiceRadius(profile.service_radius_km || 50);
      }
    } catch (error) {
      console.error('Erro ao buscar regiões de atendimento:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar suas regiões de atendimento.",
        variant: "destructive",
      });
    }
  };

  const handleSaveRegions = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          service_cities: serviceCities.length > 0 ? serviceCities : null,
          service_states: serviceStates.length > 0 ? serviceStates : null,
          service_radius_km: serviceRadius
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Regiões atualizadas!",
        description: "Suas regiões de atendimento foram salvas com sucesso.",
      });

      if (onClose) onClose();
    } catch (error) {
      console.error('Erro ao salvar regiões:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar regiões de atendimento.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addCity = () => {
    if (newCity.trim() && !serviceCities.includes(newCity.trim())) {
      setServiceCities([...serviceCities, newCity.trim()]);
      setNewCity('');
    }
  };

  const removeCity = (city: string) => {
    setServiceCities(serviceCities.filter(c => c !== city));
  };

  const addState = (stateCode: string) => {
    if (!serviceStates.includes(stateCode)) {
      setServiceStates([...serviceStates, stateCode]);
    }
  };

  const removeState = (stateCode: string) => {
    setServiceStates(serviceStates.filter(s => s !== stateCode));
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <CardTitle>Configurar Região de Atendimento</CardTitle>
        </div>
        <CardDescription>
          Configure as cidades e estados onde você deseja atender. Você só verá solicitações dessas regiões.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Estados */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Estados de Atendimento</Label>
          <div className="flex gap-2 mb-3">
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um estado" />
              </SelectTrigger>
              <SelectContent>
                {BRAZILIAN_STATES.filter(state => !serviceStates.includes(state.code)).map(state => (
                  <SelectItem key={state.code} value={state.code}>
                    {state.name} ({state.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={() => {
                if (selectedState) {
                  addState(selectedState);
                  setSelectedState('');
                }
              }}
              disabled={!selectedState}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {serviceStates.map(stateCode => {
              const state = BRAZILIAN_STATES.find(s => s.code === stateCode);
              return (
                <Badge key={stateCode} variant="secondary" className="flex items-center gap-1">
                  {state?.name} ({stateCode})
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={() => removeState(stateCode)}
                  />
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Cidades */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Cidades Específicas</Label>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Digite o nome da cidade"
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCity()}
            />
            <Button onClick={addCity} disabled={!newCity.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {serviceCities.map(city => (
              <Badge key={city} variant="outline" className="flex items-center gap-1">
                {city}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-destructive" 
                  onClick={() => removeCity(city)}
                />
              </Badge>
            ))}
          </div>
          {serviceCities.length === 0 && serviceStates.length === 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Sem regiões configuradas, você verá solicitações de todas as localidades.
              </p>
            </div>
          )}
        </div>

        {/* Raio de Atendimento */}
        <div>
          <Label className="text-sm font-medium mb-2 block">
            Raio de Atendimento: {serviceRadius} km
          </Label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="10"
              max="500"
              step="10"
              value={serviceRadius}
              onChange={(e) => setServiceRadius(parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <Input
              type="number"
              min="10"
              max="500"
              value={serviceRadius}
              onChange={(e) => setServiceRadius(parseInt(e.target.value) || 50)}
              className="w-20"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Distância máxima para visualizar solicitações de fretes (em quilômetros)
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-4">
          <Button onClick={handleSaveRegions} disabled={loading} className="flex-1">
            {loading ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
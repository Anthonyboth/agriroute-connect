import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin, X, Plus, Navigation } from 'lucide-react';
import { useCitySearch } from '@/hooks/useCitySearch';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UserLocationSelectorProps {
  onLocationChange?: (location: UserLocation) => void;
}

interface UserLocation {
  city: string;
  state: string;
  lat: number;
  lng: number;
}

export const UserLocationSelector: React.FC<UserLocationSelectorProps> = ({ onLocationChange }) => {
  const { profile } = useAuth();
  const [currentLocation, setCurrentLocation] = useState<UserLocation | null>(null);
  const [citySearch, setCitySearch] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [loading, setLoading] = useState(false);

  const { cities, isLoading: searchLoading, searchCities } = useCitySearch();

  const brazilianStates = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  // Carregar localização atual do perfil
  useEffect(() => {
    if (profile?.base_city_name && profile?.base_state && profile?.base_lat && profile?.base_lng) {
      const location: UserLocation = {
        city: profile.base_city_name,
        state: profile.base_state,
        lat: profile.base_lat,
        lng: profile.base_lng
      };
      setCurrentLocation(location);
      setCitySearch(profile.base_city_name);
      setSelectedState(profile.base_state);
    }
  }, [profile]);

  // Buscar cidades conforme o usuário digita
  useEffect(() => {
    if (citySearch.length >= 2) {
      searchCities(citySearch);
    }
  }, [citySearch, searchCities]);

  // Obter localização atual via GPS
  const getCurrentLocation = () => {
    setLoading(true);
    
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada pelo navegador');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Usar geocoding reverso para obter o nome da cidade
          const response = await fetch(
            `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=YOUR_API_KEY&language=pt`
          );
          
          if (response.ok) {
            const data = await response.json();
            const result = data.results[0];
            const city = result.components.city || result.components.town || result.components.village || '';
            const state = result.components.state_code || '';
            
            const location: UserLocation = {
              city,
              state,
              lat: latitude,
              lng: longitude
            };
            
            setCurrentLocation(location);
            setCitySearch(city);
            setSelectedState(state);
            setManualLat(latitude.toString());
            setManualLng(longitude.toString());
            
            toast.success('Localização obtida com sucesso!');
          }
        } catch (error) {
          // Usar coordenadas mesmo sem geocoding
          setManualLat(latitude.toString());
          setManualLng(longitude.toString());
          toast.success('Coordenadas obtidas. Preencha a cidade manualmente.');
        }
        
        setLoading(false);
      },
      (error) => {
        toast.error('Erro ao obter localização. Verifique as permissões.');
        setLoading(false);
      }
    );
  };

  // Selecionar cidade da lista de sugestões
  const selectCity = (city: any) => {
    const location: UserLocation = {
      city: city.display_name,
      state: city.state,
      lat: parseFloat(city.lat || '0'),
      lng: parseFloat(city.lng || '0')
    };
    
    setCurrentLocation(location);
    setCitySearch(city.display_name);
    setSelectedState(city.state);
    setManualLat(city.lat || '');
    setManualLng(city.lng || '');
    
    onLocationChange?.(location);
  };

  // Salvar localização manualmente
  const saveManualLocation = () => {
    if (!citySearch || !selectedState || !manualLat || !manualLng) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const location: UserLocation = {
      city: citySearch,
      state: selectedState,
      lat: parseFloat(manualLat),
      lng: parseFloat(manualLng)
    };

    setCurrentLocation(location);
    onLocationChange?.(location);
    toast.success('Localização definida com sucesso!');
  };

  // Salvar no perfil do usuário
  const saveToProfile = async () => {
    if (!currentLocation || !profile?.id) {
      toast.error('Defina uma localização primeiro');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          base_city_name: currentLocation.city,
          base_state: currentLocation.state,
          base_lat: currentLocation.lat,
          base_lng: currentLocation.lng,
          current_city_name: currentLocation.city,
          current_state: currentLocation.state
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('Localização salva no seu perfil!');
    } catch (error) {
      console.error('Erro ao salvar localização:', error);
      toast.error('Erro ao salvar localização');
    } finally {
      setLoading(false);
    }
  };

  // Remover localização atual
  const clearLocation = () => {
    setCurrentLocation(null);
    setCitySearch('');
    setSelectedState('');
    setManualLat('');
    setManualLng('');
    onLocationChange?.(null as any);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Localização do Atendimento
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure sua cidade e coordenadas para encontrar prestadores da sua região
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Localização Atual */}
          {currentLocation && (
            <div className="p-3 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Sua localização atual</h4>
              <Badge variant="outline" className="mb-2">
                <MapPin className="h-3 w-3 mr-1" />
                {currentLocation.city}, {currentLocation.state}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2 h-auto p-1"
                  onClick={clearLocation}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
              <p className="text-xs text-muted-foreground">
                Esta será sua cidade principal e será automaticamente incluída nas cidades de atendimento.
              </p>
            </div>
          )}

          {/* Busca de Cidade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade *</Label>
              <Input
                id="city"
                placeholder="Ex: Primavera do Leste"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
              />
              
              {/* Sugestões de cidades */}
              {cities.length > 0 && citySearch.length >= 2 && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {cities.map((city) => (
                    <button
                      key={city.id}
                      className="w-full text-left p-2 hover:bg-muted text-sm border-b last:border-b-0"
                      onClick={() => selectCity(city)}
                    >
                      {city.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">Estado *</Label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent>
                  {brazilianStates.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Coordenadas Geográficas */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Coordenadas Geográficas *</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={getCurrentLocation}
                disabled={loading}
              >
                <Navigation className="h-4 w-4 mr-2" />
                Usar Localização Atual
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude *</Label>
                <Input
                  id="latitude"
                  placeholder="Ex: -15.5561"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude *</Label>
                <Input
                  id="longitude"
                  placeholder="Ex: -54.2964"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                />
              </div>
            </div>

            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>⚠️</strong> As coordenadas são obrigatórias para que prestadores da sua região possam encontrar suas solicitações.
              </p>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-2 pt-4">
            <Button 
              onClick={saveManualLocation}
              disabled={!citySearch || !selectedState || !manualLat || !manualLng}
            >
              <Plus className="h-4 w-4 mr-2" />
              Definir Localização
            </Button>
            
            {currentLocation && (
              <Button 
                variant="outline" 
                onClick={saveToProfile}
                disabled={loading}
              >
                Salvar no Perfil
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
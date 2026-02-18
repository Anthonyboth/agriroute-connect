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
  const getCurrentLocation = async () => {
    setLoading(true);
    
    try {
      const { getCurrentPositionSafe } = await import('@/utils/location');
      const position = await getCurrentPositionSafe();
      const { latitude, longitude } = position.coords;
      
      setManualLat(latitude.toString());
      setManualLng(longitude.toString());
      
      toast.success(`Coordenadas GPS capturadas: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      toast.info('Digite o nome da sua cidade para confirmar a localização');
    } catch (error) {
      console.error('Erro ao obter localização:', error);
      toast.error('Erro ao obter localização. Verifique as permissões.');
    } finally {
      setLoading(false);
    }
  };

  // Selecionar cidade da lista de sugestões
  const selectCity = (city: any) => {
    const lat = parseFloat(manualLat) || city.lat;
    const lng = parseFloat(manualLng) || city.lng;
    
    if (!lat || !lng) {
      toast.error('Coordenadas inválidas. Use o botão GPS ou insira manualmente.');
      return;
    }

    const location: UserLocation = {
      city: city.name,
      state: city.state,
      lat: lat,
      lng: lng
    };

    setCurrentLocation(location);
    setCitySearch(city.name);
    setSelectedState(city.state);
    setManualLat(lat.toString());
    setManualLng(lng.toString());
    
    onLocationChange?.(location);
    toast.success(`Localização definida: ${city.name}, ${city.state}`);
  };

  // Confirmar localização manual
  const confirmManualLocation = () => {
    const missingFields: string[] = [];
    
    if (!citySearch?.trim()) {
      missingFields.push('Nome da cidade');
    }
    if (!selectedState) {
      missingFields.push('Estado');
    }
    if (!manualLat?.trim()) {
      missingFields.push('Latitude');
    }
    if (!manualLng?.trim()) {
      missingFields.push('Longitude');
    }

    if (missingFields.length > 0) {
      const fieldList = missingFields.join(', ');
      const message = missingFields.length === 1 
        ? `Por favor, preencha: ${fieldList}`
        : `Por favor, preencha: ${fieldList}`;
      toast.error(message);
      return;
    }

    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);

    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Coordenadas inválidas. Verifique os valores de latitude e longitude.');
      return;
    }

    const location: UserLocation = {
      city: citySearch,
      state: selectedState,
      lat: lat,
      lng: lng
    };

    setCurrentLocation(location);
    onLocationChange?.(location);
    toast.success(`Localização confirmada: ${citySearch}, ${selectedState}`);
  };

  return (
    <div className="space-y-4">
      {/* Localização Atual */}
      {currentLocation && (
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-600" />
              Localização Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{currentLocation.city}, {currentLocation.state}</p>
                <p className="text-xs text-muted-foreground">
                  {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  setCurrentLocation(null);
                  setCitySearch('');
                  setSelectedState('');
                  setManualLat('');
                  setManualLng('');
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* GPS Button */}
      <div className="flex gap-2">
        <Button 
          onClick={getCurrentLocation}
          disabled={loading}
          variant="outline"
          className="flex-1"
        >
          <Navigation className="mr-2 h-4 w-4" />
          {loading ? 'Obtendo GPS...' : 'Usar Localização Atual (GPS)'}
        </Button>
      </div>

      {/* Busca de Cidade */}
      <div className="space-y-2">
        <Label>Pesquisar Cidade</Label>
        <Input
          value={citySearch}
          onChange={(e) => setCitySearch(e.target.value)}
          placeholder="Digite o nome da cidade..."
        />
      </div>

      {/* Lista de Cidades Sugeridas */}
      {cities.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cidades Encontradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {cities.slice(0, 5).map((city) => (
                <Button
                  key={`${city.name}-${city.state}`}
                  variant="ghost"
                  className="w-full justify-start text-left p-2 h-auto"
                  onClick={() => selectCity(city)}
                >
                  <div>
                    <p className="font-medium">{city.name}</p>
                    <p className="text-xs text-muted-foreground">{city.state}</p>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entrada Manual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Definir Localização Manualmente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Cidade *</Label>
              <Input
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="Nome da cidade"
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estado *</Label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  {brazilianStates.map((state) => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Latitude *</Label>
              <Input
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="-15.123456"
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Longitude *</Label>
              <Input
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                placeholder="-54.123456"
                className="text-sm"
              />
            </div>
          </div>

          <Button 
            onClick={confirmManualLocation}
            className="w-full"
            size="sm"
          >
            <Plus className="mr-2 h-3 w-3" />
            Confirmar Localização
          </Button>

        </CardContent>
      </Card>
    </div>
  );
};
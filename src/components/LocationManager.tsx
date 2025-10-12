import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { MapPin, Settings, Check, AlertCircle, Navigation } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLocationPermission } from '@/hooks/useLocationPermission';
import { CitySelector } from './CitySelector';

interface LocationManagerProps {
  onClose?: () => void;
}


export const LocationManager: React.FC<LocationManagerProps> = ({ onClose }) => {
  const { profile } = useAuth();
  const { hasPermission, coords, requestLocation } = useLocationPermission(false);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cityId, setCityId] = useState<string | null>(null);
  const [city, setCity] = useState({ city: '', state: '' });
  const [serviceRadius, setServiceRadius] = useState(100);

  // Carregar dados atuais do perfil
  useEffect(() => {
    const loadProfile = async () => {
      if (profile?.id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('base_city_id, base_city_name, base_state, service_radius_km, cities(name, state)')
          .eq('id', profile.id)
          .single();

        if (data) {
          setCityId(data.base_city_id);
          setCity({
            city: data.base_city_name || '',
            state: data.base_state || ''
          });
          setServiceRadius(data.service_radius_km || 100);
        }
      }
    };
    loadProfile();
  }, [profile]);

  const handleCityChange = async (newCity: { city: string; state: string }) => {
    setCity(newCity);
    
    // Buscar city_id
    if (newCity.city && newCity.state) {
      const { data } = await supabase
        .rpc('search_cities', { search_term: newCity.city, limit_count: 1 });
      
      if (data && data.length > 0 && data[0].state === newCity.state) {
        setCityId(data[0].id);
      }
    }
  };

  const handleSaveLocation = async () => {
    if (!profile?.id) return;

    if (!city.city || !city.state) {
      toast.error('Por favor, selecione uma cidade válida');
      return;
    }

    if (serviceRadius < 10 || serviceRadius > 500) {
      toast.error('O raio de atendimento deve ser entre 10 e 500 km');
      return;
    }

    // Se não temos city_id, buscar novamente
    let finalCityId = cityId;
    if (!finalCityId) {
      const { data } = await supabase.rpc('search_cities', { 
        search_term: city.city, 
        limit_count: 1 
      });
      
      if (data && data.length > 0 && data[0].state === city.state) {
        finalCityId = data[0].id;
      }
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          base_city_id: finalCityId,
          base_city_name: city.city.trim(),
          base_state: city.state,
          service_radius_km: serviceRadius
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('Configurações de localização salvas com sucesso!');
      onClose?.();
    } catch (error) {
      console.error('Error saving location:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const getRadiusColor = (radius: number) => {
    if (radius <= 50) return 'text-green-600';
    if (radius <= 100) return 'text-blue-600';
    if (radius <= 200) return 'text-orange-600';
    return 'text-red-600';
  };

  const hasValidLocation = city.city && city.state;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Configurar Região de Atendimento
          </CardTitle>
          <CardDescription>
            Defina sua cidade base e raio de atendimento para receber apenas as solicitações relevantes para sua região.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status da Localização */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              {hasValidLocation ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-orange-500" />
              )}
              <div>
                <p className="font-medium">
                  {hasValidLocation ? 'Localização Configurada' : 'Localização Pendente'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {hasValidLocation 
                    ? `${city.city}, ${city.state} - Raio: ${serviceRadius}km`
                    : 'Configure sua região de atendimento abaixo'
                  }
                </p>
              </div>
            </div>
            {hasValidLocation && (
              <Badge className="bg-green-100 text-green-800 border-green-200">
                Ativo
              </Badge>
            )}
          </div>

          {/* Seletor de Cidade */}
          <div className="space-y-2">
            <CitySelector
              value={city}
              onChange={handleCityChange}
              label="Cidade Base"
              placeholder="Digite sua cidade..."
              required
            />
          </div>

          {/* Raio de Atendimento */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Raio de Atendimento</Label>
              <Badge className={getRadiusColor(serviceRadius)}>
                {serviceRadius} km
              </Badge>
            </div>
            
            <div className="space-y-3">
              <Slider
                value={[serviceRadius]}
                onValueChange={([value]) => setServiceRadius(value)}
                min={10}
                max={500}
                step={10}
                className="w-full"
              />
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>10 km</span>
                <span>Região Local</span>
                <span>500 km</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {serviceRadius <= 50 && '🟢 Atendimento local - ideal para serviços urbanos'}
              {serviceRadius > 50 && serviceRadius <= 100 && '🔵 Atendimento regional - cidades próximas'}
              {serviceRadius > 100 && serviceRadius <= 200 && '🟠 Atendimento estadual - maior área de cobertura'}
              {serviceRadius > 200 && '🔴 Atendimento interestadual - cobertura ampla'}
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-4">
            <Button 
              onClick={handleSaveLocation} 
              disabled={saving || !city.city || !city.state}
              className="flex-1"
            >
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
            
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Informações Importantes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-primary" />
            Como Funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <p className="flex items-start gap-2">
              <span className="font-medium text-green-600">✓</span>
              Você receberá apenas solicitações dentro do raio configurado
            </p>
            <p className="flex items-start gap-2">
              <span className="font-medium text-green-600">✓</span>
              O sistema calcula a distância real entre os pontos
            </p>
            <p className="flex items-start gap-2">
              <span className="font-medium text-green-600">✓</span>
              Solicitações são ordenadas por proximidade
            </p>
            <p className="flex items-start gap-2">
              <span className="font-medium text-orange-600">⚠️</span>
              Sem localização configurada, você não receberá solicitações
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
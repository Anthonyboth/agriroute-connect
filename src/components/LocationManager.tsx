import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { MapPin, Settings, Check, AlertCircle, Navigation } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLocationPermission } from '@/hooks/useLocationPermission';

interface LocationManagerProps {
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
  { code: 'TO', name: 'Tocantins' },
];

export const LocationManager: React.FC<LocationManagerProps> = ({ onClose }) => {
  const { profile } = useAuth();
  const { hasPermission, coords, requestLocation } = useLocationPermission(false);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [baseCityName, setBaseCityName] = useState('');
  const [baseState, setBaseState] = useState('');
  const [baseLat, setBaseLat] = useState<number | null>(null);
  const [baseLng, setBaseLng] = useState<number | null>(null);
  const [serviceRadius, setServiceRadius] = useState(100);
  const [locationEnabled, setLocationEnabled] = useState(false);

  // Carregar dados atuais do perfil
  useEffect(() => {
    if (profile) {
      const profileAny = profile as any;
      setBaseCityName(profileAny.base_city_name || '');
      setBaseState(profileAny.base_state || '');
      setBaseLat(profileAny.base_lat || null);
      setBaseLng(profileAny.base_lng || null);
      setServiceRadius(profileAny.service_radius_km || 100);
      setLocationEnabled(profileAny.location_enabled || false);
    }
  }, [profile]);

  // Usar coordenadas atuais quando disponível
  useEffect(() => {
    if (coords && (!baseLat || !baseLng)) {
      setBaseLat(coords.latitude);
      setBaseLng(coords.longitude);
    }
  }, [coords, baseLat, baseLng]);

  const handleUseCurrentLocation = async () => {
    setLoading(true);
    try {
      const success = await requestLocation();
      if (success && coords) {
        setBaseLat(coords.latitude);
        setBaseLng(coords.longitude);
        toast.success('Localização atual capturada com sucesso!');
      } else {
        toast.error('Não foi possível obter sua localização');
      }
    } catch (error) {
      console.error('Error getting location:', error);
      toast.error('Erro ao obter localização');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!profile?.id) return;

    // Validações básicas
    if (!baseCityName.trim()) {
      toast.error('Por favor, informe a cidade base');
      return;
    }

    if (!baseState) {
      toast.error('Por favor, selecione o estado');
      return;
    }

    if (serviceRadius < 10 || serviceRadius > 500) {
      toast.error('O raio de atendimento deve ser entre 10 e 500 km');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          base_city_name: baseCityName.trim(),
          base_state: baseState,
          base_lat: baseLat,
          base_lng: baseLng,
          service_radius_km: serviceRadius,
          location_enabled: locationEnabled
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

  const hasValidLocation = baseLat && baseLng;

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
                    ? `${baseCityName}, ${baseState} - Raio: ${serviceRadius}km`
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

          {/* Configuração da Cidade Base */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade Base *</Label>
              <Input
                id="city"
                placeholder="Ex: Primavera do Leste"
                value={baseCityName}
                onChange={(e) => setBaseCityName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="state">Estado *</Label>
              <Select value={baseState} onValueChange={setBaseState}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent>
                  {BRAZILIAN_STATES.map((state) => (
                    <SelectItem key={state.code} value={state.code}>
                      {state.name} ({state.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Coordenadas e Localização Atual */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Coordenadas Geográficas</Label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleUseCurrentLocation}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <Navigation className="h-4 w-4" />
                {loading ? 'Obtendo...' : 'Usar Localização Atual'}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lat">Latitude</Label>
                <Input
                  id="lat"
                  type="number"
                  step="any"
                  placeholder="Ex: -15.5561"
                  value={baseLat || ''}
                  onChange={(e) => setBaseLat(e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lng">Longitude</Label>
                <Input
                  id="lng"
                  type="number"
                  step="any"
                  placeholder="Ex: -54.2964"
                  value={baseLng || ''}
                  onChange={(e) => setBaseLng(e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
            </div>

            {!hasPermission && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Para usar sua localização atual, permita o acesso à localização no navegador.
                </p>
              </div>
            )}
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
              disabled={saving || !baseCityName || !baseState}
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
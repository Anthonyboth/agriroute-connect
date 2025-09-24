import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, MapPin, X, Save, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CitySelector } from './CitySelector';

interface ProviderCityManagerProps {
  providerId: string;
  onCitiesUpdate?: (cities: string[]) => void;
}

export const ProviderCityManager: React.FC<ProviderCityManagerProps> = ({
  providerId,
  onCitiesUpdate
}) => {
  const { toast } = useToast();
  const [serviceCities, setServiceCities] = useState<string[]>([]);
  const [currentCity, setCurrentCity] = useState<{city: string, state: string} | null>(null);
  const [isAddingCity, setIsAddingCity] = useState(false);
  const [newCity, setNewCity] = useState<{city: string, state: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Carregar cidades do prestador
  const loadProviderCities = async () => {
    if (!providerId) return;

    setLoading(true);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('service_cities, current_city_name, current_state')
        .eq('id', providerId)
        .single();

      if (error) throw error;

      if (profile) {
        setServiceCities(profile.service_cities || []);
        setCurrentCity(
          profile.current_city_name && profile.current_state
            ? { city: profile.current_city_name, state: profile.current_state }
            : null
        );
      }
    } catch (error) {
      console.error('Error loading provider cities:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as cidades de atendimento.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Salvar cidades atualizadas
  const saveCities = async () => {
    if (!providerId) return;

    setSaving(true);
    try {
      const updateData: any = {
        service_cities: serviceCities
      };

      if (currentCity) {
        updateData.current_city_name = currentCity.city;
        updateData.current_state = currentCity.state;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', providerId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Cidades de atendimento atualizadas com sucesso!"
      });

      onCitiesUpdate?.(serviceCities);
    } catch (error) {
      console.error('Error saving cities:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as cidades. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Adicionar nova cidade
  const addCity = () => {
    if (!newCity) return;

    const cityString = `${newCity.city}, ${newCity.state}`;
    
    if (serviceCities.includes(cityString)) {
      toast({
        title: "Cidade já adicionada",
        description: "Esta cidade já está na sua lista de atendimento.",
        variant: "destructive"
      });
      return;
    }

    setServiceCities(prev => [...prev, cityString]);
    setNewCity(null);
    setIsAddingCity(false);
  };

  // Remover cidade
  const removeCity = (cityToRemove: string) => {
    setServiceCities(prev => prev.filter(city => city !== cityToRemove));
  };

  // Definir cidade atual
  const setCurrentCityFromSelection = (cityData: {city: string, state: string}) => {
    setCurrentCity(cityData);
    
    const cityString = `${cityData.city}, ${cityData.state}`;
    if (!serviceCities.includes(cityString)) {
      setServiceCities(prev => [...prev, cityString]);
    }
  };

  useEffect(() => {
    loadProviderCities();
  }, [providerId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            <span className="ml-2">Carregando cidades...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Cidades de Atendimento
        </CardTitle>
        <CardDescription>
          Configure as cidades onde você oferece seus serviços. Você receberá apenas solicitações dessas cidades.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cidade atual */}
        <div className="space-y-3">
          <h4 className="font-medium">Sua cidade atual</h4>
          <CitySelector
            label=""
            value={currentCity || undefined}
            onChange={setCurrentCityFromSelection}
            placeholder="Selecione sua cidade atual..."
          />
          <p className="text-xs text-muted-foreground">
            Esta será sua cidade principal e será automaticamente incluída nas cidades de atendimento.
          </p>
        </div>

        {/* Lista de cidades de atendimento */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Cidades de atendimento ({serviceCities.length})</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddingCity(true)}
              disabled={isAddingCity}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar cidade
            </Button>
          </div>

          {/* Formulário para adicionar cidade */}
          {isAddingCity && (
            <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
              <CitySelector
                label="Nova cidade de atendimento"
                value={newCity || undefined}
                onChange={setNewCity}
                placeholder="Digite o nome da cidade..."
              />
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={addCity}
                  disabled={!newCity}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setIsAddingCity(false);
                    setNewCity(null);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Lista de cidades */}
          <div className="space-y-2">
            {serviceCities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <h4 className="font-medium mb-1">Nenhuma cidade configurada</h4>
                <p className="text-sm">Adicione as cidades onde você atende para receber solicitações relevantes.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {serviceCities.map((city, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{city}</span>
                      {currentCity && `${currentCity.city}, ${currentCity.state}` === city && (
                        <Badge variant="outline" className="text-xs">
                          Atual
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCity(city)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botão salvar */}
          {serviceCities.length > 0 && (
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={saveCities} disabled={saving}>
                {saving ? (
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar alterações
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
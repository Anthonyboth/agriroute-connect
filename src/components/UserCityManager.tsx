import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Trash2, CheckCircle, XCircle, Info } from 'lucide-react';
import { CitySelector } from './CitySelector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { getServiceById } from '@/lib/service-types';
import { debounce } from '@/lib/utils';

interface UserCity {
  id: string;
  city_id: string;
  city_name: string;
  city_state: string;
  type: 'MOTORISTA_ORIGEM' | 'MOTORISTA_DESTINO' | 'PRESTADOR_SERVICO' | 'PRODUTOR_LOCALIZACAO';
  radius_km: number;
  is_active: boolean;
  service_types?: string[];
}

interface UserCityManagerProps {
  userRole: 'MOTORISTA' | 'PRESTADOR_SERVICOS' | 'PRODUTOR' | 'TRANSPORTADORA';
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
  const [selectedCity, setSelectedCity] = useState<{ city: string; state: string } | null>(null);
  const [selectedType, setSelectedType] = useState<UserCity['type'] | ''>(() => {
    // Auto-selecionar tipo baseado no userRole
    if (userRole === 'PRESTADOR_SERVICOS') return 'PRESTADOR_SERVICO';
    if (userRole === 'PRODUTOR') return 'PRODUTOR_LOCALIZACAO';
    return '';
  });
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
          service_types,
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
        is_active: item.is_active,
        service_types: item.service_types || []
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
      toast.error(userRole === 'MOTORISTA' 
        ? 'Selecione uma cidade e tipo' 
        : 'Selecione uma cidade'
      );
      return;
    }

    try {
      // Buscar o ID da cidade no banco de dados
      const { data: cityData, error: cityError } = await supabase
        .from('cities')
        .select('id')
        .eq('name', selectedCity.city)
        .eq('state', selectedCity.state)
        .single();

      if (cityError || !cityData) {
        toast.error('Cidade não encontrada no banco de dados');
        return;
      }

      // Buscar service_types atuais do perfil para prestadores
      let profileServiceTypes: string[] = [];
      if (userRole === 'PRESTADOR_SERVICOS') {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('service_types')
          .eq('user_id', user.id)
          .single();
        
        profileServiceTypes = profileData?.service_types || [];
      }

      const insertData: any = {
        user_id: user.id,
        city_id: cityData.id,
        type: selectedType as UserCity['type'],
        radius_km: radius,
        is_active: true
      };

      // Copiar service_types do perfil para prestadores
      if (userRole === 'PRESTADOR_SERVICOS') {
        insertData.service_types = profileServiceTypes;
      }

      const { error } = await supabase
        .from('user_cities')
        .insert([insertData]);

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
      // Reset tipo baseado no userRole
      if (userRole === 'MOTORISTA') {
        setSelectedType('');
      } else if (userRole === 'PRESTADOR_SERVICOS') {
        setSelectedType('PRESTADOR_SERVICO');
      } else if (userRole === 'PRODUTOR') {
        setSelectedType('PRODUTOR_LOCALIZACAO');
      }
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

  // Função debounced para atualizar raio no banco
  const debouncedUpdateRadiusInDB = useCallback(
    debounce(async (cityId: string, newRadius: number) => {
      try {
        const { error } = await supabase
          .from('user_cities')
          .update({ radius_km: newRadius })
          .eq('id', cityId);

        if (error) throw error;
      } catch (error) {
        console.error('Erro ao atualizar raio:', error);
        toast.error('Erro ao atualizar raio');
        // Reverter mudança em caso de erro
        fetchUserCities();
      }
    }, 500), // Aguarda 500ms após último movimento
    []
  );

  const handleUpdateRadius = (cityId: string, newRadius: number) => {
    // Atualizar UI instantaneamente para feedback visual imediato
    setCities(prev => prev.map(c => 
      c.id === cityId ? { ...c, radius_km: newRadius } : c
    ));

    // Salvar no banco com debounce (aguarda usuário parar de arrastar)
    debouncedUpdateRadiusInDB(cityId, newRadius);
    // ✅ Não chama onCitiesUpdate - ajustar raio não requer refetch de serviços/fretes
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
                Gerencie as cidades onde você atua e defina o raio de atendimento (máximo: 300km por cidade)
              </CardDescription>
            </div>
            <Button onClick={() => setIsDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Cidade
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {userRole === 'PRESTADOR_SERVICOS' && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2 text-blue-700 dark:text-blue-300">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium block">Gerenciamento de Serviços</span>
                  <p className="text-blue-600 dark:text-blue-400 text-sm mt-1">
                    Os tipos de serviço são configurados na aba <strong>"Serviços"</strong> ou no botão <strong>"Configurar Serviços"</strong> e aplicados automaticamente a todas as suas cidades de atendimento.
                  </p>
                </div>
              </div>
            </div>
          )}
          
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
                      <div className="flex-1">
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
                          title={city.is_active ? 'Desativar' : 'Ativar'}
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
                          title="Remover"
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

                    {/* Exibir tipos de serviço para PRESTADOR_SERVICOS (read-only) */}
                    {userRole === 'PRESTADOR_SERVICOS' && city.service_types && city.service_types.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <span className="text-sm font-medium text-muted-foreground block mb-2">
                          Serviços oferecidos:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {city.service_types.map((typeId) => {
                            const service = getServiceById(typeId);
                            return service ? (
                              <Badge key={typeId} variant="secondary" className="text-xs">
                                {service.label}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para adicionar cidade */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Cidade</DialogTitle>
          <DialogDescription>
            {userRole === 'PRESTADOR_SERVICOS' || userRole === 'PRODUTOR'
              ? 'Selecione a cidade e o raio de atendimento'
              : 'Selecione a cidade, tipo de uso e o raio de atendimento'
            }
          </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Cidade</Label>
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

            {/* Mostrar apenas para MOTORISTA (origem/destino) */}
            {userRole === 'MOTORISTA' && (
              <div>
                <Label>Tipo de Uso</Label>
                <Select 
                  value={selectedType} 
                  onValueChange={(value) => setSelectedType(value as UserCity['type'])}
                >
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
            )}

            <div>
              <Label>
                Raio de atendimento: {radius}km
              </Label>
              <Slider
                value={[radius]}
                onValueChange={(value) => setRadius(value[0])}
                min={1}
                max={300}
                step={1}
                className="w-full mt-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Você receberá solicitações dentro deste raio da cidade selecionada
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsDialogOpen(false);
              setSelectedCity(null);
              // Reset tipo baseado no userRole
              if (userRole === 'MOTORISTA') {
                setSelectedType('');
              } else if (userRole === 'PRESTADOR_SERVICOS') {
                setSelectedType('PRESTADOR_SERVICO');
              } else if (userRole === 'PRODUTOR') {
                setSelectedType('PRODUTOR_LOCALIZACAO');
              }
              setRadius(50);
            }}>
              Cancelar
            </Button>
            <Button onClick={handleAddCity}>
              Adicionar Cidade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

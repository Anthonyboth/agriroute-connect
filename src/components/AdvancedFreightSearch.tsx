import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Search, MapPin, Calendar as CalendarIcon, Truck, Package, 
  DollarSign, Filter, X, Clock, Target, Zap 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UnifiedLocationInput } from './UnifiedLocationInput';
import { CitySelectionGuide } from './CitySelectionGuide';

interface AdvancedSearchFilters {
  // Localização
  origin_city: string;
  origin_state: string;
  origin_city_id?: string;
  destination_city: string;
  destination_state: string;
  destination_city_id?: string;
  max_distance_km: number;
  route_corridor: string; // Ex: "BR-163", "BR-364"
  
  // Datas e Agendamento
  pickup_date_start?: Date;
  pickup_date_end?: Date;
  scheduled_only: boolean;
  flexible_dates_only: boolean;
  urgent_only: boolean;
  
  // Carga
  cargo_categories: string[];
  min_weight: number;
  max_weight: number;
  hazardous_cargo: boolean;
  live_cargo: boolean;
  refrigerated: boolean;
  
  // Preço e Pagamento
  min_price: number;
  max_price: number;
  payment_methods: string[];
  advance_payment_available: boolean;
  
  // Veículo
  vehicle_types: string[];
  min_axles: number;
  max_axles: number;
  
  // Outros
  trusted_producers_only: boolean;
  minimum_rating: number;
  has_insurance: boolean;
}

interface AdvancedFreightSearchProps {
  onSearch: (filters: AdvancedSearchFilters) => void;
  userRole: 'MOTORISTA' | 'PRODUTOR';
}

export const AdvancedFreightSearch: React.FC<AdvancedFreightSearchProps> = ({
  onSearch,
  userRole
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [searchName, setSearchName] = useState('');
  
  const [filters, setFilters] = useState<AdvancedSearchFilters>({
    origin_city: '',
    origin_state: '',
    destination_city: '',
    destination_state: '',
    max_distance_km: 1000,
    route_corridor: '',
    scheduled_only: false,
    flexible_dates_only: false,
    urgent_only: false,
    cargo_categories: [],
    min_weight: 0,
    max_weight: 100,
    hazardous_cargo: false,
    live_cargo: false,
    refrigerated: false,
    min_price: 0,
    max_price: 50000,
    payment_methods: [],
    advance_payment_available: false,
    vehicle_types: [],
    min_axles: 2,
    max_axles: 9,
    trusted_producers_only: false,
    minimum_rating: 0,
    has_insurance: false
  });

  const states = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  const cargoCategories = [
    'Grãos (Soja, Milho, Trigo)',
    'Açúcar e derivados',
    'Fertilizantes e defensivos',
    'Algodão',
    'Café',
    'Frutas e hortaliças',
    'Carne bovina/suína',
    'Aves vivas',
    'Gado bovino',
    'Combustíveis',
    'Máquinas agrícolas',
    'Produtos químicos',
    'Materiais de construção'
  ];

  const vehicleTypes = [
    'VUC (3/4)',
    'Truck/Toco',
    'Carreta 5 eixos',
    'Carreta 7 eixos',
    'Rodotrem 9 eixos',
    'Carreta Tanque',
    'Carreta Frigorífico',
    'Carreta Gado',
    'Prancha'
  ];

  const routeCorridors = [
    'BR-163 (Cuiabá-Santarém)',
    'BR-364 (Cuiabá-Porto Velho)',
    'BR-158 (Barra do Garças-Redenção)',
    'BR-070 (Brasília-Cuiabá)',
    'BR-242 (Brasília-Barreiras)',
    'BR-135 (Brasília-Balsas)',
    'Ferronorte',
    'Ferrovia Norte-Sul'
  ];

  const handleFilterChange = (key: keyof AdvancedSearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleArrayFilterChange = (key: keyof AdvancedSearchFilters, value: string, checked: boolean) => {
    setFilters(prev => ({
      ...prev,
      [key]: checked 
        ? [...(prev[key] as string[]), value]
        : (prev[key] as string[]).filter(item => item !== value)
    }));
  };

  const handleSearch = () => {
    onSearch(filters);
    setIsOpen(false);
    toast.success('Busca avançada aplicada!');
  };

  const clearFilters = () => {
    setFilters({
      origin_city: '',
      origin_state: '',
      destination_city: '',
      destination_state: '',
      max_distance_km: 1000,
      route_corridor: '',
      scheduled_only: false,
      flexible_dates_only: false,
      urgent_only: false,
      cargo_categories: [],
      min_weight: 0,
      max_weight: 100,
      hazardous_cargo: false,
      live_cargo: false,
      refrigerated: false,
      min_price: 0,
      max_price: 50000,
      payment_methods: [],
      advance_payment_available: false,
      vehicle_types: [],
      min_axles: 2,
      max_axles: 9,
      trusted_producers_only: false,
      minimum_rating: 0,
      has_insurance: false
    });
  };

  const saveSearch = async () => {
    if (!searchName.trim()) {
      toast.error('Digite um nome para salvar a busca');
      return;
    }

    try {
      // Save to localStorage for now (could be database later)
      const savedSearches = JSON.parse(localStorage.getItem('savedFreightSearches') || '[]');
      const newSearch = {
        id: Date.now().toString(),
        name: searchName,
        filters,
        created_at: new Date().toISOString(),
        user_role: userRole
      };

      savedSearches.push(newSearch);
      localStorage.setItem('savedFreightSearches', JSON.stringify(savedSearches));
      
      setSavedSearches(savedSearches);
      setSearchName('');
      toast.success('Busca salva com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar busca');
    }
  };

  const loadSavedSearch = (savedSearch: any) => {
    setFilters(savedSearch.filters);
    toast.success(`Busca "${savedSearch.name}" carregada!`);
  };

  useEffect(() => {
    // Load saved searches
    const saved = JSON.parse(localStorage.getItem('savedFreightSearches') || '[]');
    setSavedSearches(saved.filter((s: any) => s.user_role === userRole));
  }, [userRole]);

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.origin_city) count++;
    if (filters.destination_city) count++;
    if (filters.cargo_categories.length > 0) count++;
    if (filters.vehicle_types.length > 0) count++;
    if (filters.min_price > 0 || filters.max_price < 50000) count++;
    if (filters.scheduled_only) count++;
    if (filters.urgent_only) count++;
    if (filters.live_cargo) count++;
    if (filters.refrigerated) count++;
    if (filters.trusted_producers_only) count++;
    return count;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="relative">
          <Search className="mr-2 h-4 w-4" />
          Busca Avançada
          {getActiveFiltersCount() > 0 && (
            <Badge variant="secondary" className="ml-2 bg-primary text-primary-foreground">
              {getActiveFiltersCount()}
            </Badge>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            Busca Avançada de Fretes
          </DialogTitle>
          <DialogDescription>
            Configure filtros detalhados para encontrar exatamente o que você procura
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna 1: Localização e Datas */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Localização
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <UnifiedLocationInput
                    label="Cidade de Origem"
                    placeholder="CEP ou nome da cidade"
                    value={filters.origin_city && filters.origin_state ? `${filters.origin_city}, ${filters.origin_state}` : ''}
                    onChange={(value, locationData) => {
                      if (locationData) {
                        handleFilterChange('origin_city', locationData.city);
                        handleFilterChange('origin_state', locationData.state);
                        handleFilterChange('origin_city_id', locationData.cityId || '');
                      }
                    }}
                  />
                  
                  <UnifiedLocationInput
                    label="Cidade de Destino"
                    placeholder="CEP ou nome da cidade"
                    value={filters.destination_city && filters.destination_state ? `${filters.destination_city}, ${filters.destination_state}` : ''}
                    onChange={(value, locationData) => {
                      if (locationData) {
                        handleFilterChange('destination_city', locationData.city);
                        handleFilterChange('destination_state', locationData.state);
                        handleFilterChange('destination_city_id', locationData.cityId || '');
                      }
                    }}
                  />
                  
                  <CitySelectionGuide variant="compact" showImportance={false} />
                </div>

                <div className="space-y-2">
                  <Label>Corredor Rodoviário</Label>
                  <Select value={filters.route_corridor} onValueChange={(value) => handleFilterChange('route_corridor', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma rota" />
                    </SelectTrigger>
                    <SelectContent>
                      {routeCorridors.map(corridor => (
                        <SelectItem key={corridor} value={corridor}>{corridor}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Distância Máxima: {filters.max_distance_km} km</Label>
                  <input
                    type="range"
                    min="50"
                    max="3000"
                    step="50"
                    value={filters.max_distance_km}
                    onChange={(e) => handleFilterChange('max_distance_km', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Datas e Agendamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Apenas fretes agendados</Label>
                  <Switch
                    checked={filters.scheduled_only}
                    onCheckedChange={(checked) => handleFilterChange('scheduled_only', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Com datas flexíveis</Label>
                  <Switch
                    checked={filters.flexible_dates_only}
                    onCheckedChange={(checked) => handleFilterChange('flexible_dates_only', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Apenas urgentes
                  </Label>
                  <Switch
                    checked={filters.urgent_only}
                    onCheckedChange={(checked) => handleFilterChange('urgent_only', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna 2: Carga e Veículo */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Tipo de Carga
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {cargoCategories.map(category => (
                    <div key={category} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={category}
                        checked={filters.cargo_categories.includes(category)}
                        onChange={(e) => handleArrayFilterChange('cargo_categories', category, e.target.checked)}
                      />
                      <Label htmlFor={category} className="text-sm cursor-pointer">
                        {category}
                      </Label>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Carga viva (gado, aves)</Label>
                    <Switch
                      checked={filters.live_cargo}
                      onCheckedChange={(checked) => handleFilterChange('live_cargo', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Refrigerado</Label>
                    <Switch
                      checked={filters.refrigerated}
                      onCheckedChange={(checked) => handleFilterChange('refrigerated', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Carga perigosa</Label>
                    <Switch
                      checked={filters.hazardous_cargo}
                      onCheckedChange={(checked) => handleFilterChange('hazardous_cargo', checked)}
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Peso mín. (t)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={filters.min_weight}
                      onChange={(e) => handleFilterChange('min_weight', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Peso máx. (t)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={filters.max_weight}
                      onChange={(e) => handleFilterChange('max_weight', parseFloat(e.target.value) || 100)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Veículo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {vehicleTypes.map(type => (
                    <div key={type} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={type}
                        checked={filters.vehicle_types.includes(type)}
                        onChange={(e) => handleArrayFilterChange('vehicle_types', type, e.target.checked)}
                      />
                      <Label htmlFor={type} className="text-sm cursor-pointer">
                        {type}
                      </Label>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Eixos mín.</Label>
                    <Input
                      type="number"
                      min="2"
                      max="9"
                      value={filters.min_axles}
                      onChange={(e) => handleFilterChange('min_axles', parseInt(e.target.value) || 2)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Eixos máx.</Label>
                    <Input
                      type="number"
                      min="2"
                      max="9"
                      value={filters.max_axles}
                      onChange={(e) => handleFilterChange('max_axles', parseInt(e.target.value) || 9)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna 3: Preço e Configurações */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Preço e Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Preço mín. (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={filters.min_price}
                      onChange={(e) => handleFilterChange('min_price', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço máx. (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={filters.max_price}
                      onChange={(e) => handleFilterChange('max_price', parseFloat(e.target.value) || 50000)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Adiantamento disponível</Label>
                    <Switch
                      checked={filters.advance_payment_available}
                      onCheckedChange={(checked) => handleFilterChange('advance_payment_available', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configurações de Qualidade</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Apenas produtores confiáveis</Label>
                  <Switch
                    checked={filters.trusted_producers_only}
                    onCheckedChange={(checked) => handleFilterChange('trusted_producers_only', checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Avaliação mínima: {filters.minimum_rating}★</Label>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={filters.minimum_rating}
                    onChange={(e) => handleFilterChange('minimum_rating', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Seguro obrigatório</Label>
                  <Switch
                    checked={filters.has_insurance}
                    onCheckedChange={(checked) => handleFilterChange('has_insurance', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Buscas Salvas */}
            {savedSearches.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Buscas Salvas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {savedSearches.slice(0, 3).map(saved => (
                    <Button
                      key={saved.id}
                      variant="outline"
                      size="sm"
                      onClick={() => loadSavedSearch(saved)}
                      className="w-full justify-start text-left"
                    >
                      <Target className="mr-2 h-3 w-3" />
                      {saved.name}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Footer com ações */}
        <div className="flex items-center justify-between pt-6 border-t">
          <div className="flex gap-2">
            <div className="flex gap-2">
              <Input
                placeholder="Nome da busca..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-48"
              />
              <Button variant="outline" onClick={saveSearch}>
                Salvar Busca
              </Button>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={clearFilters}>
              <X className="mr-2 h-4 w-4" />
              Limpar
            </Button>
            <Button onClick={handleSearch} className="gradient-primary">
              <Search className="mr-2 h-4 w-4" />
              Buscar ({getActiveFiltersCount()} filtros)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
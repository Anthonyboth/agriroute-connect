import React, { useState, useEffect } from 'react';
import { useRouteCorridors } from '@/hooks/useRouteCorridors';
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
  const { corridorLabels: routeCorridors } = useRouteCorridors();
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

  // routeCorridors now comes from useRouteCorridors hook
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

    // ✅ SESSÃO: salva apenas em memória (sessionStorage), não localStorage
    try {
      const existing = JSON.parse(sessionStorage.getItem('savedFreightSearches') || '[]');
      const newSearch = {
        id: Date.now().toString(),
        name: searchName,
        filters,
        created_at: new Date().toISOString(),
        user_role: userRole
      };

      existing.push(newSearch);
      sessionStorage.setItem('savedFreightSearches', JSON.stringify(existing));
      
      setSavedSearches(existing);
      setSearchName('');
      toast.success('Busca salva para esta sessão!');
    } catch (error) {
      toast.error('Erro ao salvar busca');
    }
  };

  const loadSavedSearch = (savedSearch: any) => {
    setFilters(savedSearch.filters);
    toast.success(`Busca "${savedSearch.name}" carregada!`);
  };

  useEffect(() => {
    // ✅ SESSÃO: carrega de sessionStorage (apagado ao fechar app)
    const saved = JSON.parse(sessionStorage.getItem('savedFreightSearches') || '[]');
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

      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-background">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-primary" />
            Busca Avançada de Fretes
          </DialogTitle>
          <DialogDescription className="text-xs">
            Configure filtros detalhados para encontrar o frete ideal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* === Localização === */}
          <section>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-3">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              Localização
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Corredor Rodoviário</Label>
                <Select value={filters.route_corridor} onValueChange={(value) => handleFilterChange('route_corridor', value)}>
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue placeholder="Selecione uma rota" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover" position="popper" sideOffset={4}>
                    {routeCorridors.map(corridor => (
                      <SelectItem key={corridor} value={corridor}>{corridor}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Distância Máxima: {filters.max_distance_km} km</Label>
                <input
                  type="range"
                  min="50"
                  max="3000"
                  step="50"
                  value={filters.max_distance_km}
                  onChange={(e) => handleFilterChange('max_distance_km', parseInt(e.target.value))}
                  className="w-full mt-2 accent-primary"
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* === Datas + Carga especial (inline) === */}
          <section>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-3">
              <CalendarIcon className="h-3.5 w-3.5 text-primary" />
              Agendamento &amp; Carga Especial
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-3">
              {[
                { label: 'Agendados', key: 'scheduled_only' as const, icon: null },
                { label: 'Datas flexíveis', key: 'flexible_dates_only' as const, icon: null },
                { label: 'Urgentes', key: 'urgent_only' as const, icon: <Zap className="h-3 w-3 text-amber-500" /> },
                { label: 'Carga viva', key: 'live_cargo' as const, icon: null },
                { label: 'Refrigerado', key: 'refrigerated' as const, icon: null },
                { label: 'Perigosa', key: 'hazardous_cargo' as const, icon: null },
              ].map(({ label, key, icon }) => (
                <div key={key} className="flex items-center gap-2">
                  <Switch
                    id={key}
                    checked={filters[key] as boolean}
                    onCheckedChange={(checked) => handleFilterChange(key, checked)}
                    className="scale-90"
                  />
                  <Label htmlFor={key} className="text-xs cursor-pointer flex items-center gap-1">
                    {icon}
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          {/* === Tipo de Carga + Veículo (2 cols) === */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-3">
                <Package className="h-3.5 w-3.5 text-primary" />
                Tipo de Carga
              </h3>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 max-h-44 overflow-y-auto pr-1">
                {cargoCategories.map(category => (
                  <label key={category} className="flex items-center gap-1.5 text-xs cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={filters.cargo_categories.includes(category)}
                      onChange={(e) => handleArrayFilterChange('cargo_categories', category, e.target.checked)}
                      className="rounded accent-primary"
                    />
                    {category}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Peso mín. (t)</Label>
                  <Input type="number" min="0" value={filters.min_weight} onChange={(e) => handleFilterChange('min_weight', parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Peso máx. (t)</Label>
                  <Input type="number" min="0" value={filters.max_weight} onChange={(e) => handleFilterChange('max_weight', parseFloat(e.target.value) || 100)} className="h-8 text-sm" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-3">
                <Truck className="h-3.5 w-3.5 text-primary" />
                Veículo
              </h3>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {vehicleTypes.map(type => (
                  <label key={type} className="flex items-center gap-1.5 text-xs cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={filters.vehicle_types.includes(type)}
                      onChange={(e) => handleArrayFilterChange('vehicle_types', type, e.target.checked)}
                      className="rounded accent-primary"
                    />
                    {type}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Eixos mín.</Label>
                  <Input type="number" min="2" max="9" value={filters.min_axles} onChange={(e) => handleFilterChange('min_axles', parseInt(e.target.value) || 2)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Eixos máx.</Label>
                  <Input type="number" min="2" max="9" value={filters.max_axles} onChange={(e) => handleFilterChange('max_axles', parseInt(e.target.value) || 9)} className="h-8 text-sm" />
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* === Preço + Qualidade (inline) === */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-3">
                <DollarSign className="h-3.5 w-3.5 text-primary" />
                Preço e Pagamento
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Preço mín. (R$)</Label>
                  <Input type="number" min="0" value={filters.min_price} onChange={(e) => handleFilterChange('min_price', parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Preço máx. (R$)</Label>
                  <Input type="number" min="0" value={filters.max_price} onChange={(e) => handleFilterChange('max_price', parseFloat(e.target.value) || 50000)} className="h-8 text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Switch
                  id="advance_payment"
                  checked={filters.advance_payment_available}
                  onCheckedChange={(checked) => handleFilterChange('advance_payment_available', checked)}
                  className="scale-90"
                />
                <Label htmlFor="advance_payment" className="text-xs cursor-pointer">Adiantamento disponível</Label>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Qualidade</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="trusted_producers"
                    checked={filters.trusted_producers_only}
                    onCheckedChange={(checked) => handleFilterChange('trusted_producers_only', checked)}
                    className="scale-90"
                  />
                  <Label htmlFor="trusted_producers" className="text-xs cursor-pointer">Apenas produtores confiáveis</Label>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Avaliação mínima: {filters.minimum_rating}★</Label>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={filters.minimum_rating}
                    onChange={(e) => handleFilterChange('minimum_rating', parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="has_insurance"
                    checked={filters.has_insurance}
                    onCheckedChange={(checked) => handleFilterChange('has_insurance', checked)}
                    className="scale-90"
                  />
                  <Label htmlFor="has_insurance" className="text-xs cursor-pointer">Seguro obrigatório</Label>
                </div>
              </div>
            </div>
          </section>

          {/* Buscas Salvas */}
          {savedSearches.length > 0 && (
            <>
              <Separator />
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-2">Buscas Salvas</h3>
                <div className="flex flex-wrap gap-2">
                  {savedSearches.slice(0, 5).map(saved => (
                    <Button
                      key={saved.id}
                      variant="outline"
                      size="sm"
                      onClick={() => loadSavedSearch(saved)}
                      className="h-7 text-xs"
                    >
                      <Target className="mr-1 h-3 w-3" />
                      {saved.name}
                    </Button>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t pt-3 pb-1 mt-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Salvar busca */}
            <div className="flex gap-2 flex-1 min-w-0">
              <Input
                placeholder="Nome da busca..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="h-9 text-sm flex-1"
              />
              <Button variant="outline" size="sm" onClick={saveSearch} className="h-9 text-xs shrink-0 px-3">
                Salvar
              </Button>
            </div>
            {/* Ações */}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs px-3">
                <X className="mr-1 h-3.5 w-3.5" />
                Limpar
              </Button>
              <Button size="sm" onClick={handleSearch} className="h-9 text-xs px-4 gradient-primary">
                <Search className="mr-1 h-3.5 w-3.5" />
                Buscar ({getActiveFiltersCount()})
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
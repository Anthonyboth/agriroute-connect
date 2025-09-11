import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { MapPin, Search, Filter } from 'lucide-react';

interface FreightFiltersProps {
  filters: {
    cargo_type: string;
    service_type: string;
    min_weight: string;
    max_weight: string;
    max_distance: string;
    min_price: string;
    max_price: string;
    origin_city: string;
    destination_city: string;
    vehicle_type: string;
  };
  onFilterChange: (field: string, value: string) => void;
  onClearFilters: () => void;
}

export const FreightFilters: React.FC<FreightFiltersProps> = ({
  filters,
  onFilterChange,
  onClearFilters
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filtros de Busca
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Tipo de Serviço */}
          <div className="space-y-2">
            <Label>Tipo de Serviço</Label>
            <Select
              value={filters.service_type}
              onValueChange={(value) => onFilterChange('service_type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="CARGA">Carga</SelectItem>
                <SelectItem value="GUINCHO">Guincho</SelectItem>
                <SelectItem value="MUDANCA">Frete Urbano</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de Carga */}
          <div className="space-y-2">
            <Label>Tipo de Carga</Label>
            <Input
              placeholder="Ex: soja, milho..."
              value={filters.cargo_type}
              onChange={(e) => onFilterChange('cargo_type', e.target.value)}
            />
          </div>

          {/* Tipo de Veículo */}
          <div className="space-y-2">
            <Label>Tipo de Veículo</Label>
            <Select
              value={filters.vehicle_type}
              onValueChange={(value) => onFilterChange('vehicle_type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Qualquer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Qualquer</SelectItem>
                <SelectItem value="TRUCK">Truck</SelectItem>
                <SelectItem value="BITREM">Bitrem</SelectItem>
                <SelectItem value="RODOTREM">Rodotrem</SelectItem>
                <SelectItem value="CARRETA">Carreta</SelectItem>
                <SelectItem value="CARRETA_BAU">Carreta Baú</SelectItem>
                <SelectItem value="VUC">VUC</SelectItem>
                <SelectItem value="TOCO">Toco</SelectItem>
                <SelectItem value="F400">Ford F-400</SelectItem>
                <SelectItem value="STRADA">Fiat Strada</SelectItem>
                <SelectItem value="CARRO_PEQUENO">Carro Pequeno</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Peso Mínimo */}
          <div className="space-y-2">
            <Label>Peso Mínimo (kg)</Label>
            <Input
              type="number"
              placeholder="0"
              value={filters.min_weight}
              onChange={(e) => onFilterChange('min_weight', e.target.value)}
            />
          </div>

          {/* Peso Máximo */}
          <div className="space-y-2">
            <Label>Peso Máximo (kg)</Label>
            <Input
              type="number"
              placeholder="Sem limite"
              value={filters.max_weight}
              onChange={(e) => onFilterChange('max_weight', e.target.value)}
            />
          </div>

          {/* Distância Máxima */}
          <div className="space-y-2">
            <Label>Distância Máxima (km)</Label>
            <Input
              type="number"
              placeholder="Sem limite"
              value={filters.max_distance}
              onChange={(e) => onFilterChange('max_distance', e.target.value)}
            />
          </div>

          {/* Preço Mínimo */}
          <div className="space-y-2">
            <Label>Preço Mínimo (R$)</Label>
            <Input
              type="number"
              placeholder="0"
              value={filters.min_price}
              onChange={(e) => onFilterChange('min_price', e.target.value)}
            />
          </div>

          {/* Preço Máximo */}
          <div className="space-y-2">
            <Label>Preço Máximo (R$)</Label>
            <Input
              type="number"
              placeholder="Sem limite"
              value={filters.max_price}
              onChange={(e) => onFilterChange('max_price', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Origem */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Cidade de Origem
            </Label>
            <Input
              placeholder="Ex: São Paulo - SP"
              value={filters.origin_city}
              onChange={(e) => onFilterChange('origin_city', e.target.value)}
            />
          </div>

          {/* Destino */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Cidade de Destino
            </Label>
            <Input
              placeholder="Ex: Rio de Janeiro - RJ"
              value={filters.destination_city}
              onChange={(e) => onFilterChange('destination_city', e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClearFilters} className="flex-1">
            Limpar Filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
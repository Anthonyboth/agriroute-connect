import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { formatBRL, formatKm } from '@/lib/formatters';
import { ArrowUpDown, Filter, X } from 'lucide-react';
import { UI_TEXTS } from '@/lib/ui-texts';

export interface FreightFilters {
  status?: string[];
  dateRange?: { start: Date; end: Date };
  priceRange?: { min: number; max: number };
  distanceRange?: { min: number; max: number };
  cargoType?: string[];
  urgency?: string[];
  sortBy: 'date' | 'price' | 'distance' | 'status';
  sortOrder: 'asc' | 'desc';
}

interface AdvancedFreightFiltersProps {
  onFilterChange: (filters: FreightFilters) => void;
  currentFilters: FreightFilters;
  onClose?: () => void;
}

export const AdvancedFreightFilters: React.FC<AdvancedFreightFiltersProps> = ({
  onFilterChange,
  currentFilters,
  onClose
}) => {
  const handleReset = () => {
    onFilterChange({
      sortBy: 'date',
      sortOrder: 'desc'
    });
  };

  return (
    <Card className="w-full" translate="no">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <CardTitle>{UI_TEXTS.FILTROS_AVANCADOS}</CardTitle>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Faixa de Preço */}
        <div className="space-y-2">
          <Label>{UI_TEXTS.PRECO}</Label>
          <Slider
            min={0}
            max={50000}
            step={500}
            value={[
              currentFilters.priceRange?.min || 0,
              currentFilters.priceRange?.max || 50000
            ]}
            onValueChange={([min, max]) => onFilterChange({
              ...currentFilters,
              priceRange: { min, max }
            })}
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{formatBRL(currentFilters.priceRange?.min || 0)}</span>
            <span>{formatBRL(currentFilters.priceRange?.max || 50000)}</span>
          </div>
        </div>

        {/* Faixa de Distância */}
        <div className="space-y-2">
          <Label>{UI_TEXTS.DISTANCIA}</Label>
          <Slider
            min={0}
            max={3000}
            step={50}
            value={[
              currentFilters.distanceRange?.min || 0,
              currentFilters.distanceRange?.max || 3000
            ]}
            onValueChange={([min, max]) => onFilterChange({
              ...currentFilters,
              distanceRange: { min, max }
            })}
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{formatKm(currentFilters.distanceRange?.min || 0)}</span>
            <span>{formatKm(currentFilters.distanceRange?.max || 3000)}</span>
          </div>
        </div>

        {/* Tipo de Carga */}
        <div className="space-y-2">
          <Label>{UI_TEXTS.TIPO_CARGA}</Label>
          <Select
            value={currentFilters.cargoType?.[0] || 'all'}
            onValueChange={(value) => onFilterChange({
              ...currentFilters,
              cargoType: value === 'all' ? undefined : [value]
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="GRÃOS">{UI_TEXTS.GRAOS}</SelectItem>
              <SelectItem value="FERTILIZANTES">{UI_TEXTS.FERTILIZANTES}</SelectItem>
              <SelectItem value="ANIMAIS">{UI_TEXTS.ANIMAIS}</SelectItem>
              <SelectItem value="MAQUINÁRIO">{UI_TEXTS.MAQUINARIO}</SelectItem>
              <SelectItem value="COMBUSTÍVEL">{UI_TEXTS.COMBUSTIVEL}</SelectItem>
              <SelectItem value="GERAL">{UI_TEXTS.CARGA_GERAL}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Urgência */}
        <div className="space-y-2">
          <Label>{UI_TEXTS.URGENCIA}</Label>
          <Select
            value={currentFilters.urgency?.[0] || 'all'}
            onValueChange={(value) => onFilterChange({
              ...currentFilters,
              urgency: value === 'all' ? undefined : [value]
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas as urgências" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as urgências</SelectItem>
              <SelectItem value="LOW">{UI_TEXTS.URGENCIA_BAIXA}</SelectItem>
              <SelectItem value="MEDIUM">{UI_TEXTS.URGENCIA_MEDIA}</SelectItem>
              <SelectItem value="HIGH">{UI_TEXTS.URGENCIA_ALTA}</SelectItem>
              <SelectItem value="URGENT">{UI_TEXTS.URGENCIA_URGENTE}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Período (Date Range) */}
        <div className="space-y-2">
          <Label>{UI_TEXTS.PERIODO}</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={currentFilters.dateRange?.start ? currentFilters.dateRange.start.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const start = e.target.value ? new Date(e.target.value) : undefined;
                onFilterChange({
                  ...currentFilters,
                  dateRange: start ? { 
                    start, 
                    end: currentFilters.dateRange?.end || new Date() 
                  } : undefined
                });
              }}
              placeholder="Data inicial"
            />
            <Input
              type="date"
              value={currentFilters.dateRange?.end ? currentFilters.dateRange.end.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const end = e.target.value ? new Date(e.target.value) : undefined;
                onFilterChange({
                  ...currentFilters,
                  dateRange: end ? { 
                    start: currentFilters.dateRange?.start || new Date(), 
                    end 
                  } : undefined
                });
              }}
              placeholder="Data final"
            />
          </div>
        </div>

        {/* Ordenação */}
        <div className="space-y-2">
          <Label>{UI_TEXTS.ORDENAR_POR}</Label>
          <div className="flex gap-2">
            <Select
              value={currentFilters.sortBy}
              onValueChange={(sortBy) => onFilterChange({ 
                ...currentFilters, 
                sortBy: sortBy as any 
              })}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">{UI_TEXTS.DATA}</SelectItem>
                <SelectItem value="price">{UI_TEXTS.PRECO}</SelectItem>
                <SelectItem value="distance">{UI_TEXTS.DISTANCIA}</SelectItem>
                <SelectItem value="status">{UI_TEXTS.STATUS}</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => onFilterChange({
                ...currentFilters,
                sortOrder: currentFilters.sortOrder === 'asc' ? 'desc' : 'asc'
              })}
              title={currentFilters.sortOrder === 'asc' ? UI_TEXTS.CRESCENTE : UI_TEXTS.DECRESCENTE}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {currentFilters.sortOrder === 'asc' ? UI_TEXTS.CRESCENTE : UI_TEXTS.DECRESCENTE}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleReset}
          >
            {UI_TEXTS.LIMPAR_FILTROS}
          </Button>
          <Button
            className="flex-1"
            onClick={onClose}
          >
            {UI_TEXTS.APLICAR_FILTROS}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

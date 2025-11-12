import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Filter } from 'lucide-react';

export interface AssignmentFilters {
  searchTerm: string;
  status: 'all' | 'active' | 'removed';
  vehicleType: string;
}

interface AdvancedAssignmentFiltersProps {
  filters: AssignmentFilters;
  onFiltersChange: (filters: AssignmentFilters) => void;
  resultCount: number;
  vehicleTypes: { value: string; label: string }[];
}

export function AdvancedAssignmentFilters({
  filters,
  onFiltersChange,
  resultCount,
  vehicleTypes
}: AdvancedAssignmentFiltersProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Filtros Avançados</h3>
          <Badge variant="secondary" className="ml-auto">
            {resultCount} resultado{resultCount !== 1 ? 's' : ''}
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Busca por motorista/veículo */}
          <div className="space-y-2">
            <Label htmlFor="search">Buscar Motorista ou Veículo</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Nome ou placa..."
                value={filters.searchTerm}
                onChange={(e) => onFiltersChange({ ...filters, searchTerm: e.target.value })}
                className="pl-9"
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status do Vínculo</Label>
            <Select
              value={filters.status}
              onValueChange={(value: 'all' | 'active' | 'removed') => 
                onFiltersChange({ ...filters, status: value })
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Vínculos</SelectItem>
                <SelectItem value="active">Apenas Ativos</SelectItem>
                <SelectItem value="removed">Apenas Removidos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de Veículo */}
          <div className="space-y-2">
            <Label htmlFor="vehicleType">Tipo de Veículo</Label>
            <Select
              value={filters.vehicleType}
              onValueChange={(value) => 
                onFiltersChange({ ...filters, vehicleType: value })
              }
            >
              <SelectTrigger id="vehicleType">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {vehicleTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

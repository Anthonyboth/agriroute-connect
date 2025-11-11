import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, X, Filter } from 'lucide-react';
import { ChatFilters } from '@/hooks/useAdvancedChatFilters';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface AdvancedChatFiltersProps {
  filters: ChatFilters;
  onFilterChange: <K extends keyof ChatFilters>(
    key: K,
    value: ChatFilters[K]
  ) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  resultsCount: number;
  totalCount: number;
}

export const AdvancedChatFilters = ({
  filters,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
  resultsCount,
  totalCount,
}: AdvancedChatFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros Avançados
                </Button>
              </CollapsibleTrigger>
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  Filtros ativos
                </Badge>
              )}
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="text-destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Mostrando {resultsCount} de {totalCount} conversas
          </p>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Busca Full-Text */}
            <div className="space-y-2">
              <Label htmlFor="search" translate="no">
                Buscar em Mensagens
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Digite para buscar..."
                  value={filters.searchQuery}
                  onChange={(e) =>
                    onFilterChange('searchQuery', e.target.value)
                  }
                  className="pl-9"
                  translate="no"
                />
              </div>
            </div>

            {/* Grade de Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Filtro por Motorista/Participante */}
              <div className="space-y-2">
                <Label htmlFor="driver" translate="no">
                  Motorista / Participante
                </Label>
                <Input
                  id="driver"
                  placeholder="Nome do motorista..."
                  value={filters.driverName}
                  onChange={(e) => onFilterChange('driverName', e.target.value)}
                  translate="no"
                />
              </div>

              {/* Filtro por Rota */}
              <div className="space-y-2">
                <Label htmlFor="route" translate="no">
                  Rota / Frete
                </Label>
                <Input
                  id="route"
                  placeholder="Origem ou destino..."
                  value={filters.freightRoute}
                  onChange={(e) =>
                    onFilterChange('freightRoute', e.target.value)
                  }
                  translate="no"
                />
              </div>

              {/* Filtro por Período */}
              <div className="space-y-2">
                <Label htmlFor="period" translate="no">
                  Período
                </Label>
                <Select
                  value={filters.period}
                  onValueChange={(value: any) =>
                    onFilterChange('period', value)
                  }
                >
                  <SelectTrigger id="period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="week">Última semana</SelectItem>
                    <SelectItem value="month">Último mês</SelectItem>
                    <SelectItem value="3months">Últimos 3 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

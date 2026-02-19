/**
 * ReportFiltersBar.tsx
 * 
 * Barra de filtros para relatórios: tipo, status, cidade/UF, motorista (transportadora).
 * 100% PT-BR. Debounce em inputs.
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Filter, X, Check, ChevronDown, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ReportFilters {
  tipo?: string[];
  status_final?: string[];
  cidade?: string;
  uf?: string;
  motoristas?: string[];
}

interface ReportFiltersBarProps {
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  panel: 'MOTORISTA' | 'TRANSPORTADORA' | 'PRODUTOR' | 'PRESTADOR';
  availableDrivers?: { id: string; name: string }[];
  className?: string;
}

const TIPOS = [
  { value: 'rural', label: 'Rural' },
  { value: 'urbano', label: 'Urbano' },
  { value: 'guincho', label: 'Guincho' },
  { value: 'moto', label: 'Moto' },
  { value: 'mudanca', label: 'Mudança' },
  { value: 'tecnico', label: 'Técnico' },
];

const STATUS_FINAL = [
  { value: 'COMPLETED', label: 'Concluído' },
  { value: 'DELIVERED', label: 'Entregue' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

const MultiSelect: React.FC<{
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder?: string;
}> = ({ label, options, selected, onSelectionChange, placeholder }) => {
  const [open, setOpen] = useState(false);

  const toggleOption = useCallback((value: string) => {
    onSelectionChange(
      selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value]
    );
  }, [selected, onSelectionChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1 text-[10px]">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder || `Buscar ${label.toLowerCase()}...`} className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>Nenhum encontrado</CommandEmpty>
            <CommandGroup>
              {options.map(option => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => toggleOption(option.value)}
                  className="text-xs"
                >
                  <div className={cn(
                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                    selected.includes(option.value) ? "bg-primary border-primary" : "border-muted-foreground"
                  )}>
                    {selected.includes(option.value) && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export const ReportFiltersBar: React.FC<ReportFiltersBarProps> = ({
  filters,
  onFiltersChange,
  onRefresh,
  isLoading = false,
  panel,
  availableDrivers = [],
  className,
}) => {
  const [localUf, setLocalUf] = useState(filters.uf || '');
  
  // Debounce UF changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localUf !== (filters.uf || '')) {
        onFiltersChange({ ...filters, uf: localUf || undefined });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localUf]);

  const updateFilter = useCallback((key: keyof ReportFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  }, [filters, onFiltersChange]);

  const clearAll = useCallback(() => {
    onFiltersChange({});
    setLocalUf('');
  }, [onFiltersChange]);

  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.tipo?.length) count++;
    if (filters.status_final?.length) count++;
    if (filters.uf) count++;
    if (filters.motoristas?.length) count++;
    return count;
  }, [filters]);

  const driverOptions = useMemo(() => 
    availableDrivers.map(d => ({ value: d.id, label: d.name })),
    [availableDrivers]
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        <span>Filtros</span>
      </div>

      <MultiSelect
        label="Tipo"
        options={TIPOS}
        selected={filters.tipo || []}
        onSelectionChange={(v) => updateFilter('tipo', v.length ? v : undefined)}
        placeholder="Buscar tipo..."
      />

      <MultiSelect
        label="Status"
        options={STATUS_FINAL}
        selected={filters.status_final || []}
        onSelectionChange={(v) => updateFilter('status_final', v.length ? v : undefined)}
        placeholder="Buscar status..."
      />

      {/* UF Selector */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
            {localUf || 'UF'}
            {localUf && <Badge variant="secondary" className="ml-1 h-5 px-1 text-[10px]">1</Badge>}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar UF..." className="h-8 text-xs" />
            <CommandList>
              <CommandEmpty>Não encontrado</CommandEmpty>
              <CommandGroup>
                <CommandItem value="" onSelect={() => setLocalUf('')} className="text-xs">
                  <span className="text-muted-foreground">Todos</span>
                </CommandItem>
                {UFS.map(uf => (
                  <CommandItem key={uf} value={uf} onSelect={() => setLocalUf(uf)} className="text-xs">
                    <div className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                      localUf === uf ? "bg-primary border-primary" : "border-muted-foreground"
                    )}>
                      {localUf === uf && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    {uf}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Motorista filter (only for TRANSPORTADORA) */}
      {panel === 'TRANSPORTADORA' && driverOptions.length > 0 && (
        <MultiSelect
          label="Motoristas"
          options={driverOptions}
          selected={filters.motoristas || []}
          onSelectionChange={(v) => updateFilter('motoristas', v.length ? v : undefined)}
          placeholder="Buscar motorista..."
        />
      )}

      {/* Clear all */}
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={clearAll}>
          <X className="h-3 w-3" />
          Limpar ({activeCount})
        </Button>
      )}

      {/* Refresh button */}
      {onRefresh && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1 ml-auto"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          Atualizar
        </Button>
      )}
    </div>
  );
};

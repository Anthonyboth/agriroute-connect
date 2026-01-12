import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Filter, 
  Calendar as CalendarIcon, 
  X, 
  ChevronDown, 
  ChevronUp,
  Search,
  DollarSign
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PaymentCardData } from './PaymentCard';
import type { DateRange } from 'react-day-picker';

export interface PaymentFilters {
  dateRange?: { from: Date; to: Date };
  status?: string;
  driverName?: string;
  minValue?: number;
  maxValue?: number;
}

interface PaymentsFiltersProps {
  payments: PaymentCardData[];
  filters: PaymentFilters;
  onFiltersChange: (filters: PaymentFilters) => void;
  onClearFilters: () => void;
}

export const PaymentsFilters: React.FC<PaymentsFiltersProps> = ({
  payments,
  filters,
  onFiltersChange,
  onClearFilters,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Get unique drivers from payments
  const uniqueDrivers = useMemo(() => {
    const drivers = new Map<string, string>();
    payments.forEach(p => {
      if (p.driver?.id && p.driver?.full_name) {
        drivers.set(p.driver.id, p.driver.full_name);
      }
    });
    return Array.from(drivers.entries()).map(([id, name]) => ({ id, name }));
  }, [payments]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.dateRange) count++;
    if (filters.status) count++;
    if (filters.driverName) count++;
    if (filters.minValue !== undefined || filters.maxValue !== undefined) count++;
    return count;
  }, [filters]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      onFiltersChange({ ...filters, dateRange: { from: range.from, to: range.to } });
    } else {
      const newFilters = { ...filters };
      delete newFilters.dateRange;
      onFiltersChange(newFilters);
    }
  };

  const handleStatusChange = (value: string) => {
    if (value === 'all') {
      const newFilters = { ...filters };
      delete newFilters.status;
      onFiltersChange(newFilters);
    } else {
      onFiltersChange({ ...filters, status: value });
    }
  };

  const handleDriverChange = (value: string) => {
    if (value === 'all') {
      const newFilters = { ...filters };
      delete newFilters.driverName;
      onFiltersChange(newFilters);
    } else {
      onFiltersChange({ ...filters, driverName: value });
    }
  };

  const handleMinValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseFloat(e.target.value) : undefined;
    if (value === undefined) {
      const newFilters = { ...filters };
      delete newFilters.minValue;
      onFiltersChange(newFilters);
    } else {
      onFiltersChange({ ...filters, minValue: value });
    }
  };

  const handleMaxValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseFloat(e.target.value) : undefined;
    if (value === undefined) {
      const newFilters = { ...filters };
      delete newFilters.maxValue;
      onFiltersChange(newFilters);
    } else {
      onFiltersChange({ ...filters, maxValue: value });
    }
  };

  return (
    <Card className="border-dashed">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardContent className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Filtros Avançados</span>
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro' : 'filtros'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearFilters();
                    }}
                    className="h-7 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Limpar
                  </Button>
                )}
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
              {/* Período */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  Período
                </Label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal h-9 text-sm"
                    >
                      {filters.dateRange ? (
                        <span>
                          {format(filters.dateRange.from, 'dd/MM/yy', { locale: ptBR })} - {format(filters.dateRange.to, 'dd/MM/yy', { locale: ptBR })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Selecionar período</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={filters.dateRange?.from}
                      selected={filters.dateRange ? { from: filters.dateRange.from, to: filters.dateRange.to } : undefined}
                      onSelect={handleDateRangeChange}
                      numberOfMonths={2}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Search className="h-3 w-3" />
                  Status
                </Label>
                <Select
                  value={filters.status || 'all'}
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="proposed">Pendente</SelectItem>
                    <SelectItem value="paid_by_producer">Aguardando Motorista</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Motorista */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Search className="h-3 w-3" />
                  Motorista
                </Label>
                <Select
                  value={filters.driverName || 'all'}
                  onValueChange={handleDriverChange}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todos os motoristas" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="all">Todos os motoristas</SelectItem>
                    {uniqueDrivers.map(driver => (
                      <SelectItem key={driver.id} value={driver.name}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Faixa de Valor */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Faixa de Valor (R$)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.minValue ?? ''}
                    onChange={handleMinValueChange}
                    className="h-9 text-sm"
                    min={0}
                  />
                  <span className="text-muted-foreground text-sm">-</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.maxValue ?? ''}
                    onChange={handleMaxValueChange}
                    className="h-9 text-sm"
                    min={0}
                  />
                </div>
              </div>
            </div>

            {/* Active Filters Summary */}
            {activeFiltersCount > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                {filters.dateRange && (
                  <Badge variant="secondary" className="text-xs">
                    Período: {format(filters.dateRange.from, 'dd/MM', { locale: ptBR })} - {format(filters.dateRange.to, 'dd/MM', { locale: ptBR })}
                    <button
                      onClick={() => {
                        const newFilters = { ...filters };
                        delete newFilters.dateRange;
                        onFiltersChange(newFilters);
                      }}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filters.status && (
                  <Badge variant="secondary" className="text-xs">
                    Status: {filters.status === 'proposed' ? 'Pendente' : filters.status === 'paid_by_producer' ? 'Aguardando' : 'Concluído'}
                    <button
                      onClick={() => {
                        const newFilters = { ...filters };
                        delete newFilters.status;
                        onFiltersChange(newFilters);
                      }}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filters.driverName && (
                  <Badge variant="secondary" className="text-xs">
                    Motorista: {filters.driverName}
                    <button
                      onClick={() => {
                        const newFilters = { ...filters };
                        delete newFilters.driverName;
                        onFiltersChange(newFilters);
                      }}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {(filters.minValue !== undefined || filters.maxValue !== undefined) && (
                  <Badge variant="secondary" className="text-xs">
                    Valor: R$ {filters.minValue ?? 0} - R$ {filters.maxValue ?? '∞'}
                    <button
                      onClick={() => {
                        const newFilters = { ...filters };
                        delete newFilters.minValue;
                        delete newFilters.maxValue;
                        onFiltersChange(newFilters);
                      }}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

// Hook to filter payments
export const usePaymentsFilter = (
  payments: PaymentCardData[],
  filters: PaymentFilters
): PaymentCardData[] => {
  return useMemo(() => {
    return payments.filter(payment => {
      // Date range filter
      if (filters.dateRange) {
        const paymentDate = new Date(payment.created_at);
        if (paymentDate < filters.dateRange.from || paymentDate > filters.dateRange.to) {
          return false;
        }
      }

      // Status filter
      if (filters.status && payment.status !== filters.status) {
        return false;
      }

      // Driver name filter
      if (filters.driverName && payment.driver?.full_name !== filters.driverName) {
        return false;
      }

      // Min value filter
      if (filters.minValue !== undefined && payment.amount < filters.minValue) {
        return false;
      }

      // Max value filter
      if (filters.maxValue !== undefined && payment.amount > filters.maxValue) {
        return false;
      }

      return true;
    });
  }, [payments, filters]);
};

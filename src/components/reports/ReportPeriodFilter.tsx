import React, { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Infinity } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { DateRange, PeriodPreset } from '@/types/reports';

interface ReportPeriodFilterProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  className?: string;
  defaultPreset?: PeriodPreset;
}

const PERIOD_PRESETS: { label: string; value: PeriodPreset; days?: number; icon?: React.ReactNode }[] = [
  { label: '7 dias', value: '7d', days: 7 },
  { label: '30 dias', value: '30d', days: 30 },
  { label: '90 dias', value: '90d', days: 90 },
  { label: 'Tudo', value: 'all', icon: <Infinity className="h-3 w-3" /> },
  { label: 'Personalizado', value: 'custom' },
];

// Default to 90 days as per requirement
const DEFAULT_PRESET: PeriodPreset = '90d';

export const ReportPeriodFilter: React.FC<ReportPeriodFilterProps> = ({
  dateRange,
  onDateRangeChange,
  className,
  defaultPreset = DEFAULT_PRESET,
}) => {
  const currentPreset = useMemo(() => {
    const now = new Date();
    const diffDays = Math.round((now.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
    
    // Check if "all" - more than 365 days ago
    if (diffDays > 365) return 'all';
    if (diffDays === 7) return '7d';
    if (diffDays === 30) return '30d';
    if (diffDays === 90) return '90d';
    return 'custom';
  }, [dateRange.from]);

  const handlePresetChange = useCallback((preset: PeriodPreset) => {
    const now = new Date();
    const presetConfig = PERIOD_PRESETS.find(p => p.value === preset);
    
    if (preset === 'all') {
      // "All" goes back 5 years or to a very early date
      onDateRangeChange({
        from: startOfDay(new Date(2020, 0, 1)), // Jan 1, 2020
        to: endOfDay(now),
      });
    } else if (presetConfig?.days) {
      onDateRangeChange({
        from: startOfDay(subDays(now, presetConfig.days)),
        to: endOfDay(now),
      });
    }
  }, [onDateRangeChange]);

  const handleDateSelect = useCallback((range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      onDateRangeChange({
        from: startOfDay(range.from),
        to: endOfDay(range.to),
      });
    }
  }, [onDateRangeChange]);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Preset Buttons */}
      <div className="flex gap-1 flex-wrap">
        {PERIOD_PRESETS.filter(p => p.value !== 'custom').map((preset) => (
          <Button
            key={preset.value}
            variant={currentPreset === preset.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetChange(preset.value)}
            className="text-xs sm:text-sm"
          >
            {preset.icon && <span className="mr-1">{preset.icon}</span>}
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Custom Date Range Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={currentPreset === 'custom' ? 'default' : 'outline'}
            size="sm"
            className={cn(
              "justify-start text-left font-normal min-w-[200px]",
              currentPreset !== 'custom' && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {currentPreset === 'custom' ? (
              <>
                {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} - {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
              </>
            ) : (
              'Personalizado'
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange.from}
            selected={{ from: dateRange.from, to: dateRange.to }}
            onSelect={handleDateSelect}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

// Helper to get default date range (90 days)
export const getDefaultDateRange = (): DateRange => {
  const now = new Date();
  return {
    from: startOfDay(subDays(now, 90)),
    to: endOfDay(now),
  };
};

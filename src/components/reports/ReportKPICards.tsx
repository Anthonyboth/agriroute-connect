import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export interface KPICardData {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  format?: 'currency' | 'number' | 'percent' | 'distance';
}

interface ReportKPICardsProps {
  cards: KPICardData[];
  isLoading?: boolean;
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

const formatValue = (value: string | number, format?: KPICardData['format']): string => {
  if (typeof value === 'string') return value;
  
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'distance':
      return `${value.toLocaleString('pt-BR')} km`;
    case 'number':
    default:
      return value.toLocaleString('pt-BR');
  }
};

const KPICardSkeleton = () => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-4" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-3 w-16" />
    </CardContent>
  </Card>
);

export const ReportKPICards: React.FC<ReportKPICardsProps> = ({
  cards,
  isLoading = false,
  columns = 4,
  className,
}) => {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5',
    6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
  };

  if (isLoading) {
    return (
      <div className={cn(`grid ${gridCols[columns]} gap-4`, className)}>
        {Array.from({ length: Math.min(cards.length || columns, 6) }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(`grid ${gridCols[columns]} gap-4`, className)}>
      {cards.map((card, index) => {
        const Icon = card.icon;
        
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold">
                  {formatValue(card.value, card.format)}
                </div>
                {card.trend && (
                  <span className={cn(
                    "text-xs font-medium",
                    card.trend.isPositive ? "text-success" : "text-destructive"
                  )}>
                    {card.trend.isPositive ? '+' : ''}{card.trend.value.toFixed(1)}%
                  </span>
                )}
              </div>
              {card.subtitle && (
                <p className="text-xs text-muted-foreground mt-1">
                  {card.subtitle}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

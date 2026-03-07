import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, CalendarClock, ArrowUpCircle, ArrowDownCircle, Wallet } from 'lucide-react';
import { useCashflowForecast } from '@/hooks/useCashflowForecast';

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const CashflowForecastCard: React.FC = () => {
  const { days, totalIncoming7d, totalOutgoing7d, projectedBalance7d, loading } = useCashflowForecast();

  if (loading) {
    return (
      <Card className="shadow-sm border-border/50">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent><Skeleton className="h-32 w-full" /></CardContent>
      </Card>
    );
  }

  // Only show days that have activity or are key (today, tomorrow, 3d, 7d)
  const keyDays = days.filter((d, i) => i === 0 || i === 1 || i === 3 || i === 7 || d.incoming > 0 || d.outgoing > 0);

  return (
    <Card className="shadow-sm border-border/50 overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-accent/10 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-accent/15 p-2">
              <CalendarClock className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Previsão de Caixa</CardTitle>
              <CardDescription className="text-xs">Projeção dos próximos 7 dias</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-medium">
            <TrendingUp className="h-3 w-3 mr-1" />
            7 dias
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Summary metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg p-2.5 bg-primary/[0.06] border border-primary/15">
            <div className="flex items-center gap-1 mb-1">
              <ArrowUpCircle className="h-3 w-3 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Entradas</span>
            </div>
            <p className="text-sm font-bold text-primary">{formatBRL(totalIncoming7d)}</p>
          </div>
          <div className="rounded-lg p-2.5 bg-destructive/[0.06] border border-destructive/15">
            <div className="flex items-center gap-1 mb-1">
              <ArrowDownCircle className="h-3 w-3 text-destructive" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Saídas</span>
            </div>
            <p className="text-sm font-bold text-destructive">{formatBRL(totalOutgoing7d)}</p>
          </div>
          <div className="rounded-lg p-2.5 bg-accent/[0.06] border border-accent/15">
            <div className="flex items-center gap-1 mb-1">
              <Wallet className="h-3 w-3 text-accent-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Projetado</span>
            </div>
            <p className="text-sm font-bold text-foreground">{formatBRL(projectedBalance7d)}</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-1">
          {keyDays.map((day, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
              {/* Timeline dot */}
              <div className="flex flex-col items-center">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  day.incoming > 0 ? 'bg-primary' : day.outgoing > 0 ? 'bg-destructive' : 'bg-muted-foreground/30'
                }`} />
                {idx < keyDays.length - 1 && <div className="w-px h-4 bg-border/50 mt-0.5" />}
              </div>

              {/* Day info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{day.label}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {day.incoming > 0 && (
                    <span className="flex items-center gap-0.5 text-primary">
                      <TrendingUp className="h-2.5 w-2.5" />
                      +{formatBRL(day.incoming)}
                    </span>
                  )}
                  {day.outgoing > 0 && (
                    <span className="flex items-center gap-0.5 text-destructive">
                      <TrendingDown className="h-2.5 w-2.5" />
                      -{formatBRL(day.outgoing)}
                    </span>
                  )}
                  {day.orders.length > 0 && (
                    <span className="text-muted-foreground">
                      {day.orders.length} frete{day.orders.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Projected balance */}
              <div className="text-right">
                <p className="text-xs font-semibold text-foreground">{formatBRL(day.projectedBalance)}</p>
              </div>
            </div>
          ))}
        </div>

        {totalIncoming7d === 0 && totalOutgoing7d === 0 && (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground">Nenhuma movimentação prevista nos próximos 7 dias</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

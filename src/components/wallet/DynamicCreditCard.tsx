import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Layers, Lock, ShieldCheck, Info, Truck } from 'lucide-react';
import { useDynamicCredit } from '@/hooks/useDynamicCredit';

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const DynamicCreditCard: React.FC = () => {
  const { dynamicCredit, calculatedLimit, receivablesTotal, receivablesCount, loading } = useDynamicCredit();

  if (loading) {
    return (
      <Card className="shadow-sm border-border/50">
        <CardHeader className="pb-2"><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-28 w-full" /></CardContent>
      </Card>
    );
  }

  const utilizationPercent = dynamicCredit?.utilization_percent || 50;
  const isActive = receivablesTotal > 0;

  return (
    <Card className="shadow-sm border-border/50 overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-primary/10 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/15 p-2">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Crédito Dinâmico</CardTitle>
              <CardDescription className="text-xs">Baseado nos seus recebíveis</CardDescription>
            </div>
          </div>
          <Badge variant={isActive ? 'default' : 'secondary'} className="text-[10px]">
            {isActive ? 'Ativo' : 'Sem recebíveis'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* How it works */}
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/40">
          <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground">
            Seus fretes confirmados servem como garantia para liberar crédito temporário automaticamente.
          </p>
        </div>

        {/* Main metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg p-3 border border-border/40 bg-card">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Recebíveis</span>
            </div>
            <p className="text-lg font-bold text-foreground">{formatBRL(receivablesTotal)}</p>
            <p className="text-[10px] text-muted-foreground">{receivablesCount} frete{receivablesCount !== 1 ? 's' : ''} confirmado{receivablesCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="rounded-lg p-3 border border-primary/20 bg-primary/[0.06]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Crédito disponível</span>
            </div>
            <p className="text-lg font-bold text-primary">{formatBRL(calculatedLimit)}</p>
            <p className="text-[10px] text-muted-foreground">{utilizationPercent}% dos recebíveis</p>
          </div>
        </div>

        {/* Visual gauge */}
        {isActive && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Garantia utilizada</span>
              <span>{utilizationPercent}%</span>
            </div>
            <Progress value={utilizationPercent} className="h-2" />
          </div>
        )}

        {/* Auto-lock info */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/5 border border-warning/15">
          <Lock className="h-3.5 w-3.5 text-warning shrink-0" />
          <p className="text-[10px] text-muted-foreground">
            Crédito ajustado automaticamente: reduz se frete cancelado, disputa aberta ou recebível liquidado.
          </p>
        </div>

        {/* Security */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
          <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
          <p className="text-[10px] text-muted-foreground">
            Recebíveis usados como garantia ficam travados contra dupla antecipação.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

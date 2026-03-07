import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowDown, ArrowRight, Lock, CheckCircle2, ShieldAlert, 
  Clock, Banknote
} from 'lucide-react';
import type { WalletData } from '@/hooks/useWallet';

interface EscrowFlowCardProps {
  wallet: WalletData | null;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const EscrowFlowCard: React.FC<EscrowFlowCardProps> = ({ wallet }) => {
  const available = wallet?.available_balance || 0;
  const pending = wallet?.pending_balance || 0;
  const reserved = wallet?.reserved_balance || 0;
  const blocked = wallet?.blocked_balance || 0;
  const total = available + pending + reserved + blocked;

  if (total === 0) return null;

  const states = [
    {
      label: 'Pendente',
      value: pending,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      borderColor: 'border-amber-200 dark:border-amber-800',
      description: 'Aguardando confirmação',
    },
    {
      label: 'Reservado (Escrow)',
      value: reserved,
      icon: Lock,
      color: 'text-primary',
      bgColor: 'bg-primary/5',
      borderColor: 'border-primary/20',
      description: 'Fretes em andamento',
    },
    {
      label: 'Bloqueado',
      value: blocked,
      icon: ShieldAlert,
      color: 'text-destructive',
      bgColor: 'bg-destructive/5',
      borderColor: 'border-destructive/20',
      description: 'Disputas / Revisão',
    },
    {
      label: 'Disponível',
      value: available,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
      description: 'Livre para uso',
    },
  ];

  const activeStates = states.filter(s => s.value > 0);
  if (activeStates.length <= 1) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Banknote className="h-4 w-4 text-primary" />
          Estados Financeiros
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {/* Flow visualization */}
        <div className="flex items-stretch gap-1 flex-wrap">
          {activeStates.map((state, idx) => {
            const Icon = state.icon;
            const pct = total > 0 ? (state.value / total) * 100 : 0;
            return (
              <React.Fragment key={state.label}>
                {idx > 0 && (
                  <div className="flex items-center px-1">
                    <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                  </div>
                )}
                <div className={`flex-1 min-w-[100px] rounded-lg p-2.5 border ${state.bgColor} ${state.borderColor}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`h-3.5 w-3.5 ${state.color}`} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {state.label}
                    </span>
                  </div>
                  <p className={`text-sm font-bold ${state.color}`}>
                    {formatBRL(state.value)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{state.description}</p>
                  {/* Percentage bar */}
                  <div className="mt-1.5 h-1 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${state.color.replace('text-', 'bg-')}/30`}
                      style={{ width: `${Math.max(pct, 5)}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{pct.toFixed(0)}% do total</p>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Flow description */}
        <div className="mt-3 p-2.5 bg-muted/30 rounded-lg">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <strong>Fluxo escrow:</strong> Pagamentos de frete entram como <em>Reservado</em> → após confirmação de entrega, o sistema deduz antecipações e parcelas de crédito → saldo restante vai para <em>Disponível</em>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

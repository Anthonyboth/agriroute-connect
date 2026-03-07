import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowRight, Lock, CheckCircle2, Clock, 
  Truck, Banknote, ArrowDown, Info, Split
} from 'lucide-react';
import type { PaymentOrder, Payout } from '@/hooks/usePaymentOrders';

interface PaymentOrdersCardProps {
  orders: PaymentOrder[];
  payouts: Payout[];
  escrowTotal: number;
  releasedTotal: number;
  loading: boolean;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const getFinStatusBadge = (status: string) => {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending_payment: { label: 'Aguardando', variant: 'outline' },
    paid_reserved: { label: 'Escrow', variant: 'default' },
    processing_split: { label: 'Processando', variant: 'secondary' },
    partially_released: { label: 'Parcial', variant: 'secondary' },
    fully_released: { label: 'Liberado', variant: 'default' },
    blocked: { label: 'Bloqueado', variant: 'destructive' },
    refunded: { label: 'Reembolsado', variant: 'outline' },
    cancelled: { label: 'Cancelado', variant: 'outline' },
  };
  const info = map[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={info.variant} className="text-[10px]">{info.label}</Badge>;
};

export const PaymentOrdersCard: React.FC<PaymentOrdersCardProps> = ({
  orders, payouts, escrowTotal, releasedTotal, loading
}) => {
  if (loading) return null;

  const activeOrders = orders.filter(o => !['cancelled', 'refunded'].includes(o.status_financial));

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Split className="h-4 w-4 text-primary" />
          Ordens de Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4 space-y-4">
        {/* Summary metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg p-2.5 bg-primary/[0.06] border border-primary/15">
            <div className="flex items-center gap-1 mb-0.5">
              <Lock className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-medium text-muted-foreground">Em Escrow</span>
            </div>
            <p className="text-sm font-bold text-primary">{formatBRL(escrowTotal)}</p>
          </div>
          <div className="rounded-lg p-2.5 bg-primary/[0.04] border border-primary/10">
            <div className="flex items-center gap-1 mb-0.5">
              <CheckCircle2 className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-medium text-muted-foreground">Liberado</span>
            </div>
            <p className="text-sm font-bold text-primary">{formatBRL(releasedTotal)}</p>
          </div>
          <div className="rounded-lg p-2.5 bg-muted/40 border border-border/40">
            <div className="flex items-center gap-1 mb-0.5">
              <Banknote className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground">Payouts</span>
            </div>
            <p className="text-sm font-bold text-foreground">{payouts.length}</p>
          </div>
        </div>

        {/* Orders list */}
        {activeOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="rounded-full bg-muted/60 p-3 mb-3">
              <Truck className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Nenhuma ordem ativa</p>
            <p className="text-xs text-muted-foreground max-w-[260px] mb-3">
              Ordens de pagamento são criadas automaticamente quando fretes são aceitos e pagos pelo embarcador.
            </p>
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/40 text-left max-w-xs">
              <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[10px] text-muted-foreground">
                O fluxo é: <strong>Pagamento → Escrow → Entrega → Split → Liberação</strong>. Cada etapa é registrada no ledger.
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[240px]">
            <div className="space-y-2">
              {activeOrders.slice(0, 10).map(order => (
                <div key={order.id} className="rounded-lg border p-2.5 bg-card">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      #{order.id.slice(0, 8)}
                    </span>
                    {getFinStatusBadge(order.status_financial)}
                  </div>
                  
                  {/* Split flow visualization */}
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-wrap">
                    <span className="font-semibold text-foreground">{formatBRL(order.gross_amount)}</span>
                    {order.platform_fee_amount > 0 && (
                      <>
                        <ArrowRight className="h-2.5 w-2.5" />
                        <span className="text-destructive">-{formatBRL(order.platform_fee_amount)} taxa</span>
                      </>
                    )}
                    {order.advance_deduction > 0 && (
                      <>
                        <ArrowRight className="h-2.5 w-2.5" />
                        <span className="text-warning">-{formatBRL(order.advance_deduction)} antec.</span>
                      </>
                    )}
                    {order.credit_deduction > 0 && (
                      <>
                        <ArrowRight className="h-2.5 w-2.5" />
                        <span className="text-accent">-{formatBRL(order.credit_deduction)} créd.</span>
                      </>
                    )}
                    {order.net_amount > 0 && (
                      <>
                        <ArrowRight className="h-2.5 w-2.5" />
                        <span className="font-semibold text-primary">{formatBRL(order.net_amount)} líquido</span>
                      </>
                    )}
                  </div>
                  
                  <p className="text-[9px] text-muted-foreground mt-1">
                    {new Date(order.created_at).toLocaleDateString('pt-BR')} · {order.operation_owner_type === 'carrier' ? 'Transportadora' : order.operation_owner_type === 'driver' ? 'Motorista' : order.operation_owner_type}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Payouts section */}
        {payouts.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Repasses Recentes
            </p>
            <div className="space-y-1.5">
              {payouts.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center justify-between text-xs px-2 py-1.5 bg-muted/30 rounded">
                  <div className="flex items-center gap-1.5">
                    <ArrowDown className="h-3 w-3 text-primary" />
                    <span>{formatBRL(p.gross_amount)}</span>
                    {(p.credit_deduction > 0 || p.advance_deduction > 0) && (
                      <span className="text-[10px] text-muted-foreground">
                        ({p.credit_deduction > 0 ? `-${formatBRL(p.credit_deduction)} créd` : ''}
                        {p.advance_deduction > 0 ? ` -${formatBRL(p.advance_deduction)} antec` : ''})
                      </span>
                    )}
                  </div>
                  <span className="font-semibold text-primary">{formatBRL(p.net_amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

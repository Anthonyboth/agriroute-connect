import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  RefreshCw, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  CreditCard, Banknote, Receipt, FileText, Zap, ShieldAlert,
  Truck, Clock, Info, CircleDollarSign
} from 'lucide-react';
import type { WalletTransaction } from '@/hooks/useWallet';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FreightFinancialReceipt } from './FreightFinancialReceipt';

interface FinancialTimelineProps {
  transactions: WalletTransaction[];
  loading: boolean;
  onRefresh: () => void;
}

const TX_ICON: Record<string, { icon: React.ElementType; color: string }> = {
  deposit: { icon: ArrowDownToLine, color: 'text-primary' },
  withdrawal: { icon: ArrowUpFromLine, color: 'text-destructive' },
  transfer_in: { icon: ArrowLeftRight, color: 'text-primary' },
  transfer_out: { icon: ArrowLeftRight, color: 'text-destructive' },
  payment: { icon: CreditCard, color: 'text-destructive' },
  payout: { icon: Truck, color: 'text-primary' },
  refund: { icon: Receipt, color: 'text-primary' },
  fee: { icon: FileText, color: 'text-destructive' },
  credit_use: { icon: CreditCard, color: 'text-warning' },
  advance: { icon: Zap, color: 'text-accent' },
  auto_deduction: { icon: Receipt, color: 'text-destructive' },
  reserve: { icon: Clock, color: 'text-warning' },
  release: { icon: Banknote, color: 'text-primary' },
};

const TX_LABEL: Record<string, string> = {
  deposit: 'Depósito',
  withdrawal: 'Saque Pix',
  transfer_in: 'Transferência recebida',
  transfer_out: 'Transferência enviada',
  payment: 'Pagamento',
  payout: 'Repasse de frete',
  refund: 'Reembolso',
  fee: 'Taxa da plataforma',
  credit_use: 'Uso de crédito',
  advance: 'Antecipação de frete',
  auto_deduction: 'Desconto automático',
  reserve: 'Reserva escrow',
  release: 'Liberação de saldo',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  completed: { label: 'Concluído', variant: 'default' },
  pending: { label: 'Pendente', variant: 'secondary' },
  failed: { label: 'Falhou', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'outline' },
  under_review: { label: 'Em Análise', variant: 'secondary' },
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const POSITIVE_TYPES = ['deposit', 'transfer_in', 'refund', 'release', 'payout', 'advance'];

function getDateLabel(date: Date): string {
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  return format(date, "dd 'de' MMMM", { locale: ptBR });
}

interface GroupedTransactions {
  label: string;
  date: Date;
  items: WalletTransaction[];
}

function groupByDate(txs: WalletTransaction[]): GroupedTransactions[] {
  const groups: GroupedTransactions[] = [];
  for (const tx of txs) {
    const d = new Date(tx.created_at);
    const existing = groups.find(g => isSameDay(g.date, d));
    if (existing) {
      existing.items.push(tx);
    } else {
      groups.push({ label: getDateLabel(d), date: d, items: [tx] });
    }
  }
  return groups;
}

export const FinancialTimeline: React.FC<FinancialTimelineProps> = ({ transactions, loading, onRefresh }) => {
  const [filter, setFilter] = useState('all');
  const [receiptFreightId, setReceiptFreightId] = useState<string | null>(null);

  const filtered = filter === 'all'
    ? transactions
    : transactions.filter(t => t.transaction_type === filter);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <Card className="shadow-sm border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-muted p-2"><Clock className="h-5 w-5 text-muted-foreground" /></div>
            <div>
              <CardTitle className="text-base font-semibold">Timeline Financeira</CardTitle>
              <CardDescription className="text-xs">Histórico completo de movimentações</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Filtrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="deposit">Depósitos</SelectItem>
                <SelectItem value="withdrawal">Saques</SelectItem>
                <SelectItem value="payout">Repasses</SelectItem>
                <SelectItem value="credit_use">Crédito</SelectItem>
                <SelectItem value="advance">Antecipações</SelectItem>
                <SelectItem value="payment">Pagamentos</SelectItem>
                <SelectItem value="auto_deduction">Descontos</SelectItem>
                <SelectItem value="reserve">Reservas</SelectItem>
                <SelectItem value="release">Liberações</SelectItem>
                <SelectItem value="fee">Taxas</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={onRefresh} disabled={loading} className="h-8 w-8 p-0">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted/60 p-4 mb-4">
              <Receipt className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Nenhuma transação encontrada</p>
            <p className="text-xs text-muted-foreground max-w-[280px] mb-4">
              {filter !== 'all' 
                ? `Não há transações do tipo "${TX_LABEL[filter] || filter}". Tente outro filtro ou aguarde novas movimentações.`
                : 'Realize depósitos, saques, pagamentos ou receba fretes para gerar movimentações financeiras.'
              }
            </p>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border/40 text-left max-w-sm">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-[11px] text-muted-foreground space-y-1">
                <p className="font-medium text-foreground text-xs">O que aparece aqui?</p>
                <p>• Depósitos e saques via Pix</p>
                <p>• Pagamentos e recebimentos de frete</p>
                <p>• Reservas escrow e liberações</p>
                <p>• Descontos automáticos de crédito</p>
                <p>• Antecipações de recebíveis</p>
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-5">
              {grouped.map((group) => (
                <div key={group.label}>
                  {/* Date header */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>

                  {/* Timeline items */}
                  <div className="relative pl-6 space-y-0">
                    {/* Vertical line */}
                    <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border/50" />

                    {group.items.map((tx) => {
                      const cfg = TX_ICON[tx.transaction_type] || { icon: FileText, color: 'text-muted-foreground' };
                      const Icon = cfg.icon;
                      const statusCfg = STATUS_CONFIG[tx.status] || { label: tx.status, variant: 'outline' as const };
                      const isPositive = POSITIVE_TYPES.includes(tx.transaction_type);

                      return (
                        <div key={tx.id} className="relative flex items-start gap-3 py-2.5">
                          {/* Timeline dot */}
                          <div className="absolute -left-6 top-3 rounded-full border-2 border-background p-1 bg-muted">
                            <Icon className={`h-3 w-3 ${cfg.color}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 flex items-center justify-between min-w-0">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{TX_LABEL[tx.transaction_type] || tx.transaction_type}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{tx.description || '—'}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-[11px] text-muted-foreground">
                                  {tx.created_at ? format(new Date(tx.created_at), 'HH:mm', { locale: ptBR }) : '—'}
                                </p>
                                {tx.reference_type === 'freight' && tx.reference_id && (
                                  <button
                                    type="button"
                                    onClick={() => setReceiptFreightId(tx.reference_id!)}
                                    className="text-[10px] text-primary hover:underline font-medium"
                                  >
                                    Ver comprovante
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <Badge variant={statusCfg.variant} className="text-[10px] px-1.5 py-0">
                                {statusCfg.label}
                              </Badge>
                              <span className={`text-sm font-bold tabular-nums ${isPositive ? 'text-primary' : 'text-destructive'}`}>
                                {isPositive ? '+' : '-'}{formatBRL(tx.amount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* COFA Receipt Modal */}
      {receiptFreightId && (
        <FreightFinancialReceipt
          freightId={receiptFreightId}
          open={!!receiptFreightId}
          onOpenChange={(open) => !open && setReceiptFreightId(null)}
        />
      )}
    </Card>
  );
};

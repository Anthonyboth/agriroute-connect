import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, CreditCard, Banknote, Receipt, FileText } from 'lucide-react';
import type { WalletTransaction } from '@/hooks/useWallet';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WalletStatementProps {
  transactions: WalletTransaction[];
  loading: boolean;
  onRefresh: () => void;
}

const TX_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  deposit: { label: 'Depósito', icon: ArrowDownToLine, color: 'text-success' },
  withdrawal: { label: 'Saque', icon: ArrowUpFromLine, color: 'text-destructive' },
  transfer_in: { label: 'Transferência Recebida', icon: ArrowLeftRight, color: 'text-success' },
  transfer_out: { label: 'Transferência Enviada', icon: ArrowLeftRight, color: 'text-destructive' },
  payment: { label: 'Pagamento', icon: CreditCard, color: 'text-destructive' },
  payout: { label: 'Repasse', icon: Banknote, color: 'text-primary' },
  refund: { label: 'Reembolso', icon: Receipt, color: 'text-success' },
  fee: { label: 'Taxa', icon: FileText, color: 'text-destructive' },
  credit_use: { label: 'Uso de Crédito', icon: CreditCard, color: 'text-warning' },
  advance: { label: 'Antecipação', icon: Banknote, color: 'text-primary' },
  auto_deduction: { label: 'Desconto Automático', icon: Receipt, color: 'text-destructive' },
  reserve: { label: 'Reserva', icon: FileText, color: 'text-warning' },
  release: { label: 'Liberação', icon: FileText, color: 'text-success' },
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

export const WalletStatement: React.FC<WalletStatementProps> = ({ transactions, loading, onRefresh }) => {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' 
    ? transactions 
    : transactions.filter(t => t.transaction_type === filter);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Extrato</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Filtrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="deposit">Depósitos</SelectItem>
                <SelectItem value="withdrawal">Saques</SelectItem>
                <SelectItem value="transfer_in">Transferências Recebidas</SelectItem>
                <SelectItem value="transfer_out">Transferências Enviadas</SelectItem>
                <SelectItem value="payment">Pagamentos</SelectItem>
                <SelectItem value="payout">Repasses</SelectItem>
                <SelectItem value="credit_use">Uso de Crédito</SelectItem>
                <SelectItem value="advance">Antecipações</SelectItem>
                <SelectItem value="auto_deduction">Descontos</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma transação encontrada</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-2">
              {filtered.map((tx) => {
                const config = TX_TYPE_CONFIG[tx.transaction_type] || { label: tx.transaction_type, icon: FileText, color: 'text-muted-foreground' };
                const statusConfig = STATUS_CONFIG[tx.status] || { label: tx.status, variant: 'outline' as const };
                const Icon = config.icon;
                const isPositive = ['deposit', 'transfer_in', 'refund', 'release', 'payout'].includes(tx.transaction_type);

                return (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-1.5 rounded-md bg-muted`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{config.label}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {tx.description || '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tx.created_at ? format(new Date(tx.created_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={statusConfig.variant} className="text-xs">
                        {statusConfig.label}
                      </Badge>
                      <span className={`text-sm font-semibold ${isPositive ? 'text-success' : 'text-destructive'}`}>
                        {isPositive ? '+' : '-'}{formatBRL(tx.amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Comprovante Operacional Financeiro Automático (COFA)
 * Liga evento operacional ao evento financeiro de forma auditável.
 */
import React, { useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MapPin, Truck, CheckCircle2, Clock, AlertTriangle,
  FileText, ArrowRight, Download, Receipt, User,
  ShieldCheck, CircleDollarSign, Banknote
} from 'lucide-react';
import { useFreightReceipt, type ReceiptOperationalEvent } from '@/hooks/useFreightReceipt';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getCargoTypeLabel } from '@/lib/cargo-types';

interface FreightFinancialReceiptProps {
  freightId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const EventIcon: React.FC<{ status: ReceiptOperationalEvent['status'] }> = ({ status }) => {
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-primary" />;
  if (status === 'pending') return <Clock className="h-4 w-4 text-muted-foreground/50" />;
  return <AlertTriangle className="h-4 w-4 text-warning" />;
};

const FinStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending_payment: { label: 'Aguardando', variant: 'outline' },
    paid_reserved: { label: 'Em Escrow', variant: 'secondary' },
    processing_split: { label: 'Processando', variant: 'secondary' },
    fully_released: { label: 'Liberado', variant: 'default' },
    blocked: { label: 'Bloqueado', variant: 'destructive' },
  };
  const info = map[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={info.variant} className="text-[10px]">{info.label}</Badge>;
};

export const FreightFinancialReceipt: React.FC<FreightFinancialReceiptProps> = ({
  freightId, open, onOpenChange
}) => {
  const { receipt, loading, fetchReceipt } = useFreightReceipt();

  useEffect(() => {
    if (open && freightId) {
      fetchReceipt(freightId);
    }
  }, [open, freightId, fetchReceipt]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto print:shadow-none print:border-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-5 w-5 text-primary" />
            Comprovante Financeiro
          </DialogTitle>
          <DialogDescription className="text-xs">
            Comprovante operacional-financeiro automático (COFA)
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !receipt ? (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Dados do comprovante não disponíveis</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* === FREIGHT INFO === */}
            <div className="rounded-lg border border-border/50 p-4 bg-muted/20">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground font-mono">Frete #{receipt.freight.short_id}</p>
                  <p className="text-sm font-semibold">{getCargoTypeLabel(receipt.freight.cargo_type)}</p>
                </div>
                <FinStatusBadge status={receipt.financial.status_financial} />
              </div>

              {/* Route */}
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-medium">{receipt.freight.origin_city}</span>
                {receipt.freight.origin_state && (
                  <span className="text-muted-foreground text-xs">{receipt.freight.origin_state}</span>
                )}
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="font-medium">{receipt.freight.destination_city}</span>
                {receipt.freight.destination_state && (
                  <span className="text-muted-foreground text-xs">{receipt.freight.destination_state}</span>
                )}
              </div>

              {/* Participants */}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {receipt.freight.producer_name && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> Embarcador: <strong className="text-foreground">{receipt.freight.producer_name}</strong>
                  </span>
                )}
                {receipt.freight.driver_name && (
                  <span className="flex items-center gap-1">
                    <Truck className="h-3 w-3" /> Motorista: <strong className="text-foreground">{receipt.freight.driver_name}</strong>
                  </span>
                )}
              </div>

              {receipt.freight.created_at && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Criado em {format(new Date(receipt.freight.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>

            {/* === FINANCIAL BREAKDOWN === */}
            <div className="rounded-lg border border-primary/15 bg-primary/[0.03] p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <CircleDollarSign className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Detalhamento Financeiro</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Valor bruto do frete</span>
                  <span className="text-sm font-bold">{formatBRL(receipt.financial.gross_amount)}</span>
                </div>

                {receipt.financial.platform_fee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Taxa da plataforma</span>
                    <span className="text-sm font-medium text-destructive">- {formatBRL(receipt.financial.platform_fee)}</span>
                  </div>
                )}

                {receipt.financial.advance_deduction > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Antecipação aplicada</span>
                    <span className="text-sm font-medium text-destructive">- {formatBRL(receipt.financial.advance_deduction)}</span>
                  </div>
                )}

                {receipt.financial.credit_deduction > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Desconto de crédito</span>
                    <span className="text-sm font-medium text-destructive">- {formatBRL(receipt.financial.credit_deduction)}</span>
                  </div>
                )}

                <Separator className="my-1" />

                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Banknote className="h-4 w-4 text-primary" />
                    Valor líquido liberado
                  </span>
                  <span className="text-lg font-bold text-primary">{formatBRL(receipt.financial.net_amount)}</span>
                </div>
              </div>

              {receipt.financial.payment_order_id && (
                <p className="text-[10px] text-muted-foreground mt-3 font-mono">
                  Ordem: {receipt.financial.payment_order_id.slice(0, 12)}...
                </p>
              )}
            </div>

            {/* === OPERATIONAL TIMELINE === */}
            <div className="rounded-lg border border-border/50 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Eventos Operacionais</p>
              </div>

              <div className="relative pl-6 space-y-0">
                {/* Vertical line */}
                <div className="absolute left-[9px] top-1 bottom-1 w-px bg-border/60" />

                {receipt.events.map((event, i) => (
                  <div key={i} className="relative flex items-start gap-3 py-2">
                    {/* Dot */}
                    <div className="absolute -left-6 top-2.5 rounded-full border-2 border-background bg-muted p-0.5">
                      <EventIcon status={event.status} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <div className="min-w-0">
                        <p className={`text-sm ${event.status === 'completed' ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                          {event.label}
                        </p>
                        {event.responsible && (
                          <p className="text-[10px] text-muted-foreground">{event.responsible}</p>
                        )}
                      </div>
                      {event.timestamp ? (
                        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                          {format(new Date(event.timestamp), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40 shrink-0">Pendente</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* === FOOTER === */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-[10px] text-muted-foreground">
                Gerado automaticamente • AgriRoute COFA
              </p>
              <Button size="sm" variant="outline" onClick={handlePrint} className="text-xs gap-1.5 print:hidden">
                <Download className="h-3.5 w-3.5" /> Exportar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

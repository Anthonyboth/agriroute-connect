import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CircleDollarSign, CalendarClock, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Installment {
  id: string;
  installment_number: number;
  amount: number;
  paid_amount: number;
  due_date: string;
  status: string;
}

interface PayInstallmentModalProps {
  open: boolean;
  onClose: () => void;
  installments: Installment[];
  availableBalance: number;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const PayInstallmentModal: React.FC<PayInstallmentModalProps> = ({
  open, onClose, installments, availableBalance
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const pendingInstallments = installments
    .filter(i => i.status === 'pending' || i.status === 'overdue')
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const totalSelected = pendingInstallments
    .filter(i => selectedIds.has(i.id))
    .reduce((s, i) => s + (i.amount - i.paid_amount), 0);

  const canPay = selectedIds.size > 0 && totalSelected <= availableBalance;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePay = async () => {
    setLoading(true);
    // Simulate — in production this would call an RPC
    await new Promise(r => setTimeout(r, 1000));
    toast.info('Pagamento de parcela — RPC de backend necessária para processar. Em desenvolvimento.');
    setLoading(false);
    setSelectedIds(new Set());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2"><CircleDollarSign className="h-5 w-5 text-primary" /></div>
            <div>
              <DialogTitle className="text-base">Pagar Parcelas</DialogTitle>
              <DialogDescription className="text-xs">
                Saldo disponível: <strong>{formatBRL(availableBalance)}</strong>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {pendingInstallments.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-8 w-8 text-primary/40 mx-auto mb-2" />
              <p className="text-sm font-medium">Todas as parcelas estão em dia!</p>
              <p className="text-xs text-muted-foreground">Não há parcelas pendentes para pagamento.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Selecione as parcelas que deseja pagar:</p>
              <ScrollArea className="max-h-[240px]">
                <div className="space-y-2">
                  {pendingInstallments.map(inst => {
                    const remaining = inst.amount - inst.paid_amount;
                    const isSelected = selectedIds.has(inst.id);
                    return (
                      <button
                        key={inst.id}
                        type="button"
                        onClick={() => toggleSelect(inst.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/[0.06] ring-1 ring-primary/30'
                            : inst.status === 'overdue'
                            ? 'border-destructive/30 bg-destructive/[0.03] hover:bg-destructive/[0.06]'
                            : 'border-border/50 bg-card hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                          }`}>
                            {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <div>
                            <span className="text-xs font-medium">Parcela {inst.installment_number}</span>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <CalendarClock className="h-3 w-3" />
                              {format(new Date(inst.due_date), 'dd MMM yyyy', { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {inst.status === 'overdue' && (
                            <Badge variant="destructive" className="text-[9px]">Vencida</Badge>
                          )}
                          <span className="font-bold text-sm">{formatBRL(remaining)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>

              <Separator />

              <div className="rounded-lg bg-primary/[0.06] border border-primary/20 p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total selecionado</span>
                  <span className="font-bold text-primary">{formatBRL(totalSelected)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{selectedIds.size} parcela(s)</span>
                  <span>Saldo após: {formatBRL(availableBalance - totalSelected)}</span>
                </div>
              </div>

              {totalSelected > availableBalance && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/[0.06] border border-destructive/20">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                  <p className="text-[11px] text-destructive">Saldo insuficiente para as parcelas selecionadas.</p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handlePay}
            disabled={loading || !canPay}
          >
            {loading ? 'Processando...' : <><CircleDollarSign className="h-3.5 w-3.5" /> Pagar {formatBRL(totalSelected)} <ArrowRight className="h-3.5 w-3.5" /></>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Calculator, ArrowRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface CreditSimulatorModalProps {
  open: boolean;
  onClose: () => void;
  creditLimit: number;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const MONTHLY_RATE = 0.029; // 2.9% a.m. example

export const CreditSimulatorModal: React.FC<CreditSimulatorModalProps> = ({ open, onClose, creditLimit }) => {
  const [amount, setAmount] = useState(Math.min(1000, creditLimit));
  const [installments, setInstallments] = useState(3);

  const simulation = useMemo(() => {
    const totalRate = Math.pow(1 + MONTHLY_RATE, installments);
    const totalWithFee = amount * totalRate;
    const fee = totalWithFee - amount;
    const installmentValue = totalWithFee / installments;
    return { totalWithFee, fee, installmentValue, monthlyRate: MONTHLY_RATE * 100 };
  }, [amount, installments]);

  const handleConfirm = () => {
    toast.info('Solicitação de crédito — funcionalidade em desenvolvimento');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-accent/10 p-2"><Calculator className="h-5 w-5 text-accent" /></div>
            <div>
              <DialogTitle className="text-base">Simular Crédito</DialogTitle>
              <DialogDescription className="text-xs">Veja parcelas e taxas antes de usar</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Amount */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Valor do crédito</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={100}
                max={creditLimit}
                value={amount}
                onChange={e => setAmount(Math.min(Number(e.target.value), creditLimit))}
                className="text-lg font-bold"
              />
              <Badge variant="outline" className="text-[10px] shrink-0">Máx: {formatBRL(creditLimit)}</Badge>
            </div>
            <Slider
              min={100}
              max={creditLimit || 100}
              step={50}
              value={[amount]}
              onValueChange={v => setAmount(v[0])}
              className="mt-1"
            />
          </div>

          {/* Installments */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Parcelas</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 6, 12].map(n => (
                <Button
                  key={n}
                  size="sm"
                  variant={installments === n ? 'default' : 'outline'}
                  className="text-xs flex-1 h-9"
                  onClick={() => setInstallments(n)}
                >
                  {n}x
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Results */}
          <div className="rounded-lg bg-primary/[0.06] border border-primary/20 p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor solicitado</span>
              <span className="font-semibold">{formatBRL(amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Parcelas</span>
              <span className="font-semibold">{installments}x de {formatBRL(simulation.installmentValue)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxa ({simulation.monthlyRate.toFixed(1)}% a.m.)</span>
              <span className="font-medium text-warning">{formatBRL(simulation.fee)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base">
              <span className="font-medium">Total com taxa</span>
              <span className="font-bold text-primary">{formatBRL(simulation.totalWithFee)}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/60 shrink-0" />
            <p>Valores simulados. Taxas reais podem variar conforme análise de crédito e perfil.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleConfirm}>
            <CreditCard className="h-3.5 w-3.5" /> Confirmar Crédito <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

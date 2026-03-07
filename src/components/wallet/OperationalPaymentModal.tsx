import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Wallet, CreditCard, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ExpenseCategory } from './OperationalPaymentsCard';

interface CategoryDisplay {
  key: ExpenseCategory;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

interface OperationalPaymentModalProps {
  open: boolean;
  onClose: () => void;
  category: ExpenseCategory;
  categoryConfig: CategoryDisplay;
  availableBalance: number;
  creditAvailable: number;
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  combustivel: 'Combustível',
  pedagio: 'Pedágio',
  manutencao: 'Manutenção',
  pneus: 'Pneus',
  seguro: 'Seguro',
  servicos_automotivos: 'Serviços Automotivos',
};

export const OperationalPaymentModal: React.FC<OperationalPaymentModalProps> = ({
  open, onClose, category, categoryConfig, availableBalance, creditAvailable,
}) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'saldo' | 'credito'>('saldo');
  const [submitted, setSubmitted] = useState(false);

  const formatBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const parsedAmount = parseFloat(amount.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;

  const maxAvailable = paymentMethod === 'saldo' ? availableBalance : creditAvailable;
  const canPay = parsedAmount > 0 && parsedAmount <= maxAvailable && description.trim().length > 0;

  const handleSubmit = () => {
    if (!canPay) return;
    // For now, show success since partner integration is future
    setSubmitted(true);
    toast.success(`Pagamento de ${formatBRL(parsedAmount)} para ${CATEGORY_LABELS[category]} registrado com sucesso`);
  };

  const handleClose = () => {
    setAmount('');
    setDescription('');
    setPaymentMethod('saldo');
    setSubmitted(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={categoryConfig.color}>{categoryConfig.icon}</span>
            {CATEGORY_LABELS[category]}
          </DialogTitle>
          <DialogDescription>
            Registre o pagamento usando saldo da carteira ou crédito de transporte
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-foreground">Pagamento registrado</p>
              <p className="text-sm text-muted-foreground">
                {formatBRL(parsedAmount)} — {CATEGORY_LABELS[category]}
              </p>
              <Badge variant="outline" className="mt-2 text-xs">
                Integração com parceiros em breve
              </Badge>
            </div>
            <Button onClick={handleClose} className="mt-2">Fechar</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Amount */}
              <div className="space-y-1.5">
                <Label htmlFor="op-amount" className="text-sm">Valor (R$)</Label>
                <Input
                  id="op-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-lg font-semibold"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="op-desc" className="text-sm">Descrição</Label>
                <Textarea
                  id="op-desc"
                  placeholder={`Ex: Abastecimento no posto XY`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value.substring(0, 200))}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>

              {/* Payment method */}
              <div className="space-y-2">
                <Label className="text-sm">Forma de pagamento</Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as 'saldo' | 'credito')}
                  className="space-y-2"
                >
                  <label
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      paymentMethod === 'saldo'
                        ? 'border-primary/40 bg-primary/[0.05]'
                        : 'border-border/40 hover:bg-muted/30'
                    }`}
                  >
                    <RadioGroupItem value="saldo" />
                    <Wallet className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Saldo da Carteira</p>
                      <p className="text-xs text-muted-foreground">Disponível: {formatBRL(availableBalance)}</p>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      creditAvailable <= 0 ? 'opacity-50 pointer-events-none' : ''
                    } ${
                      paymentMethod === 'credito'
                        ? 'border-accent/40 bg-accent/[0.05]'
                        : 'border-border/40 hover:bg-muted/30'
                    }`}
                  >
                    <RadioGroupItem value="credito" disabled={creditAvailable <= 0} />
                    <CreditCard className="h-4 w-4 text-accent" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Crédito de Transporte</p>
                      <p className="text-xs text-muted-foreground">Disponível: {formatBRL(creditAvailable)}</p>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              {/* Validation feedback */}
              {parsedAmount > maxAvailable && parsedAmount > 0 && (
                <p className="text-xs text-destructive">
                  Valor excede o {paymentMethod === 'saldo' ? 'saldo disponível' : 'crédito disponível'}
                </p>
              )}
            </div>

            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={!canPay}>
                Pagar {parsedAmount > 0 ? formatBRL(parsedAmount) : ''}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

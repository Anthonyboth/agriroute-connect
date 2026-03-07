import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowDownToLine } from 'lucide-react';

interface WalletDepositModalProps {
  open: boolean;
  onClose: () => void;
  onDeposit: (amount: number, description?: string) => Promise<any>;
  loading: boolean;
}

export const WalletDepositModal: React.FC<WalletDepositModalProps> = ({
  open, onClose, onDeposit, loading
}) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async () => {
    const value = parseFloat(amount.replace(',', '.'));
    if (isNaN(value) || value <= 0) return;

    try {
      await onDeposit(value, description || undefined);
      setAmount('');
      setDescription('');
      onClose();
    } catch {
      // error handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-success" />
            Adicionar Dinheiro
          </DialogTitle>
          <DialogDescription>
            Adicione saldo à sua carteira AgriRoute. O valor será creditado instantaneamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="deposit-amount">Valor (R$)</Label>
            <Input
              id="deposit-amount"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-lg font-semibold"
            />
          </div>
          <div>
            <Label htmlFor="deposit-desc">Descrição (opcional)</Label>
            <Input
              id="deposit-desc"
              placeholder="Ex: Depósito para pagamento de frete"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !amount || parseFloat(amount.replace(',', '.')) <= 0}
            className="gap-2"
          >
            {loading ? 'Processando...' : 'Confirmar Depósito'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

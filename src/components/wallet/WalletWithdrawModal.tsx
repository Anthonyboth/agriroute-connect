import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowUpFromLine, AlertTriangle } from 'lucide-react';

interface WalletWithdrawModalProps {
  open: boolean;
  onClose: () => void;
  onWithdraw: (amount: number, pixKey: string, pixKeyType: string, description?: string) => Promise<any>;
  loading: boolean;
  availableBalance: number;
}

const formatBRL = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const WalletWithdrawModal: React.FC<WalletWithdrawModalProps> = ({
  open, onClose, onWithdraw, loading, availableBalance
}) => {
  const [amount, setAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('cpf');
  const [confirmed, setConfirmed] = useState(false);

  const numericAmount = parseFloat(amount.replace(',', '.')) || 0;
  const isValid = numericAmount > 0 && numericAmount <= availableBalance && pixKey.trim().length > 0;

  const handleSubmit = async () => {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }

    try {
      await onWithdraw(numericAmount, pixKey, pixKeyType);
      setAmount('');
      setPixKey('');
      setConfirmed(false);
      onClose();
    } catch {
      setConfirmed(false);
    }
  };

  const handleClose = () => {
    setConfirmed(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpFromLine className="h-5 w-5 text-primary" />
            Sacar via Pix
          </DialogTitle>
          <DialogDescription>
            Saldo disponível: <strong>{formatBRL(availableBalance)}</strong>
          </DialogDescription>
        </DialogHeader>

        {!confirmed ? (
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="withdraw-amount">Valor do saque (R$)</Label>
              <Input
                id="withdraw-amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-lg font-semibold"
              />
              {numericAmount > availableBalance && (
                <p className="text-xs text-destructive mt-1">Valor excede o saldo disponível</p>
              )}
            </div>
            <div>
              <Label>Tipo da chave Pix</Label>
              <Select value={pixKeyType} onValueChange={setPixKeyType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem>
                  <SelectItem value="random">Chave Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pix-key">Chave Pix</Label>
              <Input
                id="pix-key"
                placeholder="Informe sua chave Pix"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <Alert className="border-warning/50 bg-warning/5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-sm">
              Confirme o saque de <strong>{formatBRL(numericAmount)}</strong> para a chave Pix <strong>{pixKey}</strong>.
              Este valor será debitado do seu saldo disponível.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {confirmed ? 'Voltar' : 'Cancelar'}
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !isValid}
            variant={confirmed ? 'destructive' : 'default'}
            className="gap-2"
          >
            {loading ? 'Processando...' : confirmed ? 'Confirmar Saque' : 'Continuar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

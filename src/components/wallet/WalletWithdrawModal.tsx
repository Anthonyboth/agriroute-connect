import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowUpFromLine, AlertTriangle, ShieldCheck } from 'lucide-react';
import { RiskConfirmationFlow } from './RiskConfirmationFlow';

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
  const [riskFlowOpen, setRiskFlowOpen] = useState(false);

  const numericAmount = parseFloat(amount.replace(',', '.')) || 0;
  const isValid = numericAmount > 0 && numericAmount <= availableBalance && pixKey.trim().length > 0;

  const handleContinue = () => {
    if (!isValid) return;
    setRiskFlowOpen(true);
  };

  const handleRiskConfirmed = async () => {
    await onWithdraw(numericAmount, pixKey, pixKeyType);
    setAmount('');
    setPixKey('');
    setRiskFlowOpen(false);
    onClose();
  };

  const handleClose = () => {
    setRiskFlowOpen(false);
    onClose();
  };

  return (
    <>
      <Dialog open={open && !riskFlowOpen} onOpenChange={(v) => !v && handleClose()}>
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

            {/* Security badge */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
              <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
              <p className="text-[10px] text-muted-foreground">
                Operações financeiras são protegidas por análise de risco em tempo real.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button 
              onClick={handleContinue} 
              disabled={loading || !isValid}
              className="gap-2"
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Risk confirmation flow */}
      <RiskConfirmationFlow
        open={riskFlowOpen}
        onClose={() => { setRiskFlowOpen(false); }}
        operationType="withdrawal"
        amount={numericAmount}
        operationLabel="Saque via Pix"
        operationPayload={{ pixKey, pixKeyType, amount: numericAmount }}
        onConfirmed={handleRiskConfirmed}
      />
    </>
  );
};

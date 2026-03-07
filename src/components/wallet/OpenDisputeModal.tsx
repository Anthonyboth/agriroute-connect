import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, AlertTriangle, ArrowRight } from 'lucide-react';

interface OpenDisputeModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (disputeType: string, amount: number, reason: string, freightId?: string) => Promise<void>;
  walletId: string;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const OpenDisputeModal: React.FC<OpenDisputeModalProps> = ({
  open, onClose, onSubmit, walletId
}) => {
  const [disputeType, setDisputeType] = useState('payment_disagreement');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [freightId, setFreightId] = useState('');
  const [loading, setLoading] = useState(false);

  const numericAmount = parseFloat(amount.replace(',', '.')) || 0;
  const isValid = numericAmount > 0 && reason.trim().length >= 10;

  const handleSubmit = async () => {
    if (!isValid) return;
    try {
      setLoading(true);
      await onSubmit(disputeType, numericAmount, reason, freightId || undefined);
      setAmount('');
      setReason('');
      setFreightId('');
      onClose();
    } catch {
      // handled in hook
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-destructive/10 p-2"><ShieldAlert className="h-5 w-5 text-destructive" /></div>
            <div>
              <DialogTitle className="text-base">Abrir Disputa Financeira</DialogTitle>
              <DialogDescription className="text-xs">Conteste um valor ou operação. Será analisada pela equipe.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-medium">Tipo da disputa</Label>
            <Select value={disputeType} onValueChange={setDisputeType}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="payment_disagreement">Divergência de pagamento</SelectItem>
                <SelectItem value="overcharge">Cobrança indevida</SelectItem>
                <SelectItem value="missing_payment">Pagamento não recebido</SelectItem>
                <SelectItem value="wrong_amount">Valor incorreto</SelectItem>
                <SelectItem value="unauthorized_deduction">Desconto não autorizado</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium">Valor contestado (R$)</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="mt-1 text-lg font-semibold"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">ID do frete (opcional)</Label>
            <Input
              placeholder="Cole o ID do frete se aplicável"
              value={freightId}
              onChange={e => setFreightId(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Motivo detalhado</Label>
            <Textarea
              placeholder="Descreva o que aconteceu com o máximo de detalhes possível (mínimo 10 caracteres)"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="mt-1 min-h-[80px]"
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground mt-1">{reason.length}/500 caracteres</p>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/[0.08] border border-warning/20">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              Disputas são analisadas em até 48h úteis. Enquanto em análise, o valor pode ficar bloqueado.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            size="sm"
            variant="destructive"
            className="gap-1.5"
            onClick={handleSubmit}
            disabled={loading || !isValid}
          >
            {loading ? 'Enviando...' : <><ShieldAlert className="h-3.5 w-3.5" /> Abrir Disputa <ArrowRight className="h-3.5 w-3.5" /></>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

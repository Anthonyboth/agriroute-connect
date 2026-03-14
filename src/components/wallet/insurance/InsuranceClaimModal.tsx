import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface InsuranceClaimModalProps {
  open: boolean;
  onClose: () => void;
  insuranceId: string;
  insuranceName: string;
  maxCoverage: number;
  onSubmit: (params: {
    userInsuranceId: string;
    description: string;
    evidenceUrls: string[];
    amountClaimed: number;
  }) => Promise<boolean>;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export const InsuranceClaimModal: React.FC<InsuranceClaimModalProps> = ({
  open, onClose, insuranceId, insuranceName, maxCoverage, onSubmit,
}) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSubmitting(true);
    const ok = await onSubmit({
      userInsuranceId: insuranceId,
      description: description.trim(),
      evidenceUrls: [],
      amountClaimed: parseFloat(amount) || 0,
    });
    setSubmitting(false);
    if (ok) {
      setDescription('');
      setAmount('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle className="text-base">Abrir Sinistro</DialogTitle>
          </div>
          <DialogDescription>{insuranceName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Descrição do incidente</Label>
            <Textarea
              placeholder="Descreva o que aconteceu..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              maxLength={1000}
            />
          </div>

          <div>
            <Label>Valor reclamado (R$)</Label>
            <Input
              type="number"
              placeholder="0,00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            {maxCoverage > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Máximo: {formatBRL(maxCoverage)}
              </p>
            )}
          </div>

          <Button
            className="w-full"
            type="button"
            disabled={!description.trim() || submitting}
            onClick={handleSubmit}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Enviar Sinistro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

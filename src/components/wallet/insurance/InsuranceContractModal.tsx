import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Shield, ChevronRight, Check, Loader2 } from 'lucide-react';
import type { InsuranceProduct } from '@/hooks/useInsurance';

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface InsuranceContractModalProps {
  product: InsuranceProduct | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (params: {
    insuranceProductId: string;
    coverageValue: number;
    price: number;
    paymentMethod: string;
  }) => Promise<boolean>;
}

export const InsuranceContractModal: React.FC<InsuranceContractModalProps> = ({
  product, open, onClose, onConfirm,
}) => {
  const [step, setStep] = useState(0);
  const [coverageValue, setCoverageValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('wallet');
  const [submitting, setSubmitting] = useState(false);

  if (!product) return null;

  const isPercentage = product.pricing_model === 'percentage';
  const covNum = parseFloat(coverageValue) || 0;
  const price = isPercentage
    ? covNum * (product.min_price / 100)
    : product.min_price;
  const coverage = isPercentage
    ? Math.min(covNum, product.max_coverage || covNum)
    : product.max_coverage || 0;

  const handleConfirm = async () => {
    setSubmitting(true);
    const ok = await onConfirm({
      insuranceProductId: product.id,
      coverageValue: coverage,
      price,
      paymentMethod,
    });
    setSubmitting(false);
    if (ok) {
      setStep(0);
      setCoverageValue('');
      setPaymentMethod('wallet');
      onClose();
    }
  };

  const handleClose = () => {
    setStep(0);
    setCoverageValue('');
    setPaymentMethod('wallet');
    onClose();
  };

  const steps = ['Cobertura', 'Simulação', 'Pagamento', 'Confirmar'];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base">Contratar {product.name}</DialogTitle>
          </div>
          <DialogDescription>
            Passo {step + 1} de {steps.length}: {steps[step]}
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        <div className="space-y-4 mt-2">
          {step === 0 && (
            <>
              {isPercentage ? (
                <div>
                  <Label>Valor da carga / bem a proteger (R$)</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 80000"
                    value={coverageValue}
                    onChange={e => setCoverageValue(e.target.value)}
                  />
                  {product.max_coverage && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Cobertura máxima: {formatBRL(product.max_coverage)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm">Plano mensal com cobertura de até {product.max_coverage ? formatBRL(product.max_coverage) : 'conforme contrato'}.</p>
                </div>
              )}
              <Button
                className="w-full gap-1"
                type="button"
                disabled={isPercentage && covNum <= 0}
                onClick={() => setStep(1)}
              >
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {step === 1 && (
            <>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cobertura:</span>
                  <span className="font-semibold">{formatBRL(coverage)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prêmio {isPercentage ? `(${product.min_price}%)` : 'mensal'}:</span>
                  <span className="font-semibold text-primary">{formatBRL(price)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" type="button" onClick={() => setStep(0)}>Voltar</Button>
                <Button className="flex-1 gap-1" type="button" onClick={() => setStep(2)}>
                  Próximo <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="wallet" id="pm-wallet" />
                  <Label htmlFor="pm-wallet" className="cursor-pointer flex-1">Saldo Carteira</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="pix" id="pm-pix" />
                  <Label htmlFor="pm-pix" className="cursor-pointer flex-1">PIX</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="card" id="pm-card" />
                  <Label htmlFor="pm-card" className="cursor-pointer flex-1">Cartão de Crédito</Label>
                </div>
              </RadioGroup>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" type="button" onClick={() => setStep(1)}>Voltar</Button>
                <Button className="flex-1 gap-1" type="button" onClick={() => setStep(3)}>
                  Próximo <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <p className="font-semibold">{product.name}</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cobertura:</span>
                  <span>{formatBRL(coverage)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor:</span>
                  <span className="text-primary font-semibold">{formatBRL(price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pagamento:</span>
                  <span>{paymentMethod === 'wallet' ? 'Saldo Carteira' : paymentMethod === 'pix' ? 'PIX' : 'Cartão'}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" type="button" onClick={() => setStep(2)}>Voltar</Button>
                <Button
                  className="flex-1 gap-1"
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirm}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Confirmar
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

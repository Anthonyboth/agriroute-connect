import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Shield, CheckCircle2, XCircle, Calculator } from 'lucide-react';
import type { InsuranceProduct } from '@/hooks/useInsurance';

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface InsuranceDetailModalProps {
  product: InsuranceProduct | null;
  open: boolean;
  onClose: () => void;
  onContract: (product: InsuranceProduct) => void;
}

export const InsuranceDetailModal: React.FC<InsuranceDetailModalProps> = ({
  product, open, onClose, onContract,
}) => {
  const [simValue, setSimValue] = useState('');

  if (!product) return null;

  const simNum = parseFloat(simValue) || 0;
  const isPercentage = product.pricing_model === 'percentage';
  const simPrice = isPercentage ? simNum * (product.min_price / 100) : product.min_price;
  const simCoverage = isPercentage ? Math.min(simNum, product.max_coverage || simNum) : product.max_coverage;

  const coverageLines = product.coverage_details.split('\n').filter(Boolean);
  const exclusionLines = product.exclusions.split('\n').filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <DialogTitle>{product.name}</DialogTitle>
          </div>
          <DialogDescription>{product.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Coberturas */}
          <div>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              O que cobre
            </h4>
            <ul className="space-y-1">
              {coverageLines.map((line, i) => (
                <li key={i} className="text-sm text-muted-foreground">{line}</li>
              ))}
            </ul>
          </div>

          <Separator />

          {/* Exclusões */}
          <div>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
              <XCircle className="h-4 w-4 text-destructive" />
              O que não cobre
            </h4>
            <ul className="space-y-1">
              {exclusionLines.map((line, i) => (
                <li key={i} className="text-sm text-muted-foreground">{line}</li>
              ))}
            </ul>
          </div>

          <Separator />

          {/* Simulador */}
          {isPercentage && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-1">
                <Calculator className="h-4 w-4 text-primary" />
                Simulador de Preço
              </h4>
              <div>
                <Label htmlFor="sim-value" className="text-xs">Valor da carga (R$)</Label>
                <Input
                  id="sim-value"
                  type="number"
                  placeholder="Ex: 80000"
                  value={simValue}
                  onChange={e => setSimValue(e.target.value)}
                />
              </div>
              {simNum > 0 && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Seguro estimado:</span>
                    <p className="font-semibold text-primary">{formatBRL(simPrice)}</p>
                  </div>
                  {simCoverage && (
                    <div>
                      <span className="text-muted-foreground">Cobertura:</span>
                      <p className="font-semibold">{formatBRL(simCoverage)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!isPercentage && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm">
                <span className="text-muted-foreground">Mensalidade: </span>
                <span className="font-semibold text-primary">
                  {formatBRL(product.min_price)} – {formatBRL(product.max_price)}
                </span>
              </p>
              {product.max_coverage && (
                <p className="text-sm mt-1">
                  <span className="text-muted-foreground">Cobertura máxima: </span>
                  <span className="font-semibold">{formatBRL(product.max_coverage)}</span>
                </p>
              )}
            </div>
          )}

          <Button className="w-full" type="button" onClick={() => { onContract(product); onClose(); }}>
            Contratar este seguro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Zap, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface AdvanceSimulatorModalProps {
  open: boolean;
  onClose: () => void;
  totalEligible: number;
  eligibleCount: number;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const ADVANCE_RATE = 0.04; // 4% fee
const MAX_PERCENTAGE = 0.80; // 80% max

export const AdvanceSimulatorModal: React.FC<AdvanceSimulatorModalProps> = ({
  open, onClose, totalEligible, eligibleCount
}) => {
  const maxAdvance = totalEligible * MAX_PERCENTAGE;
  const [percentage, setPercentage] = useState(80);

  const simulation = useMemo(() => {
    const requested = totalEligible * (percentage / 100);
    const fee = requested * ADVANCE_RATE;
    const net = requested - fee;
    return { requested, fee, net };
  }, [totalEligible, percentage]);

  const handleConfirm = () => {
    toast.info('Antecipação — funcionalidade em desenvolvimento');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2"><TrendingUp className="h-5 w-5 text-primary" /></div>
            <div>
              <DialogTitle className="text-base">Simular Antecipação</DialogTitle>
              <DialogDescription className="text-xs">Escolha quanto antecipar dos seus recebíveis</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Source */}
          <div className="rounded-lg bg-muted/50 border border-border/40 p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Fretes a receber</span>
              <span className="font-semibold">{formatBRL(totalEligible)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Recebíveis elegíveis</span>
              <Badge variant="outline" className="text-[10px]">{eligibleCount} fretes</Badge>
            </div>
          </div>

          {/* Percentage slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Percentual a antecipar</Label>
              <span className="text-sm font-bold text-primary">{percentage}%</span>
            </div>
            <Slider
              min={10}
              max={80}
              step={5}
              value={[percentage]}
              onValueChange={v => setPercentage(v[0])}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>10%</span>
              <span>Máximo: 80%</span>
            </div>
          </div>

          <Separator />

          {/* Results */}
          <div className="rounded-lg bg-primary/[0.06] border border-primary/20 p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor antecipado</span>
              <span className="font-semibold">{formatBRL(simulation.requested)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxa ({(ADVANCE_RATE * 100).toFixed(0)}%)</span>
              <span className="font-medium text-warning">- {formatBRL(simulation.fee)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base">
              <span className="font-medium">Valor liberado agora</span>
              <span className="font-bold text-primary">{formatBRL(simulation.net)}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/60 shrink-0" />
            <p>Taxa e percentual máximo podem variar. Valor é creditado na carteira após aprovação.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleConfirm}>
            <Zap className="h-3.5 w-3.5" /> Receber Agora <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

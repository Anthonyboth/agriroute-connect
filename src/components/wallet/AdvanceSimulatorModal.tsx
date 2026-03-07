import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Zap, TrendingUp, AlertTriangle, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { RiskConfirmationFlow } from './RiskConfirmationFlow';

interface AdvanceSimulatorModalProps {
  open: boolean;
  onClose: () => void;
  totalEligible: number;
  eligibleCount: number;
  walletId?: string;
  onSuccess?: () => void;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const ADVANCE_RATE = 0.04; // 4% fee
const MAX_PERCENTAGE = 0.80; // 80% max

export const AdvanceSimulatorModal: React.FC<AdvanceSimulatorModalProps> = ({
  open, onClose, totalEligible, eligibleCount, walletId, onSuccess
}) => {
  const [percentage, setPercentage] = useState(80);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'simulate' | 'confirm' | 'risk' | 'done'>('simulate');
  const [riskFlowOpen, setRiskFlowOpen] = useState(false);

  const simulation = useMemo(() => {
    const requested = totalEligible * (percentage / 100);
    const fee = requested * ADVANCE_RATE;
    const net = requested - fee;
    return { requested, fee, net };
  }, [totalEligible, percentage]);

  const executeAdvance = async () => {
    if (!walletId) {
      toast.error('Carteira não encontrada');
      return;
    }
    if (totalEligible <= 0) {
      toast.error('Nenhum recebível elegível para antecipação');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.from('receivable_advances').insert({
        wallet_id: walletId,
        total_requested: simulation.requested,
        fee_amount: simulation.fee,
        net_amount: simulation.net,
        status: 'pending' as const,
      });

      if (error) throw error;

      setStep('done');
      toast.success(`Antecipação de ${formatBRL(simulation.net)} solicitada!`);
      onSuccess?.();
    } catch (err: any) {
      console.error('Advance error:', err);
      toast.error(err.message || 'Erro ao solicitar antecipação');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    setRiskFlowOpen(true);
  };

  const handleRiskConfirmed = async () => {
    setRiskFlowOpen(false);
    await executeAdvance();
  };

  const handleClose = () => {
    setStep('simulate');
    onClose();
  };

  return (
    <>
    <Dialog open={open && !riskFlowOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2"><TrendingUp className="h-5 w-5 text-primary" /></div>
            <div>
              <DialogTitle className="text-base">Antecipar Recebíveis</DialogTitle>
              <DialogDescription className="text-xs">Escolha o percentual e confirme a antecipação</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === 'done' ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <p className="font-semibold text-sm mb-1">Antecipação solicitada!</p>
            <p className="text-xs text-muted-foreground max-w-[280px] mb-2">
              Valor líquido: {formatBRL(simulation.net)} (taxa: {formatBRL(simulation.fee)})
            </p>
            <p className="text-[11px] text-muted-foreground">A antecipação será analisada e o valor creditado na carteira após aprovação.</p>
            <Button size="sm" className="mt-6" onClick={handleClose}>Fechar</Button>
          </div>
        ) : totalEligible <= 0 ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 border border-border/40 p-4 text-center space-y-3">
              <TrendingUp className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <p className="text-sm font-medium">Nenhum recebível elegível</p>
              <p className="text-xs text-muted-foreground max-w-[280px] mx-auto">
                Complete fretes e aguarde a confirmação de entrega para ter recebíveis disponíveis para antecipação.
              </p>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border/40">
              <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-[11px] text-muted-foreground space-y-0.5">
                <p>• Fretes confirmados e sem disputas</p>
                <p>• Entrega validada pelo embarcador</p>
                <p>• Janela de contestação encerrada</p>
                <p>• Antecipação de até 80% do valor</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={handleClose}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Source */}
            <div className="rounded-lg bg-muted/50 border border-border/40 p-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total a receber</span>
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
                <span className="font-medium">Valor liberado</span>
                <span className="font-bold text-primary">{formatBRL(simulation.net)}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/60 shrink-0" />
              <p>Ao confirmar, a antecipação será analisada. O valor líquido é creditado na carteira após aprovação.</p>
            </div>

            {/* Security badge */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
              <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
              <p className="text-[10px] text-muted-foreground">
                Antecipações são protegidas por análise de risco em tempo real.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={handleClose} disabled={loading}>Cancelar</Button>
              {step === 'simulate' ? (
                <Button size="sm" className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setStep('confirm')}>
                  <TrendingUp className="h-3.5 w-3.5" /> Revisar e Confirmar <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleConfirm} disabled={loading}>
                  {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processando...</> : <><Zap className="h-3.5 w-3.5" /> Confirmar Antecipação</>}
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Risk confirmation flow */}
    <RiskConfirmationFlow
      open={riskFlowOpen}
      onClose={() => setRiskFlowOpen(false)}
      operationType="advance"
      amount={simulation.requested}
      operationLabel="Antecipação de Recebíveis"
      operationPayload={{ requested: simulation.requested, fee: simulation.fee, net: simulation.net }}
      onConfirmed={handleRiskConfirmed}
    />
  </>
  );
};

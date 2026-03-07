import React, { useState, useCallback, useEffect } from 'react';
import { FinancialPinModal } from './FinancialPinModal';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ShieldAlert, ShieldCheck, ShieldOff, AlertTriangle, Clock, Info, Lock, CheckCircle2,
} from 'lucide-react';
import { useFinancialRisk, type RiskAssessment, type OperationType, type RiskCheckResult } from '@/hooks/useFinancialRisk';
import { toast } from 'sonner';

interface RiskConfirmationFlowProps {
  open: boolean;
  onClose: () => void;
  operationType: OperationType;
  amount: number;
  operationLabel: string;
  operationPayload?: Record<string, any>;
  onConfirmed: () => void | Promise<void>;
}

const RISK_CONFIG: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  low: { icon: ShieldCheck, color: 'text-primary', bgColor: 'bg-primary/10', label: 'Risco Baixo' },
  medium: { icon: ShieldAlert, color: 'text-warning', bgColor: 'bg-warning/10', label: 'Risco Médio' },
  high: { icon: ShieldOff, color: 'text-destructive', bgColor: 'bg-destructive/10', label: 'Risco Alto' },
  blocked: { icon: AlertTriangle, color: 'text-destructive', bgColor: 'bg-destructive/10', label: 'Operação Bloqueada' },
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const RiskConfirmationFlow: React.FC<RiskConfirmationFlowProps> = ({
  open, onClose, operationType, amount, operationLabel, operationPayload, onConfirmed,
}) => {
  const { assessRisk, logRiskResult, createBlockedOperation, verifyPin, createPin, loading: riskLoading } = useFinancialRisk();
  const [step, setStep] = useState<'assessing' | 'result' | 'pin_verify' | 'pin_create' | 'blocked' | 'done'>('assessing');
  const [riskResult, setRiskResult] = useState<RiskCheckResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  const runAssessment = useCallback(async () => {
    setStep('assessing');
    const result = await assessRisk(operationType, amount);
    setRiskResult(result);

    if (!result) { setStep('result'); return; }

    const { assessment, hasPin } = result;

    if (assessment.confirmation_required === 'blocked') {
      setStep('blocked');
      await createBlockedOperation(operationType, amount, operationPayload || {}, assessment);
      await logRiskResult(operationType, amount, assessment, 'pending_review');
    } else if (assessment.confirmation_required === 'pin' || assessment.confirmation_required === 'pin_plus_review') {
      setStep(hasPin ? 'pin_verify' : 'pin_create');
    } else {
      // Low risk — auto-approve
      setStep('result');
    }
  }, [operationType, amount, assessRisk, createBlockedOperation, logRiskResult, operationPayload]);

  useEffect(() => {
    if (open) runAssessment();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePinVerified = async (pin: string): Promise<boolean> => {
    const ok = await verifyPin(pin);
    if (ok && riskResult) {
      await logRiskResult(operationType, amount, riskResult.assessment, 'approved');
      setStep('done');
      try {
        setConfirming(true);
        await onConfirmed();
      } finally {
        setConfirming(false);
        onClose();
      }
    }
    return ok;
  };

  const handlePinCreated = async (pin: string): Promise<boolean> => {
    const ok = await createPin(pin);
    if (ok) {
      toast.success('PIN financeiro criado com sucesso!');
      // After creating, go to verify
      setStep('pin_verify');
    }
    return ok;
  };

  const handleLowRiskConfirm = async () => {
    if (!riskResult) return;
    await logRiskResult(operationType, amount, riskResult.assessment, 'approved');
    try {
      setConfirming(true);
      await onConfirmed();
    } finally {
      setConfirming(false);
      onClose();
    }
  };

  const assessment = riskResult?.assessment;
  const riskCfg = assessment ? RISK_CONFIG[assessment.level] : RISK_CONFIG.low;
  const RiskIcon = riskCfg.icon;

  // PIN modals
  if (step === 'pin_verify') {
    return (
      <FinancialPinModal
        open={open}
        onClose={onClose}
        onVerify={handlePinVerified}
        mode="verify"
        title={`Confirmar ${operationLabel}`}
        description={`Operação de ${formatBRL(amount)} detectou risco ${assessment?.level === 'high' ? 'alto' : 'médio'}. Digite seu PIN.`}
      />
    );
  }

  if (step === 'pin_create') {
    return (
      <FinancialPinModal
        open={open}
        onClose={onClose}
        onVerify={async () => false}
        onCreate={handlePinCreated}
        mode="create"
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        {step === 'assessing' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-muted-foreground animate-pulse" />
                Analisando segurança...
              </DialogTitle>
              <DialogDescription className="text-xs">Verificando nível de risco da operação</DialogDescription>
            </DialogHeader>
            <div className="py-8 flex flex-col items-center gap-3">
              <Progress value={65} className="w-48 h-1.5" />
              <p className="text-xs text-muted-foreground">Calculando risk score...</p>
            </div>
          </>
        )}

        {step === 'result' && assessment && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RiskIcon className={`h-5 w-5 ${riskCfg.color}`} />
                Confirmação de Operação
              </DialogTitle>
              <DialogDescription className="text-xs">{operationLabel} — {formatBRL(amount)}</DialogDescription>
            </DialogHeader>

            <div className="py-3 space-y-3">
              {/* Risk badge */}
              <div className={`flex items-center justify-between p-3 rounded-lg ${riskCfg.bgColor} border border-border/40`}>
                <div className="flex items-center gap-2">
                  <RiskIcon className={`h-4 w-4 ${riskCfg.color}`} />
                  <span className="text-sm font-medium">{riskCfg.label}</span>
                </div>
                <Badge variant="outline" className="text-xs">{assessment.score}/100</Badge>
              </div>

              {/* Factors */}
              {assessment.factors.length > 0 && (
                <div className="space-y-1.5">
                  {assessment.factors.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs p-2 rounded bg-muted/40">
                      <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{f.detail}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Cooldowns */}
              {riskResult?.activeCooldowns && riskResult.activeCooldowns.length > 0 && (
                <Alert className="border-warning/50 bg-warning/5">
                  <Clock className="h-3.5 w-3.5 text-warning" />
                  <AlertDescription className="text-xs">
                    {riskResult.activeCooldowns.length} restrição(ões) de segurança ativa(s). Operações sensíveis podem ser limitadas.
                  </AlertDescription>
                </Alert>
              )}

              {assessment.level === 'low' && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/15">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-xs text-muted-foreground">Nenhum risco detectado. Confirme para prosseguir.</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleLowRiskConfirm} disabled={confirming} className="gap-1.5">
                {confirming ? 'Processando...' : 'Confirmar Operação'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'blocked' && assessment && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <ShieldOff className="h-5 w-5" />
                Operação Bloqueada
              </DialogTitle>
              <DialogDescription className="text-xs">
                Esta operação foi automaticamente bloqueada por segurança.
              </DialogDescription>
            </DialogHeader>

            <div className="py-3 space-y-3">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Detectamos atividade incomum e bloqueamos temporariamente esta ação.
                  A operação de <strong>{formatBRL(amount)}</strong> foi enviada para revisão.
                </AlertDescription>
              </Alert>

              {assessment.factors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Motivos:</p>
                  {assessment.factors.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs p-2 rounded bg-destructive/5">
                      <AlertTriangle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{f.detail}</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                Nossa equipe revisará esta operação em até 24h. Você será notificado do resultado.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={onClose}>Entendi</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

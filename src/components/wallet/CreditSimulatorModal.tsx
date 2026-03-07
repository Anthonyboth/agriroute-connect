import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Calculator, ArrowRight, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CreditSimulatorModalProps {
  open: boolean;
  onClose: () => void;
  creditLimit: number;
  creditAccountId?: string;
  onSuccess?: () => void;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const MONTHLY_RATE = 0.029; // 2.9% a.m.

const PURPOSES = [
  { value: 'fuel', label: 'Combustível' },
  { value: 'toll', label: 'Pedágio' },
  { value: 'freight', label: 'Pagamento de frete' },
  { value: 'service', label: 'Serviço na plataforma' },
  { value: 'equipment', label: 'Equipamento' },
  { value: 'operational', label: 'Custo operacional' },
  { value: 'other', label: 'Outro' },
];

export const CreditSimulatorModal: React.FC<CreditSimulatorModalProps> = ({
  open, onClose, creditLimit, creditAccountId, onSuccess
}) => {
  const { profile } = useAuth();
  const [amount, setAmount] = useState(Math.min(1000, creditLimit));
  const [installments, setInstallments] = useState(3);
  const [purpose, setPurpose] = useState('fuel');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'simulate' | 'confirm' | 'done'>('simulate');

  const simulation = useMemo(() => {
    const totalRate = Math.pow(1 + MONTHLY_RATE, installments);
    const totalWithFee = amount * totalRate;
    const fee = totalWithFee - amount;
    const installmentValue = totalWithFee / installments;
    const firstDue = new Date();
    firstDue.setDate(firstDue.getDate() + 30);
    return { totalWithFee, fee, installmentValue, monthlyRate: MONTHLY_RATE * 100, firstDue };
  }, [amount, installments]);

  const handleConfirm = async () => {
    if (!creditAccountId || !profile?.id) {
      toast.error('Conta de crédito não encontrada. Solicite crédito primeiro.');
      return;
    }

    try {
      setLoading(true);

      const purposeLabel = PURPOSES.find(p => p.value === purpose)?.label || purpose;

      const { error } = await supabase.from('credit_transactions').insert({
        credit_account_id: creditAccountId,
        amount,
        transaction_type: 'use' as const,
        installments,
        description: `Uso de crédito: ${purposeLabel} — ${installments}x de ${formatBRL(simulation.installmentValue)}`,
      });

      if (error) throw error;

      setStep('done');
      toast.success(`Crédito de ${formatBRL(amount)} utilizado em ${installments}x`);
      onSuccess?.();
    } catch (err: any) {
      console.error('Credit use error:', err);
      toast.error(err.message || 'Erro ao utilizar crédito');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCredit = async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);

      // Check if user already has a wallet
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (!wallet) {
        toast.error('Carteira não encontrada. Acesse a aba Carteira primeiro.');
        return;
      }

      // Create credit account with pending_approval status
      const { error } = await supabase.from('credit_accounts').insert({
        profile_id: profile.id,
        wallet_id: wallet.id,
        credit_limit: 0,
        used_amount: 0,
        status: 'pending_approval' as const,
      });

      if (error) {
        if (error.code === '23505') {
          toast.info('Você já possui uma solicitação de crédito. Aguarde a análise.');
        } else {
          throw error;
        }
      } else {
        toast.success('Solicitação de crédito enviada! Aguarde a aprovação pelo administrador.');
      }

      onSuccess?.();
      handleClose();
    } catch (err: any) {
      console.error('Request credit error:', err);
      toast.error(err.message || 'Erro ao solicitar crédito');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('simulate');
    onClose();
  };

  const hasCredit = !!creditAccountId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-accent/10 p-2"><Calculator className="h-5 w-5 text-accent" /></div>
            <div>
              <DialogTitle className="text-base">{hasCredit ? 'Simular e Usar Crédito' : 'Solicitar Crédito'}</DialogTitle>
              <DialogDescription className="text-xs">
                {hasCredit ? 'Configure valor, parcelas e confirme' : 'Solicite sua linha de crédito de transporte'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === 'done' ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <p className="font-semibold text-sm mb-1">Crédito utilizado com sucesso!</p>
            <p className="text-xs text-muted-foreground max-w-[280px] mb-2">
              {formatBRL(amount)} em {installments}x de {formatBRL(simulation.installmentValue)}
            </p>
            <p className="text-[11px] text-muted-foreground">O valor será debitado do seu limite disponível e as parcelas aparecerão em Parcelas e Cobranças.</p>
            <Button size="sm" className="mt-6" onClick={handleClose}>Fechar</Button>
          </div>
        ) : !hasCredit ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 border border-border/40 p-4 text-center space-y-3">
              <CreditCard className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <p className="text-sm font-medium">Você ainda não possui crédito ativo</p>
              <p className="text-xs text-muted-foreground max-w-[280px] mx-auto">
                Solicite sua linha de crédito e, após aprovação pelo administrador, você poderá simular e utilizar o crédito para suas operações.
              </p>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border/40">
              <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-[11px] text-muted-foreground space-y-0.5">
                <p>• Cadastro aprovado e documentação válida</p>
                <p>• Mínimo de 3 operações completadas</p>
                <p>• Conta ativa há mais de 30 dias</p>
                <p>• Análise do administrador em até 48h</p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
              <Button size="sm" className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleRequestCredit} disabled={loading}>
                {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...</> : <><CreditCard className="h-3.5 w-3.5" /> Solicitar Crédito</>}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Purpose */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Finalidade</Label>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PURPOSES.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Valor do crédito</Label>
                <Badge variant="outline" className="text-[10px]">Disponível: {formatBRL(creditLimit)}</Badge>
              </div>
              <div className="text-center">
                <span className="text-3xl font-bold text-primary">{formatBRL(amount)}</span>
              </div>
              <Slider
                min={100}
                max={Math.max(creditLimit, 100)}
                step={50}
                value={[amount]}
                onValueChange={v => setAmount(v[0])}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{formatBRL(100)}</span>
                <span>{formatBRL(creditLimit)}</span>
              </div>
            </div>

            {/* Installments */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Parcelas</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 6, 12].map(n => (
                  <Button
                    key={n}
                    size="sm"
                    variant={installments === n ? 'default' : 'outline'}
                    className="text-xs flex-1 h-9"
                    onClick={() => setInstallments(n)}
                  >
                    {n}x
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Results */}
            <div className="rounded-lg bg-primary/[0.06] border border-primary/20 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor solicitado</span>
                <span className="font-semibold">{formatBRL(amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Parcelas</span>
                <span className="font-semibold">{installments}x de {formatBRL(simulation.installmentValue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxa ({simulation.monthlyRate.toFixed(1)}% a.m.)</span>
                <span className="font-medium text-warning">{formatBRL(simulation.fee)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">1ª parcela estimada</span>
                <span className="text-xs">{simulation.firstDue.toLocaleDateString('pt-BR')}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base">
                <span className="font-medium">Total com taxa</span>
                <span className="font-bold text-primary">{formatBRL(simulation.totalWithFee)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Limite após uso</span>
                <span className="font-medium">{formatBRL(creditLimit - amount)}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/60 shrink-0" />
              <p>Ao confirmar, o valor será debitado do limite disponível e as parcelas criadas automaticamente.</p>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={handleClose} disabled={loading}>Cancelar</Button>
              {step === 'simulate' ? (
                <Button size="sm" className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setStep('confirm')} disabled={amount <= 0 || amount > creditLimit}>
                  <Calculator className="h-3.5 w-3.5" /> Revisar e Confirmar <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleConfirm} disabled={loading}>
                  {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processando...</> : <><CreditCard className="h-3.5 w-3.5" /> Confirmar Uso de Crédito</>}
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

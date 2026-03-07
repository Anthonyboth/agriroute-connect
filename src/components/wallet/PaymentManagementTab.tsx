import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  CreditCard, TrendingUp, ShieldAlert, Banknote, Receipt,
  Clock, CheckCircle2, AlertTriangle, XCircle, Info,
  ArrowDownCircle, ArrowUpCircle, Percent, FileText,
  CircleDollarSign, History, Zap, HelpCircle,
  BarChart3, CalendarClock, Shield, Users, Truck, Wrench, Fuel
} from 'lucide-react';
import { useCredit } from '@/hooks/useCredit';
import { useTrustScore, type TrustScoreData, type TrustFactor } from '@/hooks/useTrustScore';
import { useReceivableAdvance } from '@/hooks/useReceivableAdvance';
import { useDisputes } from '@/hooks/useDisputes';
import { useWallet, type WalletTransaction } from '@/hooks/useWallet';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { OpenDisputeModal } from './OpenDisputeModal';
import { PayInstallmentModal } from './PayInstallmentModal';
import { CreditSimulatorModal } from './CreditSimulatorModal';
import { AdvanceSimulatorModal } from './AdvanceSimulatorModal';

interface PaymentManagementTabProps {
  role: string;
  isAffiliated?: boolean;
  affiliatedCompanyId?: string;
  walletId?: string;
  legacyContent?: React.ReactNode;
}

type RoleKey = 'PRODUTOR' | 'MOTORISTA' | 'MOTORISTA_AFILIADO' | 'TRANSPORTADORA' | 'PRESTADOR';

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

/* ─── Role Config ─── */

interface RoleConfig {
  key: RoleKey;
  label: string;
  creditLabel: string;
  creditDescription: string;
  creditUseCases: string[];
  creditPrimaryAction: { label: string; icon: React.ReactNode };
  hasAdvances: boolean;
  advanceLabel?: string;
  showAutoDiscount: boolean;
  autoDiscountDescription?: string;
  eligibilityRules: string[];
  advanceEligibilityRules?: string[];
}

const getRoleConfig = (role: string, isAffiliated: boolean): RoleConfig => {
  if (role === 'PRODUTOR') {
    return {
      key: 'PRODUTOR', label: 'Embarcador',
      creditLabel: 'Crédito de Transporte',
      creditDescription: 'Use crédito para contratar fretes e serviços com pagamento parcelado',
      creditUseCases: ['Contratar fretes', 'Contratar serviços', 'Pagamento parcelado'],
      creditPrimaryAction: { label: 'Contratar com Crédito', icon: <Truck className="h-3.5 w-3.5" /> },
      hasAdvances: false, showAutoDiscount: false,
      eligibilityRules: [
        'Cadastro aprovado e verificado',
        'Mínimo de 3 fretes pagos sem disputas',
        'Conta ativa há mais de 30 dias',
        'Sem parcelas vencidas em aberto',
      ],
    };
  }
  if (role === 'MOTORISTA' && isAffiliated) {
    return {
      key: 'MOTORISTA_AFILIADO', label: 'Motorista Afiliado',
      creditLabel: 'Crédito Pessoal',
      creditDescription: 'Seu crédito é pessoal e independente da transportadora',
      creditUseCases: ['Combustível', 'Pedágio', 'Custos operacionais'],
      creditPrimaryAction: { label: 'Usar Crédito', icon: <Fuel className="h-3.5 w-3.5" /> },
      hasAdvances: true,
      advanceLabel: 'Antecipe apenas recebíveis pessoais. Fretes da transportadora não podem ser usados como garantia.',
      showAutoDiscount: true,
      autoDiscountDescription: 'Ao receber repasse da transportadora, parcelas de crédito são descontadas automaticamente do valor antes da liberação.',
      eligibilityRules: [
        'Afiliação ativa com transportadora',
        'Mínimo de 5 fretes completados',
        'Sem parcelas vencidas',
        'Documentação em dia',
      ],
      advanceEligibilityRules: [
        'Fretes pessoais confirmados (não da transportadora)',
        'Sem disputas abertas nos fretes',
        'Sem bloqueios de risco ativos',
        'Máximo de 80% do valor elegível',
      ],
    };
  }
  if (role === 'MOTORISTA') {
    return {
      key: 'MOTORISTA', label: 'Motorista',
      creditLabel: 'Crédito de Transporte',
      creditDescription: 'Use crédito para combustível, pedágio e custos operacionais',
      creditUseCases: ['Combustível', 'Pedágio', 'Serviços', 'Custos operacionais'],
      creditPrimaryAction: { label: 'Usar Crédito', icon: <Fuel className="h-3.5 w-3.5" /> },
      hasAdvances: true, showAutoDiscount: true,
      autoDiscountDescription: 'Parcelas vencidas são descontadas automaticamente dos repasses recebidos.',
      eligibilityRules: [
        'Cadastro aprovado e documentação válida',
        'Mínimo de 5 fretes completados',
        'Score de confiabilidade acima de 70%',
        'Sem parcelas vencidas em aberto',
      ],
      advanceEligibilityRules: [
        'Fretes confirmados e sem disputas',
        'Entrega validada pelo embarcador',
        'Janela de contestação encerrada',
        'Máximo de 80% do valor elegível',
      ],
    };
  }
  if (role === 'TRANSPORTADORA') {
    return {
      key: 'TRANSPORTADORA', label: 'Transportadora',
      creditLabel: 'Crédito Empresarial',
      creditDescription: 'Linha de crédito corporativa para operações de frete e fluxo de caixa',
      creditUseCases: ['Pagar fretes', 'Pagar serviços', 'Fluxo de caixa'],
      creditPrimaryAction: { label: 'Usar Crédito', icon: <CreditCard className="h-3.5 w-3.5" /> },
      hasAdvances: true, showAutoDiscount: false,
      eligibilityRules: [
        'CNPJ ativo e regularizado',
        'Mínimo de 10 fretes operados',
        'Histórico financeiro positivo',
        'Documentação fiscal em dia',
      ],
      advanceEligibilityRules: [
        'Fretes da empresa confirmados',
        'Sem disputas abertas',
        'Sem bloqueios administrativos',
        'Máximo de 80% do valor elegível',
      ],
    };
  }
  // PRESTADOR
  return {
    key: 'PRESTADOR', label: 'Prestador de Serviços',
    creditLabel: 'Crédito de Transporte',
    creditDescription: 'Use crédito para equipamentos e despesas operacionais',
    creditUseCases: ['Equipamentos', 'Despesas operacionais', 'Serviços na plataforma'],
    creditPrimaryAction: { label: 'Usar Crédito', icon: <Wrench className="h-3.5 w-3.5" /> },
    hasAdvances: true, showAutoDiscount: false,
    advanceLabel: 'Antecipe recebíveis de serviços confirmados.',
    eligibilityRules: [
      'Cadastro aprovado e verificado',
      'Mínimo de 3 serviços completados',
      'Conta ativa há mais de 30 dias',
      'Sem parcelas vencidas',
    ],
    advanceEligibilityRules: [
      'Serviços confirmados pelo contratante',
      'Sem disputas abertas',
      'Janela de contestação encerrada',
      'Máximo de 80% do valor elegível',
    ],
  };
};

/* ─── Shared UI ─── */

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    active: { label: 'Ativo', variant: 'default' },
    pending_approval: { label: 'Em Análise', variant: 'secondary' },
    blocked: { label: 'Bloqueado', variant: 'destructive' },
    suspended: { label: 'Suspenso', variant: 'destructive' },
  };
  const c = config[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={c.variant} className="gap-1 text-xs font-medium px-2.5 py-0.5">{c.label}</Badge>;
};

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; description: string; children?: React.ReactNode }> = ({ icon, title, description, children }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center">
    <div className="rounded-full bg-muted/60 p-4 mb-4">{icon}</div>
    <p className="font-semibold text-sm text-foreground mb-1">{title}</p>
    <p className="text-xs text-muted-foreground max-w-[300px] mb-4">{description}</p>
    {children}
  </div>
);

const MetricBox: React.FC<{ label: string; value: string; sub?: string; accent?: boolean; warn?: boolean }> = ({ label, value, sub, accent, warn }) => (
  <div className={`rounded-lg p-3 border ${accent ? 'bg-primary/[0.06] border-primary/20' : 'bg-card border-border/40'}`}>
    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
    <p className={`text-xl font-bold tracking-tight ${accent ? 'text-primary' : warn ? 'text-warning' : 'text-foreground'}`}>{value}</p>
    {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
  </div>
);

const EligibilityCard: React.FC<{ title: string; rules: string[] }> = ({ title, rules }) => (
  <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border/40 text-left w-full">
    <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
    <div className="text-[11px] text-muted-foreground space-y-1">
      <p className="font-medium text-foreground text-xs">{title}</p>
      {rules.map((rule, i) => <p key={i}>• {rule}</p>)}
    </div>
  </div>
);

/* ─── Role Intro Cards ─── */

const IntroCard: React.FC<{
  icon: React.ReactNode; title: string; description: string;
  tips: string[]; warning?: React.ReactNode;
  actions: { label: string; icon: React.ReactNode; onClick: () => void }[];
  accentGradient?: string;
}> = ({ icon, title, description, tips, warning, actions, accentGradient }) => (
  <Card className="shadow-sm border-border/50 overflow-hidden">
    <CardHeader className={`pb-2 bg-gradient-to-r ${accentGradient || 'from-primary/[0.06] to-transparent'}`}>
      <div className="flex items-center gap-2.5">
        {icon}
        <div>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </div>
      </div>
    </CardHeader>
    <CardContent className="pt-4">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border/40 mb-4">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-[11px] text-muted-foreground space-y-0.5">
          {tips.map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
      {warning && <div className="mb-4">{warning}</div>}
      <div className="flex flex-wrap gap-2">
        {actions.map(a => (
          <Button key={a.label} size="sm" variant="outline" className="text-xs gap-1.5" onClick={a.onClick}>
            {a.icon} {a.label}
          </Button>
        ))}
      </div>
    </CardContent>
  </Card>
);

/* ─── Credit Section ─── */

const TrustScoreCard: React.FC<{ trustScore: TrustScoreData; compact?: boolean }> = ({ trustScore, compact }) => {
  const scoreColor = trustScore.score >= 70 ? 'text-primary' : trustScore.score >= 50 ? 'text-warning' : 'text-destructive';
  const statusLabels: Record<string, { label: string; color: string }> = {
    not_eligible: { label: 'Não elegível', color: 'text-muted-foreground' },
    eligible: { label: 'Elegível para crédito', color: 'text-primary' },
    requested: { label: 'Crédito solicitado', color: 'text-warning' },
    approved: { label: 'Crédito aprovado', color: 'text-primary' },
    blocked: { label: 'Crédito bloqueado', color: 'text-destructive' },
  };
  const st = statusLabels[trustScore.status] || statusLabels.not_eligible;
  const categoryLabels: Record<string, string> = { operational: 'Operacional', financial: 'Financeiro', behavioral: 'Comportamento' };

  return (
    <div className="rounded-lg border border-primary/15 bg-primary/[0.03] p-3 space-y-3">
      {/* Score header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-foreground">Score de Confiabilidade</p>
          <p className={`text-2xl font-bold ${scoreColor}`}>{trustScore.score}%</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Limite estimado</p>
          <p className="text-sm font-bold text-foreground">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(trustScore.estimatedLimit)}</p>
          <p className={`text-[10px] font-medium ${st.color}`}>{st.label}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <Progress value={trustScore.score} className="h-2.5" />
        <div className="flex justify-between text-[9px] text-muted-foreground">
          <span>0</span><span>50</span><span>70</span><span>85</span><span>100</span>
        </div>
      </div>

      {!compact && (
        <>
          {/* Factor breakdown */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Indicadores</p>
            {trustScore.factors.map(f => (
              <div key={f.id} className="flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground w-24 truncate">{f.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${f.value >= 70 ? 'bg-primary' : f.value >= 40 ? 'bg-warning' : 'bg-destructive'}`}
                    style={{ width: `${f.value}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground w-16 text-right truncate">{f.detail}</span>
              </div>
            ))}
          </div>

          {/* Tips */}
          {trustScore.tips.length > 0 && trustScore.score < 85 && (
            <div className="rounded-md bg-muted/50 p-2 space-y-1">
              <p className="text-[10px] font-medium text-foreground">Para aumentar seu limite:</p>
              {trustScore.tips.map((tip, i) => (
                <p key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                  <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                  {tip}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const CreditSection: React.FC<{
  creditAccount: any; creditLoading: boolean;
  installments: any[]; pendingInstallments: any[];
  totalPending: number; config: RoleConfig;
  onSimulateCredit: () => void;
  onPayInstallment: () => void;
  onShowRules: () => void;
  trustScore: TrustScoreData | null;
  trustScoreLoading: boolean;
}> = ({ creditAccount, creditLoading, installments, pendingInstallments, totalPending, config, onSimulateCredit, onPayInstallment, onShowRules, trustScore, trustScoreLoading }) => {
  const creditUsagePercent = creditAccount ? Math.round((creditAccount.used_amount / (creditAccount.credit_limit || 1)) * 100) : 0;
  const paidInstallments = installments.filter(i => i.status === 'paid');
  const overdueInstallments = pendingInstallments.filter(i => i.status === 'overdue');
  const nextInstallment = pendingInstallments[0] || null;

  return (
    <Card className="shadow-sm border-primary/20 overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-primary/[0.08] to-primary/[0.02]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/15 p-2"><CreditCard className="h-5 w-5 text-primary" /></div>
            <div>
              <CardTitle className="text-base font-semibold">{config.creditLabel}</CardTitle>
              <CardDescription className="text-xs">{config.creditDescription}</CardDescription>
            </div>
          </div>
          {creditAccount && <StatusBadge status={creditAccount.status} />}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {creditLoading ? (
          <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : creditAccount ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <MetricBox label="Limite Total" value={formatBRL(creditAccount.credit_limit)} />
              <MetricBox label="Utilizado" value={formatBRL(creditAccount.used_amount)} warn sub={`${creditUsagePercent}% usado`} />
              <MetricBox label="Disponível" value={formatBRL(creditAccount.available_limit)} accent />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Utilização do limite</span>
                <span className={creditUsagePercent > 80 ? 'text-warning font-medium' : ''}>{creditUsagePercent}%</span>
              </div>
              <Progress value={creditUsagePercent} className="h-2" />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {config.creditUseCases.map(uc => (
                <Badge key={uc} variant="outline" className="text-[10px] font-normal border-primary/20 text-primary">{uc}</Badge>
              ))}
            </div>

            {nextInstallment && (
              <div className={`flex items-center justify-between p-3 rounded-lg border ${nextInstallment.status === 'overdue' ? 'border-destructive/40 bg-destructive/[0.04]' : 'border-border/60 bg-muted/30'}`}>
                <div className="flex items-center gap-2">
                  <CalendarClock className={`h-4 w-4 ${nextInstallment.status === 'overdue' ? 'text-destructive' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-xs font-medium">{nextInstallment.status === 'overdue' ? 'Parcela vencida' : 'Próxima parcela'}</p>
                    <p className="text-[11px] text-muted-foreground">{format(new Date(nextInstallment.due_date), 'dd/MM/yyyy', { locale: ptBR })}</p>
                  </div>
                </div>
                <span className="text-sm font-bold">{formatBRL(nextInstallment.amount - nextInstallment.paid_amount)}</span>
              </div>
            )}

            {creditAccount.status === 'blocked' && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/[0.06] border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">Crédito bloqueado. Entre em contato com o suporte para verificar o motivo.</p>
              </div>
            )}

            {config.key === 'MOTORISTA_AFILIADO' && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/[0.08] border border-accent/20">
                <Shield className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground">Este crédito é exclusivamente pessoal. Fretes da transportadora não são elegíveis como garantia.</p>
              </div>
            )}

            {/* Trust Score (compact) in active credit */}
            {trustScore && !trustScoreLoading && (
              <TrustScoreCard trustScore={trustScore} compact />
            )}

            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-primary" /> {paidInstallments.length} pagas</span>
              {overdueInstallments.length > 0 && <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" /> {overdueInstallments.length} vencidas</span>}
            </div>

            <Separator />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="text-xs gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90" onClick={onSimulateCredit}>
                {config.creditPrimaryAction.icon} {config.creditPrimaryAction.label}
              </Button>
              <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={onSimulateCredit}>
                <BarChart3 className="h-3.5 w-3.5" /> Simular Crédito
              </Button>
              {pendingInstallments.length > 0 && (
                <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={onPayInstallment}>
                  <CircleDollarSign className="h-3.5 w-3.5" /> Pagar Parcela
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={onShowRules}>
                <HelpCircle className="h-3.5 w-3.5" /> Regras
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<CreditCard className="h-8 w-8 text-muted-foreground/50" />}
            title="Crédito não solicitado"
            description={`Solicite sua linha de crédito para operações como ${config.label}. Comece simulando os valores e parcelas.`}
          >
            <div className="space-y-3 w-full max-w-sm">
              {/* Trust Score (full) in empty credit */}
              {trustScore && !trustScoreLoading ? (
                <TrustScoreCard trustScore={trustScore} />
              ) : trustScoreLoading ? (
                <Skeleton className="h-32 w-full rounded-lg" />
              ) : null}

              {/* Pre-approved estimate */}
              {trustScore && trustScore.status === 'eligible' && trustScore.estimatedLimit > 0 && (
                <div className="rounded-lg bg-primary/[0.06] border border-primary/20 p-3 text-center space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Crédito estimado disponível</p>
                  <p className="text-xl font-bold text-primary">{formatBRL(trustScore.estimatedLimit)}</p>
                  <p className="text-[10px] text-muted-foreground">Solicite para liberar agora</p>
                </div>
              )}

              <div className="flex gap-2 justify-center">
                <Button size="sm" className="text-xs gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90" onClick={onSimulateCredit}>
                  <CreditCard className="h-3.5 w-3.5" /> Solicitar Crédito
                </Button>
                <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={onSimulateCredit}>
                  <BarChart3 className="h-3.5 w-3.5" /> Simular
                </Button>
              </div>
              <EligibilityCard title="Critérios de elegibilidade" rules={config.eligibilityRules} />
            </div>
          </EmptyState>
        )}
      </CardContent>
    </Card>
  );
};

/* ─── Advance Section ─── */

const AdvanceSection: React.FC<{
  receivables: any[]; eligibleReceivables: any[];
  totalEligible: number; advances: any[];
  advanceLoading: boolean; config: RoleConfig;
  onSimulateAdvance: () => void;
}> = ({ receivables, eligibleReceivables, totalEligible, advances, advanceLoading, config, onSimulateAdvance }) => {
  const totalReceivable = receivables.reduce((s, r) => s + r.total_amount, 0);
  const activeAdvances = advances.filter(a => a.status === 'disbursed');

  return (
    <Card className="shadow-sm border-border/50 overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-primary/[0.06] to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-primary/10 p-2"><TrendingUp className="h-5 w-5 text-primary" /></div>
          <div>
            <CardTitle className="text-base font-semibold">Antecipação de Recebíveis</CardTitle>
            <CardDescription className="text-xs">
              {config.key === 'TRANSPORTADORA' ? 'Antecipe recebíveis dos fretes da empresa' :
               config.key === 'PRESTADOR' ? 'Antecipe recebíveis de serviços confirmados' :
               'Receba antecipado seus fretes confirmados'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {advanceLoading ? (
          <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : totalReceivable > 0 || advances.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MetricBox label="Total a Receber" value={formatBRL(totalReceivable)} sub={`${receivables.length} ${config.key === 'PRESTADOR' ? 'serviços' : 'fretes'}`} />
              <MetricBox label="Elegível p/ Antecipação" value={formatBRL(totalEligible)} accent sub={`${eligibleReceivables.length} elegíveis`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MetricBox label="Disponível (até 80%)" value={formatBRL(totalEligible * 0.8)} sub="Percentual máximo" />
              <MetricBox label="Antecipações Ativas" value={String(activeAdvances.length)} sub={activeAdvances.length > 0 ? formatBRL(activeAdvances.reduce((s, a) => s + a.net_amount, 0)) : 'Nenhuma ativa'} />
            </div>

            {config.advanceLabel && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/[0.08] border border-warning/20">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground">{config.advanceLabel}</p>
              </div>
            )}

            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border/40">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground"><strong>Critérios:</strong> {config.key === 'PRESTADOR' ? 'Serviços confirmados' : 'Fretes confirmados'}, sem disputas e sem bloqueios. Somente o dono financeiro pode antecipar.</p>
            </div>

            {advances.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recentes</p>
                {advances.slice(0, 4).map((adv) => (
                  <div key={adv.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-card text-sm">
                    <div>
                      <span className="font-semibold">{formatBRL(adv.net_amount)}</span>
                      <span className="text-[11px] text-muted-foreground ml-2">Taxa: {formatBRL(adv.fee_amount)}</span>
                    </div>
                    <Badge variant={adv.status === 'disbursed' ? 'default' : adv.status === 'pending' ? 'secondary' : 'outline'} className="text-xs">
                      {adv.status === 'pending' ? 'Pendente' : adv.status === 'approved' ? 'Aprovada' : adv.status === 'disbursed' ? 'Liberada' : adv.status === 'settled' ? 'Quitada' : 'Rejeitada'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            <Separator />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="text-xs gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90" disabled={totalEligible <= 0} onClick={onSimulateAdvance}>
                <Zap className="h-3.5 w-3.5" /> Antecipar Agora
              </Button>
              <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={onSimulateAdvance}>
                <BarChart3 className="h-3.5 w-3.5" /> Simular
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<Banknote className="h-8 w-8 text-muted-foreground/50" />}
            title="Nenhum recebível disponível"
            description={`Complete ${config.key === 'PRESTADOR' ? 'serviços' : 'fretes'} confirmados para ter recebíveis elegíveis para antecipação.`}
          >
            <div className="space-y-3 w-full max-w-sm">
              {/* Eligibility progress */}
              <div className="rounded-lg bg-primary/[0.04] border border-primary/15 p-3 space-y-2">
                <p className="text-xs font-medium text-foreground">Progresso para elegibilidade</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 rounded-md bg-muted/50">
                    <p className="text-lg font-bold text-primary">{receivables.length}</p>
                    <p className="text-[10px] text-muted-foreground">{config.key === 'PRESTADOR' ? 'Serviços concluídos' : 'Fretes concluídos'}</p>
                  </div>
                  <div className="text-center p-2 rounded-md bg-muted/50">
                    <p className="text-lg font-bold text-foreground">{config.key === 'PRODUTOR' ? 3 : 5}</p>
                    <p className="text-[10px] text-muted-foreground">Necessários</p>
                  </div>
                </div>
                <Progress value={Math.min((receivables.length / (config.key === 'PRODUTOR' ? 3 : 5)) * 100, 100)} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground text-center">
                  {receivables.length >= (config.key === 'PRODUTOR' ? 3 : 5) 
                    ? 'Critério de fretes atingido! Aguarde confirmação de entrega.'
                    : `Faltam ${Math.max((config.key === 'PRODUTOR' ? 3 : 5) - receivables.length, 0)} ${config.key === 'PRESTADOR' ? 'serviços' : 'fretes'} para elegibilidade`}
                </p>
              </div>
              <EligibilityCard
                title="Como funciona a antecipação?"
                rules={config.advanceEligibilityRules || [
                  `Complete ${config.key === 'PRESTADOR' ? 'serviços' : 'fretes'} e aguarde confirmação`,
                  'O valor entra como recebível elegível',
                  'Solicite antecipação de até 80%',
                  'Receba na carteira com taxa reduzida',
                ]}
              />
              {config.key === 'MOTORISTA_AFILIADO' && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/[0.08] border border-warning/20">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                  <p className="text-[10px] text-muted-foreground">
                    <strong>Motorista afiliado:</strong> Apenas fretes pessoais são elegíveis. Fretes da transportadora pertencem à empresa e não podem ser antecipados por você.
                  </p>
                </div>
              )}
            </div>
          </EmptyState>
        )}
      </CardContent>
    </Card>
  );
};

/* ─── Installments Section ─── */

const InstallmentsSection: React.FC<{
  creditLoading: boolean; installments: any[];
  pendingInstallments: any[]; totalPending: number;
  config: RoleConfig; onPayInstallment: () => void;
}> = ({ creditLoading, installments, pendingInstallments, totalPending, config, onPayInstallment }) => {
  const paidInstallments = installments.filter(i => i.status === 'paid');

  return (
    <Card className="shadow-sm border-border/50 overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-warning/[0.06] to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-warning/10 p-2"><Receipt className="h-5 w-5 text-warning" /></div>
            <div>
              <CardTitle className="text-base font-semibold">Parcelas e Cobranças</CardTitle>
              <CardDescription className="text-xs">
                {config.showAutoDiscount ? 'Parcelas do crédito e descontos automáticos nos repasses' :
                 config.key === 'PRODUTOR' ? 'Faturas e parcelas de crédito de transporte' :
                 'Parcelas do crédito de transporte'}
              </CardDescription>
            </div>
          </div>
          {pendingInstallments.length > 0 && <Badge variant="secondary" className="text-xs">{pendingInstallments.length} pendentes</Badge>}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {creditLoading ? <Skeleton className="h-24 w-full" /> : pendingInstallments.length > 0 || paidInstallments.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <MetricBox label="Em Aberto" value={formatBRL(totalPending)} warn={totalPending > 0} />
              <MetricBox label="Pagas" value={String(paidInstallments.length)} />
              <MetricBox label="Pendentes" value={String(pendingInstallments.length)} />
            </div>

            {config.showAutoDiscount && pendingInstallments.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/[0.08] border border-warning/20">
                <Percent className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div className="text-[11px] text-muted-foreground">
                  <p className="font-medium text-foreground text-xs">Desconto automático ativo</p>
                  <p>{config.autoDiscountDescription || 'Parcelas vencidas são descontadas automaticamente dos repasses recebidos.'}</p>
                  {config.key === 'MOTORISTA_AFILIADO' && (
                    <div className="mt-2 space-y-0.5 text-[10px]">
                      <p className="text-foreground font-medium">Exemplo de repasse:</p>
                      <p>Repasse bruto: R$ 2.000,00</p>
                      <p>(-) Parcela crédito: R$ 350,00</p>
                      <p className="text-primary font-semibold">= Líquido liberado: R$ 1.650,00</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {pendingInstallments.map((inst) => (
                <div key={inst.id} className={`flex items-center justify-between p-2.5 rounded-lg border text-sm ${inst.status === 'overdue' ? 'border-destructive/30 bg-destructive/[0.03]' : 'border-border/50 bg-card'}`}>
                  <div className="flex items-center gap-2">
                    <CalendarClock className={`h-3.5 w-3.5 ${inst.status === 'overdue' ? 'text-destructive' : 'text-muted-foreground'}`} />
                    <div>
                      <span className="font-medium text-xs">Parcela {inst.installment_number}</span>
                      <p className="text-[11px] text-muted-foreground">{format(new Date(inst.due_date), 'dd MMM yyyy', { locale: ptBR })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={inst.status === 'overdue' ? 'destructive' : 'secondary'} className="text-[10px]">{inst.status === 'overdue' ? 'Vencida' : 'Pendente'}</Badge>
                    <span className="font-bold text-sm">{formatBRL(inst.amount - inst.paid_amount)}</span>
                  </div>
                </div>
              ))}
            </div>

            <Separator />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="text-xs gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90" onClick={onPayInstallment}>
                <CircleDollarSign className="h-3.5 w-3.5" /> Pagar Agora
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState icon={<Receipt className="h-8 w-8 text-muted-foreground/50" />} title="Nenhuma parcela ativa" description="Utilize crédito de transporte para gerar parcelas.">
            <div className="w-full max-w-sm">
              <div className="rounded-lg bg-muted/40 border border-border/40 p-3 space-y-2">
                <p className="text-xs font-medium text-foreground">Exemplo de parcelas</p>
                <div className="space-y-1.5 text-[11px] text-muted-foreground">
                  <div className="flex justify-between"><span>Crédito de R$ 500,00</span><span className="font-medium text-foreground">3x de R$ 175,23</span></div>
                  <div className="flex justify-between"><span>Crédito de R$ 1.000,00</span><span className="font-medium text-foreground">6x de R$ 179,60</span></div>
                  <div className="flex justify-between"><span>Crédito de R$ 2.000,00</span><span className="font-medium text-foreground">12x de R$ 192,89</span></div>
                </div>
                <p className="text-[10px] text-muted-foreground text-center pt-1">Taxa: 2,9% a.m. • Simulações ilustrativas</p>
              </div>
            </div>
          </EmptyState>
        )}
      </CardContent>
    </Card>
  );
};

/* ─── Disputes Section ─── */

const DisputesSection: React.FC<{
  disputes: any[]; openCount: number; disputeLoading: boolean;
  onOpenDispute: () => void;
}> = ({ disputes, openCount, disputeLoading, onOpenDispute }) => {
  const resolvedDisputes = disputes.filter(d => d.status === 'resolved');
  const reviewingDisputes = disputes.filter(d => d.status === 'under_review');

  return (
    <Card className="shadow-sm border-border/50 overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-destructive/[0.04] to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-destructive/10 p-2"><ShieldAlert className="h-5 w-5 text-destructive" /></div>
            <div>
              <CardTitle className="text-base font-semibold">Disputas Financeiras</CardTitle>
              <CardDescription className="text-xs">Contestações e mediações de valores</CardDescription>
            </div>
          </div>
          {openCount > 0 && <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" /> {openCount}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {disputeLoading ? <Skeleton className="h-20 w-full" /> : disputes.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <MetricBox label="Abertas" value={String(disputes.filter(d => d.status === 'open').length)} warn={disputes.filter(d => d.status === 'open').length > 0} />
              <MetricBox label="Em Análise" value={String(reviewingDisputes.length)} />
              <MetricBox label="Resolvidas" value={String(resolvedDisputes.length)} />
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {disputes.slice(0, 6).map((d) => (
                <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-card text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium text-xs">{d.dispute_type}</span>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{d.reason || 'Sem descrição'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={d.status === 'open' ? 'destructive' : d.status === 'under_review' ? 'secondary' : 'outline'} className="text-[10px]">
                      {d.status === 'open' ? 'Aberta' : d.status === 'under_review' ? 'Em Análise' : d.status === 'resolved' ? 'Resolvida' : 'Rejeitada'}
                    </Badge>
                    <span className="font-bold text-xs">{formatBRL(d.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={onOpenDispute}>
                <ShieldAlert className="h-3.5 w-3.5" /> Abrir Nova Disputa
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<ShieldAlert className="h-8 w-8 text-muted-foreground/50" />}
            title="Nenhuma disputa"
            description="Conteste cobranças indevidas, pagamentos incorretos ou valores divergentes abrindo uma disputa financeira."
          >
            <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={onOpenDispute}>
              <ShieldAlert className="h-3.5 w-3.5" /> Abrir Disputa
            </Button>
          </EmptyState>
        )}
      </CardContent>
    </Card>
  );
};

/* ─── History Section ─── */

const HistorySection: React.FC<{
  installments: any[]; advances: any[]; config: RoleConfig;
  walletTransactions?: WalletTransaction[];
}> = ({ installments, advances, config, walletTransactions = [] }) => {
  const [historyFilter, setHistoryFilter] = useState('all');

  const filterTabs = [
    { value: 'all', label: 'Todos' },
    { value: 'credit', label: 'Crédito' },
    ...(config.hasAdvances ? [{ value: 'advance', label: 'Antecipações' }] : []),
    { value: 'transfer', label: 'Repasses' },
    { value: 'wallet', label: 'Carteira' },
    { value: 'fees', label: 'Taxas' },
  ];

  type HistoryItem = { id: string; label: string; value: number; date: string; type: string; status: string; icon: React.ReactNode };
  const items: HistoryItem[] = [];

  if (historyFilter === 'all' || historyFilter === 'credit') {
    installments.filter(i => i.status === 'paid').forEach(i => {
      items.push({ id: `inst-${i.id}`, label: `Parcela ${i.installment_number} paga`, value: -i.amount, date: i.paid_at || i.due_date, type: 'Crédito', status: 'Pago', icon: <ArrowUpCircle className="h-3.5 w-3.5 text-primary" /> });
    });
  }
  if ((historyFilter === 'all' || historyFilter === 'advance') && config.hasAdvances) {
    advances.filter(a => a.status === 'disbursed' || a.status === 'settled').forEach(a => {
      items.push({ id: `adv-${a.id}`, label: 'Antecipação recebida', value: a.net_amount, date: a.created_at, type: 'Antecipação', status: a.status === 'settled' ? 'Quitada' : 'Ativa', icon: <ArrowDownCircle className="h-3.5 w-3.5 text-primary" /> });
    });
  }

  // Wallet transactions (deposits, withdrawals, escrow, splits, releases)
  const walletTypeMap: Record<string, { label: string; type: string; icon: React.ReactNode }> = {
    deposit: { label: 'Depósito', type: 'Carteira', icon: <ArrowDownCircle className="h-3.5 w-3.5 text-primary" /> },
    withdrawal: { label: 'Saque Pix', type: 'Carteira', icon: <ArrowUpCircle className="h-3.5 w-3.5 text-destructive" /> },
    escrow_reserve: { label: 'Reserva escrow', type: 'Carteira', icon: <Clock className="h-3.5 w-3.5 text-warning" /> },
    freight_liquidation: { label: 'Liquidação de frete', type: 'Repasse', icon: <Truck className="h-3.5 w-3.5 text-primary" /> },
    payout: { label: 'Repasse de frete', type: 'Repasse', icon: <Truck className="h-3.5 w-3.5 text-primary" /> },
    block: { label: 'Bloqueio de fundos', type: 'Carteira', icon: <ShieldAlert className="h-3.5 w-3.5 text-destructive" /> },
    unblock: { label: 'Desbloqueio de fundos', type: 'Carteira', icon: <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> },
    transfer_in: { label: 'Transferência recebida', type: 'Carteira', icon: <ArrowDownCircle className="h-3.5 w-3.5 text-primary" /> },
    transfer_out: { label: 'Transferência enviada', type: 'Carteira', icon: <ArrowUpCircle className="h-3.5 w-3.5 text-destructive" /> },
    fee: { label: 'Taxa da plataforma', type: 'Taxa', icon: <Receipt className="h-3.5 w-3.5 text-destructive" /> },
    refund: { label: 'Reembolso', type: 'Carteira', icon: <ArrowDownCircle className="h-3.5 w-3.5 text-primary" /> },
  };

  const positiveWalletTypes = ['deposit', 'transfer_in', 'refund', 'unblock', 'freight_liquidation'];
  const walletFilterMap: Record<string, string[]> = {
    wallet: ['deposit', 'withdrawal', 'escrow_reserve', 'block', 'unblock', 'transfer_in', 'transfer_out', 'refund'],
    transfer: ['payout', 'freight_liquidation'],
    fees: ['fee'],
  };

  if (historyFilter === 'all' || walletFilterMap[historyFilter]) {
    const allowedTypes = historyFilter === 'all' ? null : walletFilterMap[historyFilter];
    walletTransactions
      .filter(tx => tx.status === 'completed' || tx.status === 'reserved')
      .filter(tx => !allowedTypes || allowedTypes.includes(tx.transaction_type))
      .forEach(tx => {
        const cfg = walletTypeMap[tx.transaction_type];
        if (!cfg) return;
        const isPositive = positiveWalletTypes.includes(tx.transaction_type);
        items.push({
          id: `wtx-${tx.id}`, label: tx.description || cfg.label, value: isPositive ? tx.amount : -tx.amount,
          date: tx.completed_at || tx.created_at, type: cfg.type, status: tx.status === 'completed' ? 'Concluído' : 'Reservado',
          icon: cfg.icon,
        });
      });
  }

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Card className="shadow-sm border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-muted p-2"><History className="h-5 w-5 text-muted-foreground" /></div>
          <div>
            <CardTitle className="text-base font-semibold">Histórico Financeiro</CardTitle>
            <CardDescription className="text-xs">Eventos financeiros completos — crédito, antecipação, carteira e repasses</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        <Tabs defaultValue="all" onValueChange={setHistoryFilter}>
          <TabsList className="w-full h-auto flex flex-wrap gap-1 bg-muted/60 p-1 rounded-lg mb-4">
            {filterTabs.map(t => (
              <TabsTrigger key={t.value} value={t.value} className="flex-1 min-w-[80px] text-xs px-2.5 py-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">{t.label}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={historyFilter}>
            {items.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm font-medium mb-1">Nenhum evento para este filtro</p>
                <p className="text-xs text-muted-foreground max-w-[240px] mx-auto">
                  Realize operações de crédito, antecipação ou pagamento para gerar eventos no histórico financeiro.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                {items.slice(0, 20).map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/40 transition-colors text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      {item.icon}
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{item.label}</p>
                        <div className="flex items-center gap-1.5">
                          <p className="text-[11px] text-muted-foreground">{format(new Date(item.date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                          <Badge variant="outline" className="text-[9px] px-1 py-0">{item.type}</Badge>
                        </div>
                      </div>
                    </div>
                    <span className={`font-bold text-xs ${item.value >= 0 ? 'text-primary' : 'text-foreground'}`}>
                      {item.value >= 0 ? '+' : ''}{formatBRL(Math.abs(item.value))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

/* ─── MAIN COMPONENT ─── */

export const PaymentManagementTab: React.FC<PaymentManagementTabProps> = ({
  role, isAffiliated = false, affiliatedCompanyId, walletId, legacyContent
}) => {
  const { creditAccount, installments, pendingInstallments, totalPending, loading: creditLoading, refetch: refetchCredit } = useCredit();
  const { receivables, eligibleReceivables, totalEligible, advances, loading: advanceLoading, refetch: refetchAdvance } = useReceivableAdvance();
  const { disputes, openCount, loading: disputeLoading, openDispute } = useDisputes();
  const { wallet, transactions: walletTransactions } = useWallet();
  const { trustScore, trustScoreLoading } = useTrustScore();

  const config = getRoleConfig(role, isAffiliated);

  // Modal states
  const [creditSimOpen, setCreditSimOpen] = useState(false);
  const [advanceSimOpen, setAdvanceSimOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [payInstallmentOpen, setPayInstallmentOpen] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const handleOpenDispute = async (disputeType: string, amount: number, reason: string, freightId?: string) => {
    if (!walletId) {
      toast.error('Carteira não encontrada');
      return;
    }
    await openDispute(walletId, disputeType, amount, reason, freightId);
  };

  const handleShowRules = () => {
    setShowRules(!showRules);
    toast.info(
      config.eligibilityRules.map((r, i) => `${i + 1}. ${r}`).join('\n'),
      { duration: 8000, description: `Regras de ${config.creditLabel}` }
    );
  };

  // Build intro card based on role
  const introCardProps = (() => {
    switch (config.key) {
      case 'PRODUTOR':
        return {
          icon: <div className="rounded-lg bg-primary/10 p-2"><Truck className="h-5 w-5 text-primary" /></div>,
          title: 'Pagamentos de Frete',
          description: 'Gerencie pagamentos dos seus fretes como embarcador',
          tips: [
            'Ao criar fretes, os valores são reservados da sua carteira.',
            'Após confirmação de entrega, o valor é liberado ao motorista/transportadora.',
            'Você pode usar crédito de transporte para pagamento parcelado.',
          ],
        };
      case 'TRANSPORTADORA':
        return {
          icon: <div className="rounded-lg bg-primary/10 p-2"><Users className="h-5 w-5 text-primary" /></div>,
          title: 'Gestão Financeira Empresarial',
          description: 'Controle financeiro completo da transportadora',
          tips: [
            'Fretes pagos entram como reserva e são liberados após entrega.',
            'Parcelas de crédito do motorista são descontadas automaticamente no repasse.',
            'Você controla antecipações e saques da empresa.',
          ],
        };
      case 'MOTORISTA_AFILIADO':
        return {
          icon: <div className="rounded-lg bg-accent/10 p-2"><Users className="h-5 w-5 text-accent" /></div>,
          title: 'Finanças Pessoais',
          description: 'Crédito e recebíveis pessoais, independentes da transportadora',
          tips: [
            'Seu crédito é pessoal — a transportadora não tem acesso.',
            'Ao receber repasses, parcelas de crédito são descontadas automaticamente.',
          ],
          warning: (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/[0.08] border border-warning/20">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <div className="text-[11px] text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground text-xs">Regras do motorista afiliado</p>
                <p>Fretes da transportadora <strong>não</strong> podem ser usados como garantia de crédito.</p>
                <p>Você <strong>não</strong> controla valores ou antecipações da empresa.</p>
              </div>
            </div>
          ),
          accentGradient: 'from-accent/[0.08] to-transparent',
        };
      case 'PRESTADOR':
        return {
          icon: <div className="rounded-lg bg-primary/10 p-2"><Wrench className="h-5 w-5 text-primary" /></div>,
          title: 'Finanças de Serviços',
          description: 'Gerencie pagamentos por serviços prestados',
          tips: [
            'Receba por serviços prestados diretamente na carteira.',
            'Use crédito para equipamentos e despesas operacionais.',
            'Antecipe recebíveis de serviços confirmados.',
          ],
        };
      default: // MOTORISTA
        return {
          icon: <div className="rounded-lg bg-primary/10 p-2"><Truck className="h-5 w-5 text-primary" /></div>,
          title: 'Gestão de Recebíveis',
          description: 'Receba fretes, antecipe valores e use crédito',
          tips: [
            'Fretes confirmados geram recebíveis elegíveis para antecipação.',
            'Parcelas de crédito são descontadas automaticamente dos recebimentos.',
            'Você controla seus próprios fretes e antecipações.',
          ],
        };
    }
  })();

  return (
    <div className="space-y-5">
      {/* Role intro */}
      <IntroCard
        {...introCardProps}
        actions={[
          ...(config.key === 'PRODUTOR' ? [
            { label: 'Fretes Pendentes', icon: <FileText className="h-3.5 w-3.5" />, onClick: () => toast.info('Acesse a aba Meus Fretes para ver fretes pendentes') },
          ] : []),
          ...(config.key === 'TRANSPORTADORA' ? [
            { label: 'Repasses Pendentes', icon: <ArrowUpCircle className="h-3.5 w-3.5" />, onClick: () => toast.info('Repasses pendentes aparecem na seção de Payment Orders na aba Carteira') },
          ] : []),
          ...(config.key === 'MOTORISTA_AFILIADO' ? [
            { label: 'Repasses Recebidos', icon: <ArrowDownCircle className="h-3.5 w-3.5" />, onClick: () => toast.info('Seus repasses aparecem no extrato da aba Carteira AgriRoute') },
            { label: 'Descontos', icon: <Percent className="h-3.5 w-3.5" />, onClick: () => toast.info('Descontos automáticos são aplicados ao receber repasses e exibidos no extrato') },
          ] : []),
        ]}
      />

      {/* Credit */}
      <CreditSection
        creditAccount={creditAccount}
        creditLoading={creditLoading}
        installments={installments}
        pendingInstallments={pendingInstallments}
        totalPending={totalPending}
        config={config}
        onSimulateCredit={() => setCreditSimOpen(true)}
        onPayInstallment={() => setPayInstallmentOpen(true)}
        onShowRules={handleShowRules}
        trustScore={trustScore}
        trustScoreLoading={trustScoreLoading}
      />

      {/* Advances */}
      {config.hasAdvances && (
        <AdvanceSection
          receivables={receivables}
          eligibleReceivables={eligibleReceivables}
          totalEligible={totalEligible}
          advances={advances}
          advanceLoading={advanceLoading}
          config={config}
          onSimulateAdvance={() => setAdvanceSimOpen(true)}
        />
      )}

      {/* Installments */}
      <InstallmentsSection
        creditLoading={creditLoading}
        installments={installments}
        pendingInstallments={pendingInstallments}
        totalPending={totalPending}
        config={config}
        onPayInstallment={() => setPayInstallmentOpen(true)}
      />

      {/* Disputes */}
      <DisputesSection
        disputes={disputes}
        openCount={openCount}
        disputeLoading={disputeLoading}
        onOpenDispute={() => setDisputeOpen(true)}
      />

      {/* History */}
      <HistorySection installments={installments} advances={advances} config={config} walletTransactions={walletTransactions} />

      {/* Legacy content */}
      {legacyContent && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Separator className="flex-1" />
            <span className="text-[11px] font-medium uppercase tracking-wider shrink-0">Pagamentos Externos</span>
            <Separator className="flex-1" />
          </div>
          <div className="opacity-90">{legacyContent}</div>
        </div>
      )}

      {/* Modals — wired to real DB actions */}
      <CreditSimulatorModal
        open={creditSimOpen}
        onClose={() => setCreditSimOpen(false)}
        creditLimit={creditAccount?.available_limit || 5000}
        creditAccountId={creditAccount?.id}
        onSuccess={() => { refetchCredit(); refetchAdvance(); }}
      />
      {config.hasAdvances && (
        <AdvanceSimulatorModal
          open={advanceSimOpen}
          onClose={() => setAdvanceSimOpen(false)}
          totalEligible={totalEligible}
          eligibleCount={eligibleReceivables.length}
          walletId={wallet?.id}
          onSuccess={() => { refetchAdvance(); }}
        />
      )}
      <OpenDisputeModal
        open={disputeOpen}
        onClose={() => setDisputeOpen(false)}
        onSubmit={handleOpenDispute}
        walletId={walletId || ''}
      />
      <PayInstallmentModal
        open={payInstallmentOpen}
        onClose={() => setPayInstallmentOpen(false)}
        installments={installments}
        availableBalance={wallet?.available_balance || 0}
      />
    </div>
  );
};

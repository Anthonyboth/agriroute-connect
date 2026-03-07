import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  CreditCard, TrendingUp, ShieldAlert, Banknote, Receipt,
  Clock, CheckCircle2, AlertTriangle, XCircle, ChevronRight,
  Info, ArrowDownCircle, ArrowUpCircle, Percent, FileText,
  CircleDollarSign, History, Filter, Zap, HelpCircle,
  BarChart3, CalendarClock, Shield
} from 'lucide-react';
import { useCredit } from '@/hooks/useCredit';
import { useReceivableAdvance } from '@/hooks/useReceivableAdvance';
import { useDisputes } from '@/hooks/useDisputes';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface PaymentManagementTabProps {
  role: string;
  isAffiliated?: boolean;
  affiliatedCompanyId?: string;
  walletId?: string;
  legacyContent?: React.ReactNode;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    active: { label: 'Ativo', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
    pending_approval: { label: 'Em Análise', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
    blocked: { label: 'Bloqueado', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
    suspended: { label: 'Suspenso', variant: 'destructive', icon: <AlertTriangle className="h-3 w-3" /> },
  };
  const c = config[status] || { label: status, variant: 'outline' as const, icon: null };
  return (
    <Badge variant={c.variant} className="gap-1 text-xs font-medium px-2.5 py-0.5">
      {c.icon} {c.label}
    </Badge>
  );
};

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; description: string; children?: React.ReactNode }> = ({ icon, title, description, children }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center">
    <div className="rounded-full bg-muted/60 p-4 mb-4">{icon}</div>
    <p className="font-semibold text-sm text-foreground mb-1">{title}</p>
    <p className="text-xs text-muted-foreground max-w-[280px] mb-4">{description}</p>
    {children}
  </div>
);

const MetricBox: React.FC<{ label: string; value: string; sub?: string; accent?: boolean; warn?: boolean }> = ({ label, value, sub, accent, warn }) => (
  <div className="rounded-lg bg-muted/40 p-3 border border-border/40">
    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
    <p className={`text-xl font-bold tracking-tight ${accent ? 'text-primary' : warn ? 'text-orange-500 dark:text-orange-400' : 'text-foreground'}`}>{value}</p>
    {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
  </div>
);

export const PaymentManagementTab: React.FC<PaymentManagementTabProps> = ({
  role, isAffiliated, affiliatedCompanyId, walletId, legacyContent
}) => {
  const { creditAccount, installments, pendingInstallments, totalPending, loading: creditLoading } = useCredit();
  const { receivables, eligibleReceivables, totalEligible, advances, loading: advanceLoading } = useReceivableAdvance();
  const { disputes, openCount, loading: disputeLoading, openDispute } = useDisputes();
  const [historyFilter, setHistoryFilter] = useState('all');

  const showAdvances = !(isAffiliated && role === 'MOTORISTA');
  const creditUsagePercent = creditAccount ? Math.round((creditAccount.used_amount / (creditAccount.credit_limit || 1)) * 100) : 0;
  const nextInstallment = pendingInstallments.length > 0 ? pendingInstallments[0] : null;
  const paidInstallments = installments.filter(i => i.status === 'paid');
  const overdueInstallments = pendingInstallments.filter(i => i.status === 'overdue');
  const activeAdvances = advances.filter(a => a.status === 'disbursed');
  const totalReceivable = receivables.reduce((s, r) => s + r.total_amount, 0);

  const resolvedDisputes = disputes.filter(d => d.status === 'resolved');
  const reviewingDisputes = disputes.filter(d => d.status === 'under_review');

  const handleNotImplemented = (action: string) => {
    toast.info(`${action} — funcionalidade em desenvolvimento`);
  };

  return (
    <div className="space-y-5">
      {/* ─── 1. CRÉDITO DE TRANSPORTE ─── */}
      <Card className="shadow-sm border-border/50 overflow-hidden">
        <CardHeader className="pb-2 bg-gradient-to-r from-primary/[0.04] to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-primary/10 p-2">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Crédito de Transporte</CardTitle>
                <CardDescription className="text-xs">Linha de crédito para operações de frete</CardDescription>
              </div>
            </div>
            {creditAccount && <StatusBadge status={creditAccount.status} />}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {creditLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : creditAccount ? (
            <div className="space-y-4">
              {/* Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <MetricBox label="Limite Total" value={formatBRL(creditAccount.credit_limit)} />
                <MetricBox label="Utilizado" value={formatBRL(creditAccount.used_amount)} warn sub={`${creditUsagePercent}% usado`} />
                <MetricBox label="Disponível" value={formatBRL(creditAccount.available_limit)} accent />
              </div>

              {/* Usage bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Utilização do limite</span>
                  <span className={creditUsagePercent > 80 ? 'text-orange-500 font-medium' : ''}>{creditUsagePercent}%</span>
                </div>
                <Progress value={creditUsagePercent} className="h-2" />
              </div>

              {/* Next installment highlight */}
              {nextInstallment && (
                <div className={`flex items-center justify-between p-3 rounded-lg border ${nextInstallment.status === 'overdue' ? 'border-destructive/40 bg-destructive/[0.04]' : 'border-border/60 bg-muted/30'}`}>
                  <div className="flex items-center gap-2">
                    <CalendarClock className={`h-4 w-4 ${nextInstallment.status === 'overdue' ? 'text-destructive' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="text-xs font-medium">
                        {nextInstallment.status === 'overdue' ? 'Parcela vencida' : 'Próxima parcela'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {nextInstallment.status === 'overdue' ? 'Venceu em' : 'Vence em'} {format(new Date(nextInstallment.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold">{formatBRL(nextInstallment.amount - nextInstallment.paid_amount)}</span>
                </div>
              )}

              {/* Blocked state info */}
              {creditAccount.status === 'blocked' && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/[0.06] border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-destructive">Crédito bloqueado</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Seu crédito foi bloqueado. Entre em contato com o suporte ou aguarde revisão administrativa.
                    </p>
                  </div>
                </div>
              )}

              {creditAccount.status === 'pending_approval' && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/20">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Aguardando aprovação</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Sua solicitação está em análise. Você será notificado quando houver uma decisão.
                    </p>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {paidInstallments.length} parcelas pagas</span>
                {overdueInstallments.length > 0 && (
                  <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" /> {overdueInstallments.length} vencidas</span>
                )}
              </div>

              <Separator />

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => handleNotImplemented('Simular crédito')}>
                  <BarChart3 className="h-3.5 w-3.5" /> Simular
                </Button>
                <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => handleNotImplemented('Histórico de crédito')}>
                  <History className="h-3.5 w-3.5" /> Histórico
                </Button>
                <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={() => handleNotImplemented('Regras de crédito')}>
                  <HelpCircle className="h-3.5 w-3.5" /> Entender Regras
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<CreditCard className="h-8 w-8 text-muted-foreground/50" />}
              title="Crédito não solicitado"
              description="Solicite sua linha de crédito para pagar fretes com condições especiais, parcelas e desconto automático nos repasses."
            >
              <div className="flex gap-2">
                <Button size="sm" className="text-xs gap-1.5" onClick={() => handleNotImplemented('Solicitar crédito')}>
                  <CreditCard className="h-3.5 w-3.5" /> Solicitar Crédito
                </Button>
                <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => handleNotImplemented('Simular crédito')}>
                  <BarChart3 className="h-3.5 w-3.5" /> Simular
                </Button>
              </div>
            </EmptyState>
          )}
        </CardContent>
      </Card>

      {/* ─── 2. ANTECIPAÇÃO DE RECEBÍVEIS ─── */}
      {showAdvances && (
        <Card className="shadow-sm border-border/50 overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-emerald-500/[0.04] to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Antecipação de Recebíveis</CardTitle>
                <CardDescription className="text-xs">Receba antecipado seus fretes confirmados</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {advanceLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : totalReceivable > 0 || advances.length > 0 ? (
              <div className="space-y-4">
                {/* Key metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <MetricBox
                    label="Total a Receber"
                    value={formatBRL(totalReceivable)}
                    sub={`${receivables.length} fretes`}
                  />
                  <MetricBox
                    label="Elegível p/ Antecipação"
                    value={formatBRL(totalEligible)}
                    accent
                    sub={`${eligibleReceivables.length} fretes`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MetricBox
                    label="Disponível (até 80%)"
                    value={formatBRL(totalEligible * 0.8)}
                    sub="Percentual máximo liberado"
                  />
                  <MetricBox
                    label="Antecipações Ativas"
                    value={String(activeAdvances.length)}
                    sub={activeAdvances.length > 0 ? formatBRL(activeAdvances.reduce((s, a) => s + a.net_amount, 0)) : 'Nenhuma ativa'}
                  />
                </div>

                {/* Eligibility info */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border/40">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    <p><strong>Critérios:</strong> Fretes confirmados, sem disputas, sem bloqueios ativos.</p>
                    <p>O valor antecipado é descontado automaticamente ao receber o frete.</p>
                  </div>
                </div>

                {/* Active advances list */}
                {advances.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Antecipações Recentes</p>
                    {advances.slice(0, 4).map((adv) => (
                      <div key={adv.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/20 text-sm">
                        <div>
                          <span className="font-semibold text-sm">{formatBRL(adv.net_amount)}</span>
                          <span className="text-[11px] text-muted-foreground ml-2">
                            Taxa: {formatBRL(adv.fee_amount)}
                          </span>
                        </div>
                        <Badge variant={
                          adv.status === 'disbursed' ? 'default' :
                          adv.status === 'pending' ? 'secondary' :
                          adv.status === 'settled' ? 'outline' : 'destructive'
                        } className="text-xs">
                          {adv.status === 'pending' ? 'Pendente' :
                           adv.status === 'approved' ? 'Aprovada' :
                           adv.status === 'disbursed' ? 'Liberada' :
                           adv.status === 'settled' ? 'Quitada' : 'Rejeitada'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="text-xs gap-1.5" disabled={totalEligible <= 0} onClick={() => handleNotImplemented('Antecipar agora')}>
                    <Zap className="h-3.5 w-3.5" /> Antecipar Agora
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => handleNotImplemented('Simular antecipação')}>
                    <BarChart3 className="h-3.5 w-3.5" /> Simular
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => handleNotImplemented('Ver fretes elegíveis')}>
                    <FileText className="h-3.5 w-3.5" /> Fretes Elegíveis
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={() => handleNotImplemented('Histórico de antecipações')}>
                    <History className="h-3.5 w-3.5" /> Histórico
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<Banknote className="h-8 w-8 text-muted-foreground/50" />}
                title="Nenhum recebível disponível"
                description="Ao completar fretes confirmados e sem disputas, seus recebíveis ficam elegíveis para antecipação."
              >
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border/40 text-left w-full max-w-sm">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-[11px] text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground text-xs">Como funciona?</p>
                    <p>1. Complete fretes e aguarde confirmação</p>
                    <p>2. O valor entra como recebível elegível</p>
                    <p>3. Solicite antecipação de até 80%</p>
                    <p>4. Receba na carteira com taxa reduzida</p>
                  </div>
                </div>
              </EmptyState>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── 3. PARCELAS E DESCONTOS AUTOMÁTICOS ─── */}
      <Card className="shadow-sm border-border/50 overflow-hidden">
        <CardHeader className="pb-2 bg-gradient-to-r from-amber-500/[0.04] to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <Receipt className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Parcelas e Descontos</CardTitle>
                <CardDescription className="text-xs">Parcelas do crédito e descontos automáticos nos repasses</CardDescription>
              </div>
            </div>
            {pendingInstallments.length > 0 && (
              <Badge variant="secondary" className="text-xs">{pendingInstallments.length} pendentes</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {creditLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : pendingInstallments.length > 0 || paidInstallments.length > 0 ? (
            <div className="space-y-4">
              {/* Summary metrics */}
              <div className="grid grid-cols-3 gap-3">
                <MetricBox label="Em Aberto" value={formatBRL(totalPending)} warn={totalPending > 0} />
                <MetricBox label="Parcelas Pagas" value={String(paidInstallments.length)} sub="Total pago" />
                <MetricBox label="Pendentes" value={String(pendingInstallments.length)} />
              </div>

              {/* Auto-discount explanation */}
              {pendingInstallments.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/20">
                  <Percent className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    <p className="font-medium text-foreground text-xs">Desconto automático ativo</p>
                    <p>Ao receber um repasse, as parcelas vencidas serão descontadas automaticamente do valor.</p>
                    <p className="text-[10px] mt-1">
                      Valor bruto do repasse − Desconto do crédito = Valor líquido liberado
                    </p>
                  </div>
                </div>
              )}

              {/* Installments list */}
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {pendingInstallments.map((inst) => (
                  <div key={inst.id} className={`flex items-center justify-between p-2.5 rounded-lg border text-sm ${inst.status === 'overdue' ? 'border-destructive/30 bg-destructive/[0.03]' : 'border-border/50 bg-muted/20'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`rounded-full p-1 ${inst.status === 'overdue' ? 'bg-destructive/10' : 'bg-muted'}`}>
                        <CalendarClock className={`h-3.5 w-3.5 ${inst.status === 'overdue' ? 'text-destructive' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <span className="font-medium text-xs">Parcela {inst.installment_number}</span>
                        <p className="text-[11px] text-muted-foreground">
                          {format(new Date(inst.due_date), 'dd MMM yyyy', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={inst.status === 'overdue' ? 'destructive' : 'secondary'} className="text-[10px]">
                        {inst.status === 'overdue' ? 'Vencida' : 'Pendente'}
                      </Badge>
                      <span className="font-bold text-sm">{formatBRL(inst.amount - inst.paid_amount)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => handleNotImplemented('Pagar parcela')}>
                  <CircleDollarSign className="h-3.5 w-3.5" /> Pagar Agora
                </Button>
                <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={() => handleNotImplemented('Detalhamento de parcelas')}>
                  <FileText className="h-3.5 w-3.5" /> Ver Detalhamento
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Receipt className="h-8 w-8 text-muted-foreground/50" />}
              title="Nenhuma parcela ativa"
              description="Quando você utilizar crédito de transporte, suas parcelas e descontos automáticos aparecerão aqui."
            />
          )}
        </CardContent>
      </Card>

      {/* ─── 4. DISPUTAS FINANCEIRAS ─── */}
      <Card className="shadow-sm border-border/50 overflow-hidden">
        <CardHeader className="pb-2 bg-gradient-to-r from-red-500/[0.04] to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-red-500/10 p-2">
                <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Disputas Financeiras</CardTitle>
                <CardDescription className="text-xs">Contestações e mediações de valores</CardDescription>
              </div>
            </div>
            {openCount > 0 && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertTriangle className="h-3 w-3" /> {openCount} abertas
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {disputeLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : disputes.length > 0 ? (
            <div className="space-y-4">
              {/* Summary row */}
              <div className="grid grid-cols-3 gap-3">
                <MetricBox label="Abertas" value={String(disputes.filter(d => d.status === 'open').length)} warn={disputes.filter(d => d.status === 'open').length > 0} />
                <MetricBox label="Em Análise" value={String(reviewingDisputes.length)} />
                <MetricBox label="Resolvidas" value={String(resolvedDisputes.length)} />
              </div>

              {/* Disputes list */}
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {disputes.slice(0, 6).map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/20 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <span className="font-medium text-xs block">{d.dispute_type}</span>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{d.reason || 'Sem descrição'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={
                        d.status === 'open' ? 'destructive' :
                        d.status === 'under_review' ? 'secondary' :
                        d.status === 'resolved' ? 'outline' : 'secondary'
                      } className="text-[10px]">
                        {d.status === 'open' ? 'Aberta' :
                         d.status === 'under_review' ? 'Em Análise' :
                         d.status === 'resolved' ? 'Resolvida' : 'Rejeitada'}
                      </Badge>
                      <span className="font-bold text-xs">{formatBRL(d.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => handleNotImplemented('Abrir disputa')}>
                  <ShieldAlert className="h-3.5 w-3.5" /> Abrir Disputa
                </Button>
                <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={() => handleNotImplemented('Histórico de disputas')}>
                  <History className="h-3.5 w-3.5" /> Histórico
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<ShieldAlert className="h-8 w-8 text-muted-foreground/50" />}
              title="Nenhuma disputa registrada"
              description="Se houver divergência em valores, fretes ou repasses, você poderá abrir uma disputa aqui."
            >
              <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => handleNotImplemented('Abrir disputa')}>
                <ShieldAlert className="h-3.5 w-3.5" /> Abrir Disputa
              </Button>
            </EmptyState>
          )}
        </CardContent>
      </Card>

      {/* ─── 5. HISTÓRICO FINANCEIRO ─── */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-muted p-2">
              <History className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Histórico Financeiro</CardTitle>
              <CardDescription className="text-xs">Todos os eventos financeiros da sua conta</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-3">
          {/* Filter tabs */}
          <Tabs defaultValue="all" onValueChange={setHistoryFilter}>
            <TabsList className="w-full grid grid-cols-4 h-8 mb-4">
              <TabsTrigger value="all" className="text-[11px] px-2">Todos</TabsTrigger>
              <TabsTrigger value="credit" className="text-[11px] px-2">Crédito</TabsTrigger>
              <TabsTrigger value="advance" className="text-[11px] px-2">Antecipações</TabsTrigger>
              <TabsTrigger value="transfer" className="text-[11px] px-2">Repasses</TabsTrigger>
            </TabsList>

            <TabsContent value={historyFilter}>
              {/* Build unified history from installments, advances, disputes */}
              {(() => {
                type HistoryItem = { id: string; type: string; label: string; value: number; date: string; status: string; icon: React.ReactNode };
                const items: HistoryItem[] = [];

                if (historyFilter === 'all' || historyFilter === 'credit') {
                  installments.filter(i => i.status === 'paid').forEach(i => {
                    items.push({
                      id: `inst-${i.id}`, type: 'credit', label: `Parcela ${i.installment_number} paga`,
                      value: -i.amount, date: i.paid_at || i.due_date, status: 'paid',
                      icon: <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500" />
                    });
                  });
                }
                if (historyFilter === 'all' || historyFilter === 'advance') {
                  advances.filter(a => a.status === 'disbursed' || a.status === 'settled').forEach(a => {
                    items.push({
                      id: `adv-${a.id}`, type: 'advance', label: 'Antecipação recebida',
                      value: a.net_amount, date: a.created_at, status: a.status,
                      icon: <ArrowDownCircle className="h-3.5 w-3.5 text-primary" />
                    });
                  });
                }

                items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                if (items.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <History className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Nenhum evento encontrado para este filtro</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                    {items.slice(0, 20).map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/40 transition-colors text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          {item.icon}
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{item.label}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {format(new Date(item.date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <span className={`font-bold text-xs ${item.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                          {item.value >= 0 ? '+' : ''}{formatBRL(Math.abs(item.value))}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ─── 6. PAGAMENTOS EXTERNOS (secundário) ─── */}
      {legacyContent && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Separator className="flex-1" />
            <span className="text-[11px] font-medium uppercase tracking-wider shrink-0">Pagamentos Externos</span>
            <Separator className="flex-1" />
          </div>
          <div className="opacity-90">
            {legacyContent}
          </div>
        </div>
      )}
    </div>
  );
};

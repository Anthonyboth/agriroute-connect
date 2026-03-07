import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, TrendingUp, AlertTriangle, Receipt, ShieldAlert, Banknote } from 'lucide-react';
import { useCredit } from '@/hooks/useCredit';
import { useReceivableAdvance } from '@/hooks/useReceivableAdvance';
import { useDisputes } from '@/hooks/useDisputes';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PaymentManagementTabProps {
  role: string;
  isAffiliated?: boolean;
  affiliatedCompanyId?: string;
  walletId?: string;
  legacyContent?: React.ReactNode;
}

const formatBRL = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const PaymentManagementTab: React.FC<PaymentManagementTabProps> = ({
  role, isAffiliated, affiliatedCompanyId, walletId, legacyContent
}) => {
  const { creditAccount, installments, pendingInstallments, totalPending, loading: creditLoading } = useCredit();
  const { eligibleReceivables, totalEligible, advances, loading: advanceLoading } = useReceivableAdvance();
  const { disputes, openCount, loading: disputeLoading } = useDisputes();

  // Motorista afiliado não vê antecipação de recebíveis da transportadora
  const showAdvances = !(isAffiliated && role === 'MOTORISTA');

  return (
    <div className="space-y-6">
      {/* Crédito de Transporte */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Crédito de Transporte
          </CardTitle>
        </CardHeader>
        <CardContent>
          {creditLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : creditAccount ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Limite Total</p>
                  <p className="text-lg font-bold">{formatBRL(creditAccount.credit_limit)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Utilizado</p>
                  <p className="text-lg font-bold text-warning">{formatBRL(creditAccount.used_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Disponível</p>
                  <p className="text-lg font-bold text-success">{formatBRL(creditAccount.available_limit)}</p>
                </div>
              </div>

              <Badge variant={creditAccount.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                {creditAccount.status === 'active' ? 'Ativo' : 
                 creditAccount.status === 'pending_approval' ? 'Aguardando Aprovação' :
                 creditAccount.status === 'blocked' ? 'Bloqueado' : 'Suspenso'}
              </Badge>

              {pendingInstallments.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Parcelas Pendentes ({pendingInstallments.length})</p>
                  <p className="text-xs text-muted-foreground mb-3">Total pendente: {formatBRL(totalPending)}</p>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {pendingInstallments.map((inst) => (
                      <div key={inst.id} className="flex items-center justify-between p-2 rounded border border-border/60 text-sm">
                        <div>
                          <span className="font-medium">Parcela {inst.installment_number}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            Vence: {format(new Date(inst.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={inst.status === 'overdue' ? 'destructive' : 'secondary'} className="text-xs">
                            {inst.status === 'overdue' ? 'Vencida' : 'Pendente'}
                          </Badge>
                          <span className="font-semibold">{formatBRL(inst.amount - inst.paid_amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Você ainda não possui crédito de transporte</p>
              <p className="text-xs text-muted-foreground mt-1">O crédito pode ser solicitado ao administrador</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Antecipação de Recebíveis */}
      {showAdvances && (
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Antecipação de Recebíveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {advanceLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Recebíveis Elegíveis</p>
                    <p className="text-lg font-bold text-success">{formatBRL(totalEligible)}</p>
                    <p className="text-xs text-muted-foreground">{eligibleReceivables.length} fretes</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Antecipações Ativas</p>
                    <p className="text-lg font-bold">{advances.filter(a => a.status === 'disbursed').length}</p>
                  </div>
                </div>

                {advances.length > 0 && (
                  <div className="space-y-2">
                    {advances.slice(0, 5).map((adv) => (
                      <div key={adv.id} className="flex items-center justify-between p-2 rounded border border-border/60 text-sm">
                        <div>
                          <span className="font-medium">{formatBRL(adv.net_amount)}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            Taxa: {formatBRL(adv.fee_amount)}
                          </span>
                        </div>
                        <Badge variant={adv.status === 'disbursed' ? 'default' : 'secondary'} className="text-xs">
                          {adv.status === 'pending' ? 'Pendente' :
                           adv.status === 'approved' ? 'Aprovada' :
                           adv.status === 'disbursed' ? 'Liberada' :
                           adv.status === 'settled' ? 'Quitada' : 'Rejeitada'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {eligibleReceivables.length === 0 && advances.length === 0 && (
                  <div className="text-center py-6">
                    <Banknote className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum recebível elegível para antecipação</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Disputas */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-warning" />
            Disputas Financeiras
            {openCount > 0 && (
              <Badge variant="destructive" className="text-xs ml-2">{openCount} abertas</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {disputeLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : disputes.length > 0 ? (
            <div className="space-y-2">
              {disputes.slice(0, 5).map((d) => (
                <div key={d.id} className="flex items-center justify-between p-2 rounded border border-border/60 text-sm">
                  <div>
                    <span className="font-medium">{d.dispute_type}</span>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{d.reason || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={d.status === 'open' ? 'destructive' : d.status === 'resolved' ? 'default' : 'secondary'} className="text-xs">
                      {d.status === 'open' ? 'Aberta' : 
                       d.status === 'under_review' ? 'Em Análise' :
                       d.status === 'resolved' ? 'Resolvida' : 'Rejeitada'}
                    </Badge>
                    <span className="font-semibold">{formatBRL(d.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <ShieldAlert className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma disputa registrada</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legacy payment content (existing ProducerPaymentsTab, DriverPaymentsTab, etc.) */}
      {legacyContent && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Pagamentos Externos
          </h3>
          {legacyContent}
        </div>
      )}
    </div>
  );
};

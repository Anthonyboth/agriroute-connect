import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { useAdminApi } from '@/hooks/useAdminApi';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Menu, BarChart3, TrendingUp, PieChart, Activity, Users, Truck,
  CheckCircle, XCircle, RefreshCw, DollarSign, MapPin,
} from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';

const ROLE_LABELS: Record<string, string> = {
  MOTORISTA: 'Motoristas',
  MOTORISTA_AFILIADO: 'Mot. Afiliados',
  PRODUTOR: 'Produtores',
  PRESTADOR_SERVICOS: 'Prestadores',
  TRANSPORTADORA: 'Transportadoras',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente', APPROVED: 'Aprovado', REJECTED: 'Reprovado', NEEDS_FIX: 'Correção', BLOCKED: 'Bloqueado',
  NEW: 'Novo', OPEN: 'Aberto', ACCEPTED: 'Aceito', IN_TRANSIT: 'Em Trânsito', DELIVERED: 'Entregue',
  COMPLETED: 'Concluído', CANCELLED: 'Cancelado', LOADING: 'Carregando', LOADED: 'Carregado',
};

const AdminReports = () => {
  const { callApi } = useAdminApi();
  const [activeTab, setActiveTab] = useState('registrations');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const fetchReport = async (type: string) => {
    setLoading(true);
    const { data: result } = await callApi<any>(`reports/${type}`);
    if (result) setData(result);
    setLoading(false);
  };

  useEffect(() => { fetchReport(activeTab); }, [activeTab]);

  return (
    <div className="flex-1 bg-muted/30">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center gap-4">
        <SidebarTrigger className="p-2 hover:bg-muted rounded-md"><Menu className="h-5 w-5" /></SidebarTrigger>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Análises e métricas da plataforma (últimos 90 dias)</p>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="registrations" className="gap-2"><Users className="h-4 w-4" /> Cadastros</TabsTrigger>
            <TabsTrigger value="freights" className="gap-2"><Truck className="h-4 w-4" /> Fretes</TabsTrigger>
            <TabsTrigger value="admin-activity" className="gap-2"><Activity className="h-4 w-4" /> Atividade Admin</TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="flex items-center justify-center py-16"><AppSpinner /></div>
          ) : (
            <>
              <TabsContent value="registrations">
                <RegistrationsReport data={data} />
              </TabsContent>
              <TabsContent value="freights">
                <FreightsReport data={data} />
              </TabsContent>
              <TabsContent value="admin-activity">
                <AdminActivityReport data={data} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
};

function RegistrationsReport({ data }: { data: any }) {
  if (!data) return null;
  const byRole = data.by_role || {};
  const byStatus = data.by_status || {};
  const byMonth = data.by_month || {};
  const months = Object.keys(byMonth).sort();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total (90d)" value={data.total || 0} icon={<Users className="h-5 w-5 text-primary" />} />
        <MetricCard label="Aprovados" value={byStatus.APPROVED || 0} icon={<CheckCircle className="h-5 w-5 text-success" />} />
        <MetricCard label="Reprovados" value={byStatus.REJECTED || 0} icon={<XCircle className="h-5 w-5 text-destructive" />} />
        <MetricCard label="Pendentes" value={byStatus.PENDING || 0} icon={<Activity className="h-5 w-5 text-warning" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3"><CardTitle className="text-base">Por Tipo de Usuário</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(byRole).sort(([, a]: any, [, b]: any) => b - a).map(([role, count]: any) => (
                <div key={role} className="flex items-center justify-between">
                  <span className="text-sm">{ROLE_LABELS[role] || role}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-muted rounded-full h-2"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, (count / (data.total || 1)) * 100)}%` }} /></div>
                    <span className="text-sm font-bold w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3"><CardTitle className="text-base">Por Status</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(byStatus).sort(([, a], [, b]) => (b as number) - (a as number)).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm">{STATUS_LABELS[status] || status}</span>
                  <span className="text-sm font-bold">{count as number}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {months.length > 0 && (
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3"><CardTitle className="text-base">Evolução Mensal</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {months.map(month => {
                const monthData = byMonth[month] || {};
                const total = Object.values(monthData).reduce((s: number, v: any) => s + v, 0);
                return (
                  <div key={month} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm font-medium">{month}</span>
                    <div className="flex items-center gap-3">
                      {monthData.APPROVED && <Badge className="bg-success/15 text-success text-xs">{monthData.APPROVED} aprovados</Badge>}
                      {monthData.REJECTED && <Badge className="bg-destructive/15 text-destructive text-xs">{monthData.REJECTED} reprovados</Badge>}
                      {monthData.PENDING && <Badge className="bg-warning/15 text-warning text-xs">{monthData.PENDING} pendentes</Badge>}
                      <span className="text-sm font-bold">{total as number}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FreightsReport({ data }: { data: any }) {
  if (!data) return null;
  const byStatus = data.by_status || {};
  const byState = data.by_state || {};
  const byCargo = data.by_cargo || {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard label="Total (90d)" value={data.total || 0} icon={<Truck className="h-5 w-5 text-primary" />} />
        <MetricCard label="Valor Total" value={`R$ ${((data.total_value || 0) / 1000).toFixed(0)}k`} icon={<DollarSign className="h-5 w-5 text-success" />} />
        <MetricCard label="Ticket Médio" value={`R$ ${(data.avg_value || 0).toLocaleString('pt-BR')}`} icon={<TrendingUp className="h-5 w-5 text-accent" />} />
        <MetricCard label="Taxa Conclusão" value={`${data.completion_rate || 0}%`} icon={<CheckCircle className="h-5 w-5 text-success" />} />
        <MetricCard label="Taxa Cancelamento" value={`${data.cancel_rate || 0}%`} icon={<XCircle className="h-5 w-5 text-destructive" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3"><CardTitle className="text-base">Por Status</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(byStatus).sort(([, a]: any, [, b]: any) => b - a).map(([status, count]: any) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm">{STATUS_LABELS[status] || status}</span>
                  <span className="text-sm font-bold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Por Estado (Origem)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(byState).sort(([, a]: any, [, b]: any) => b - a).slice(0, 10).map(([state, count]: any) => (
                <div key={state} className="flex items-center justify-between">
                  <span className="text-sm">{state}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-muted rounded-full h-2"><div className="h-2 rounded-full bg-accent" style={{ width: `${Math.min(100, (count / (data.total || 1)) * 100)}%` }} /></div>
                    <span className="text-sm font-bold w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
              {Object.keys(byState).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3"><CardTitle className="text-base">Por Tipo de Carga</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(byCargo).sort(([, a]: any, [, b]: any) => b - a).slice(0, 10).map(([cargo, count]: any) => (
                <div key={cargo} className="flex items-center justify-between">
                  <span className="text-sm truncate max-w-[150px]">{cargo}</span>
                  <span className="text-sm font-bold">{count}</span>
                </div>
              ))}
              {Object.keys(byCargo).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminActivityReport({ data }: { data: any }) {
  if (!data) return null;
  const byAdmin = data.by_admin || {};
  const byAction = data.by_action || {};

  const ACTION_LABELS: Record<string, string> = {
    APPROVE: 'Aprovações', REJECT: 'Reprovações', NEEDS_FIX: 'Correções', NOTE: 'Observações', BLOCK: 'Bloqueios', UNBLOCK: 'Desbloqueios',
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total de Ações (90d)" value={data.total || 0} icon={<Activity className="h-5 w-5 text-primary" />} />
        <MetricCard label="Aprovações" value={byAction.APPROVE || 0} icon={<CheckCircle className="h-5 w-5 text-success" />} />
        <MetricCard label="Reprovações" value={byAction.REJECT || 0} icon={<XCircle className="h-5 w-5 text-destructive" />} />
        <MetricCard label="Admins Ativos" value={Object.keys(byAdmin).length} icon={<Users className="h-5 w-5 text-accent" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3"><CardTitle className="text-base">Atividade por Admin</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(byAdmin).sort(([, a]: any, [, b]: any) => b.count - a.count).map(([id, info]: any) => (
                <div key={id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{info.name}</span>
                    <span className="text-sm font-bold">{info.count} ações</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {Object.entries(info.actions).map(([action, count]: any) => (
                      <Badge key={action} variant="outline" className="text-[10px]">{ACTION_LABELS[action] || action}: {count}</Badge>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(byAdmin).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade registrada</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3"><CardTitle className="text-base">Resumo por Tipo de Ação</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(byAction).sort(([, a]: any, [, b]: any) => b - a).map(([action, count]: any) => (
                <div key={action} className="flex items-center justify-between">
                  <span className="text-sm">{ACTION_LABELS[action] || action}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-muted rounded-full h-2"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, (count / (data.total || 1)) * 100)}%` }} /></div>
                    <span className="text-sm font-bold w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Card className="shadow-sm border-border/60">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
          <div className="p-2 rounded-xl bg-muted">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AdminReports;

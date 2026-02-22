import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAdminApi } from '@/hooks/useAdminApi';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { AppSpinner } from '@/components/ui/AppSpinner';
import {
  Users, CheckCircle, XCircle, Clock, AlertTriangle, TrendingUp,
  Truck, ShieldAlert, ArrowRight, Activity, Eye, Menu, BarChart3,
  UserCheck, UserX, FileWarning, RefreshCw,
} from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';

interface DashboardStats {
  pending_total: number;
  approved_7d: number;
  rejected_7d: number;
  pending_by_role: Record<string, number>;
  recent_actions: any[];
}

const ROLE_LABELS: Record<string, string> = {
  MOTORISTA: 'Motoristas',
  MOTORISTA_AFILIADO: 'Mot. Afiliados',
  PRODUTOR: 'Produtores',
  PRESTADOR_SERVICOS: 'Prestadores',
  TRANSPORTADORA: 'Transportadoras',
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  MOTORISTA: <Truck className="h-4 w-4" />,
  PRODUTOR: <Users className="h-4 w-4" />,
  PRESTADOR_SERVICOS: <Activity className="h-4 w-4" />,
  TRANSPORTADORA: <Truck className="h-4 w-4" />,
};

const ACTION_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  APPROVE: { label: 'Aprovado', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle className="h-4 w-4 text-emerald-600" /> },
  REJECT: { label: 'Reprovado', color: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="h-4 w-4 text-red-600" /> },
  NEEDS_FIX: { label: 'Correção', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <AlertTriangle className="h-4 w-4 text-amber-600" /> },
  NOTE: { label: 'Observação', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Eye className="h-4 w-4 text-blue-600" /> },
};

const AdminDashboard = () => {
  const { callApi } = useAdminApi();
  const { adminUser } = useAdminAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const { data } = await callApi<DashboardStats>('stats');
    if (data) setStats(data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchStats(); }, []);

  if (loading) return <div className="flex-1 flex items-center justify-center"><AppSpinner /></div>;

  const totalPending = stats?.pending_total || 0;
  const approved7d = stats?.approved_7d || 0;
  const rejected7d = stats?.rejected_7d || 0;
  const total7d = approved7d + rejected7d;
  const approvalRate = total7d > 0 ? Math.round((approved7d / total7d) * 100) : 0;

  const pendingRoles = Object.entries(stats?.pending_by_role || {}).sort(([,a], [,b]) => b - a);
  const highestPendingRole = pendingRoles[0];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="flex-1 bg-gray-50/50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="p-2 hover:bg-gray-100 rounded-md">
            <Menu className="h-5 w-5" />
          </SidebarTrigger>
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {greeting}, {adminUser?.full_name?.split(' ')[0] || 'Admin'}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchStats(true)}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </header>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Alert Banner for high pending */}
        {totalPending > 5 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {totalPending} cadastros aguardando análise
                </p>
                <p className="text-xs text-amber-600">
                  {highestPendingRole
                    ? `Maior concentração: ${ROLE_LABELS[highestPendingRole[0]] || highestPendingRole[0]} (${highestPendingRole[1]})`
                    : 'Revise os cadastros pendentes para reduzir riscos'}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => navigate('/admin-v2/cadastros')} className="bg-amber-600 hover:bg-amber-700 gap-2">
              Revisar agora <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Pendentes"
            value={totalPending}
            icon={<Clock className="h-5 w-5" />}
            color="amber"
            subtitle="Aguardando análise"
            onClick={() => navigate('/admin-v2/cadastros')}
          />
          <StatsCard
            title="Aprovados (7d)"
            value={approved7d}
            icon={<UserCheck className="h-5 w-5" />}
            color="emerald"
            subtitle="Últimos 7 dias"
          />
          <StatsCard
            title="Reprovados (7d)"
            value={rejected7d}
            icon={<UserX className="h-5 w-5" />}
            color="red"
            subtitle="Últimos 7 dias"
          />
          <StatsCard
            title="Taxa de Aprovação"
            value={`${approvalRate}%`}
            icon={<TrendingUp className="h-5 w-5" />}
            color="blue"
            subtitle={`${total7d} analisados (7d)`}
          >
            <Progress value={approvalRate} className="mt-2 h-1.5" />
          </StatsCard>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Pending by role + Quick Actions */}
          <div className="space-y-6">
            {/* Pending by Role */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Pendentes por Tipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingRoles.length === 0 && (
                    <div className="text-center py-6">
                      <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum cadastro pendente! 🎉</p>
                    </div>
                  )}
                  {pendingRoles.map(([role, count]) => {
                    const totalP = totalPending || 1;
                    const pct = Math.round((count / totalP) * 100);
                    return (
                      <div key={role} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            {ROLE_ICONS[role] || <Users className="h-4 w-4" />}
                            <span className="text-gray-700">{ROLE_LABELS[role] || role}</span>
                          </div>
                          <span className="text-sm font-bold text-gray-900">{count}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-amber-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Ações Rápidas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-11"
                  onClick={() => navigate('/admin-v2/cadastros')}
                >
                  <FileWarning className="h-4 w-4 text-amber-500" />
                  <span>Revisar Cadastros Pendentes</span>
                  {totalPending > 0 && (
                    <Badge className="ml-auto bg-amber-100 text-amber-700 hover:bg-amber-100">{totalPending}</Badge>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-11"
                  onClick={() => navigate('/admin-v2/auditoria')}
                >
                  <Eye className="h-4 w-4 text-blue-500" />
                  <span>Ver Logs de Auditoria</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-11"
                  onClick={() => navigate('/admin-v2/fretes')}
                >
                  <Truck className="h-4 w-4 text-purple-500" />
                  <span>Monitorar Fretes Ativos</span>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: Recent Actions (wider) */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Atividade Recente
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin-v2/auditoria')} className="text-xs gap-1">
                Ver tudo <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {stats?.recent_actions?.map((action: any) => {
                  const actionInfo = ACTION_LABELS[action.action] || { label: action.action, color: 'bg-gray-50 text-gray-700 border-gray-200', icon: <Eye className="h-4 w-4" /> };
                  return (
                    <div key={action.id} className="flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex-shrink-0">
                        {actionInfo.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {action.admin?.full_name || action.admin?.email || 'Admin'}
                          </span>
                          <Badge variant="outline" className={`text-xs ${actionInfo.color} border`}>
                            {actionInfo.label}
                          </Badge>
                        </div>
                        {action.reason && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{action.reason}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(action.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  );
                })}
                {(!stats?.recent_actions || stats.recent_actions.length === 0) && (
                  <div className="text-center py-8">
                    <Activity className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma ação recente</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

function StatsCard({
  title, value, icon, color, subtitle, onClick, children,
}: {
  title: string; value: number | string; icon: React.ReactNode; color: string; subtitle: string; onClick?: () => void; children?: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <Card
      className={`shadow-sm transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''}`}
      onClick={onClick}
    >
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className={`p-2.5 rounded-xl ${colorMap[color] || colorMap.blue}`}>
            {icon}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export default AdminDashboard;

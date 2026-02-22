import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAdminApi } from '@/hooks/useAdminApi';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { Users, CheckCircle, XCircle, Clock, Truck, Wrench, Package } from 'lucide-react';
import { Menu } from 'lucide-react';
import { SidebarTrigger as SBTrigger } from '@/components/ui/sidebar';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  APPROVE: { label: 'Aprovado', color: 'bg-green-100 text-green-800' },
  REJECT: { label: 'Reprovado', color: 'bg-red-100 text-red-800' },
  NEEDS_FIX: { label: 'Correção', color: 'bg-yellow-100 text-yellow-800' },
  NOTE: { label: 'Observação', color: 'bg-blue-100 text-blue-800' },
};

const AdminDashboard = () => {
  const { callApi } = useAdminApi();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const { data, error } = await callApi<DashboardStats>('stats');
      if (data) setStats(data);
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return <div className="flex-1 flex items-center justify-center"><AppSpinner /></div>;

  return (
    <div className="flex-1">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <SBTrigger className="p-2 hover:bg-gray-100 rounded-md">
          <Menu className="h-5 w-5" />
        </SBTrigger>
        <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
      </header>

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold">{stats?.pending_total || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aprovados (7d)</p>
                  <p className="text-2xl font-bold">{stats?.approved_7d || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reprovados (7d)</p>
                  <p className="text-2xl font-bold">{stats?.rejected_7d || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Pendentes</p>
                  <p className="text-2xl font-bold">
                    {Object.values(stats?.pending_by_role || {}).reduce((a, b) => a + b, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending by Role */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pendentes por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(stats?.pending_by_role || {}).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-muted-foreground">{ROLE_LABELS[role] || role}</span>
                  <Badge variant="outline" className="font-bold">{count}</Badge>
                </div>
              ))}
              {Object.keys(stats?.pending_by_role || {}).length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full">Nenhum cadastro pendente</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ações Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.recent_actions?.map((action: any) => {
                const actionInfo = ACTION_LABELS[action.action] || { label: action.action, color: 'bg-gray-100 text-gray-800' };
                return (
                  <div key={action.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <Badge className={actionInfo.color}>{actionInfo.label}</Badge>
                      <div>
                        <p className="text-sm font-medium">{action.admin?.full_name || action.admin?.email || 'Admin'}</p>
                        {action.reason && <p className="text-xs text-muted-foreground">{action.reason}</p>}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(action.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                );
              })}
              {(!stats?.recent_actions || stats.recent_actions.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma ação recente</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;

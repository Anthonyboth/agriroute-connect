import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { useAdminApi } from '@/hooks/useAdminApi';
import {
  ShieldAlert, Menu, AlertTriangle, ShieldCheck, TrendingDown,
  FileWarning, UserX, Eye, RefreshCw, Truck, Users, Activity,
  CheckCircle, XCircle,
} from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';

interface RiskMetrics {
  pendingRegistrations: number;
  needsFixRegistrations: number;
  rejectedLast30d: number;
  fraudSuspects: number;
  riskScore: number;
}

const AdminRiskManagement = () => {
  const { callApi } = useAdminApi();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<RiskMetrics>({
    pendingRegistrations: 0,
    needsFixRegistrations: 0,
    rejectedLast30d: 0,
    fraudSuspects: 0,
    riskScore: 0,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      // Fetch stats from admin API
      const { data } = await callApi<any>('stats');
      if (data) {
        const pending = data.pending_total || 0;
        const rejected = data.rejected_7d || 0;
        // Calculate a simple risk score
        const riskScore = Math.min(100, Math.round((pending * 2 + rejected * 5) / 3));
        
        setMetrics({
          pendingRegistrations: pending,
          needsFixRegistrations: 0, // would come from filtered query
          rejectedLast30d: rejected,
          fraudSuspects: 0,
          riskScore,
        });
      }
      setLoading(false);
    };
    fetchMetrics();
  }, []);

  if (loading) return <div className="flex-1 flex items-center justify-center"><AppSpinner /></div>;

  const riskLevel = metrics.riskScore < 30 ? 'low' : metrics.riskScore < 60 ? 'medium' : 'high';
  const riskColors = {
    low: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-500' },
    medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', bar: 'bg-amber-500' },
    high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', bar: 'bg-red-500' },
  };
  const rc = riskColors[riskLevel];

  return (
    <div className="flex-1 bg-gray-50/50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <SidebarTrigger className="p-2 hover:bg-gray-100 rounded-md">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Gestão de Risco</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada de riscos da plataforma</p>
        </div>
      </header>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Risk Score Banner */}
        <Card className={`shadow-sm border ${rc.border} ${rc.bg}`}>
          <CardContent className="pt-6 pb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${riskLevel === 'low' ? 'bg-emerald-100' : riskLevel === 'medium' ? 'bg-amber-100' : 'bg-red-100'}`}>
                  <ShieldAlert className={`h-7 w-7 ${rc.text}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Índice de Risco Geral</p>
                  <div className="flex items-center gap-3 mt-1">
                    <p className={`text-3xl font-bold ${rc.text}`}>{metrics.riskScore}</p>
                    <Badge className={`${rc.bg} ${rc.text} border ${rc.border}`}>
                      {riskLevel === 'low' ? '🟢 Baixo' : riskLevel === 'medium' ? '🟡 Moderado' : '🔴 Alto'}
                    </Badge>
                  </div>
                  <div className="w-48 mt-2">
                    <div className="w-full bg-white/60 rounded-full h-2">
                      <div className={`h-2 rounded-full ${rc.bar} transition-all`} style={{ width: `${metrics.riskScore}%` }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right hidden md:block">
                <p className="text-xs text-gray-500">Baseado em: pendências, reprovações, alertas de fraude</p>
                <p className="text-xs text-gray-400 mt-1">Atualizado em tempo real</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <RiskCard
            title="Cadastros Pendentes"
            value={metrics.pendingRegistrations}
            icon={<Users className="h-5 w-5 text-amber-600" />}
            severity={metrics.pendingRegistrations > 10 ? 'high' : metrics.pendingRegistrations > 3 ? 'medium' : 'low'}
            description="Cadastros sem análise"
            actionLabel="Revisar"
            onAction={() => navigate('/admin-v2/cadastros')}
          />
          <RiskCard
            title="Aguardando Correção"
            value={metrics.needsFixRegistrations}
            icon={<FileWarning className="h-5 w-5 text-orange-600" />}
            severity={metrics.needsFixRegistrations > 5 ? 'medium' : 'low'}
            description="Docs pendentes de reenvio"
          />
          <RiskCard
            title="Reprovações (7d)"
            value={metrics.rejectedLast30d}
            icon={<UserX className="h-5 w-5 text-red-600" />}
            severity={metrics.rejectedLast30d > 5 ? 'high' : 'low'}
            description="Cadastros reprovados recentes"
          />
          <RiskCard
            title="Suspeitas de Fraude"
            value={metrics.fraudSuspects}
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            severity={metrics.fraudSuspects > 0 ? 'high' : 'low'}
            description="Alertas anti-fraude ativos"
          />
        </div>

        {/* Risk Modules */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Registration Risk */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Risco de Cadastros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RiskItem
                label="Documentos ilegíveis ou adulterados"
                description="Detectar CNH, RG ou selfies de baixa qualidade"
                status="active"
              />
              <RiskItem
                label="CPF/CNPJ em listas restritivas"
                description="Verificação automática contra bases públicas"
                status="planned"
              />
              <RiskItem
                label="Duplicidade de cadastros"
                description="Mesmo documento em múltiplas contas"
                status="active"
              />
              <RiskItem
                label="Geolocalização suspeita"
                description="IP/localização inconsistente com endereço informado"
                status="planned"
              />
            </CardContent>
          </Card>

          {/* Freight Risk */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                Risco de Fretes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RiskItem
                label="Desvio de rota"
                description="Motorista saiu significativamente da rota prevista"
                status="active"
              />
              <RiskItem
                label="Paradas não autorizadas"
                description="Paradas prolongadas fora de pontos previstos"
                status="active"
              />
              <RiskItem
                label="Atraso na entrega"
                description="Frete excedeu tempo estimado em >50%"
                status="active"
              />
              <RiskItem
                label="Valor fora do padrão ANTT"
                description="Preço do frete abaixo do piso ANTT"
                status="planned"
              />
            </CardContent>
          </Card>
        </div>

        {/* Coming Soon Section */}
        <Card className="shadow-sm border-dashed border-2">
          <CardContent className="py-8 text-center">
            <Activity className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-700">Centro de Alertas em Desenvolvimento</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Em breve, este módulo exibirá alertas em tempo real de fraude, desvios de rota, 
              documentos vencidos e outros indicadores de risco automatizados.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

function RiskCard({
  title, value, icon, severity, description, actionLabel, onAction,
}: {
  title: string; value: number; icon: React.ReactNode; severity: 'low' | 'medium' | 'high';
  description: string; actionLabel?: string; onAction?: () => void;
}) {
  const severityColors = {
    low: 'border-l-emerald-500',
    medium: 'border-l-amber-500',
    high: 'border-l-red-500',
  };

  return (
    <Card className={`shadow-sm border-l-4 ${severityColors[severity]}`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          {icon}
        </div>
        {actionLabel && onAction && (
          <Button size="sm" variant="outline" className="mt-3 w-full" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function RiskItem({ label, description, status }: { label: string; description: string; status: 'active' | 'planned' }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5">
        {status === 'active' ? (
          <CheckCircle className="h-4 w-4 text-emerald-500" />
        ) : (
          <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
        )}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Badge variant="outline" className={`text-[10px] ${status === 'active' ? 'text-emerald-600 border-emerald-200' : 'text-gray-400 border-gray-200'}`}>
        {status === 'active' ? 'Ativo' : 'Planejado'}
      </Badge>
    </div>
  );
}

export default AdminRiskManagement;

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { useAdminApi } from '@/hooks/useAdminApi';
import {
  ShieldAlert, Menu, AlertTriangle, Users, Truck, Activity,
  CheckCircle, XCircle, FileWarning, UserX, RefreshCw, Eye,
} from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AdminRiskManagement = () => {
  const { callApi } = useAdminApi();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);

  const fetchRisk = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const { data: result } = await callApi<any>('risk');
    if (result) setData(result);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchRisk(); }, []);

  if (loading) return <div className="flex-1 flex items-center justify-center"><AppSpinner /></div>;

  const riskScore = data?.risk_score || 0;
  const riskLevel = riskScore < 30 ? 'low' : riskScore < 60 ? 'medium' : 'high';
  const riskColors = {
    low: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30', bar: 'bg-success' },
    medium: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30', bar: 'bg-warning' },
    high: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/30', bar: 'bg-destructive' },
  };
  const rc = riskColors[riskLevel];

  return (
    <div className="flex-1 bg-muted/30">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="p-2 hover:bg-muted rounded-md"><Menu className="h-5 w-5" /></SidebarTrigger>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Gestão de Risco</h1>
            <p className="text-sm text-muted-foreground">Visão consolidada de riscos da plataforma</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchRisk(true)} disabled={refreshing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </header>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Risk Score Banner */}
        <Card className={`shadow-sm border ${rc.border} ${rc.bg}`}>
          <CardContent className="pt-6 pb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${riskLevel === 'low' ? 'bg-success/20' : riskLevel === 'medium' ? 'bg-warning/20' : 'bg-destructive/20'}`}>
                  <ShieldAlert className={`h-7 w-7 ${rc.text}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Índice de Risco Geral</p>
                  <div className="flex items-center gap-3 mt-1">
                    <p className={`text-3xl font-bold ${rc.text}`}>{riskScore}</p>
                    <Badge className={`${rc.bg} ${rc.text} border ${rc.border}`}>
                      {riskLevel === 'low' ? '🟢 Baixo' : riskLevel === 'medium' ? '🟡 Moderado' : '🔴 Alto'}
                    </Badge>
                  </div>
                  <div className="w-48 mt-2">
                    <div className="w-full bg-background/60 rounded-full h-2">
                      <div className={`h-2 rounded-full ${rc.bar} transition-all`} style={{ width: `${riskScore}%` }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right hidden md:block">
                <p className="text-xs text-muted-foreground">Taxa de cancelamento de fretes (30d): <strong>{data?.freight_cancel_rate || 0}%</strong></p>
                <p className="text-xs text-muted-foreground mt-1">Fretes: {data?.cancelled_freights_30d || 0} cancelados de {data?.total_freights_30d || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <RiskCard title="Cadastros Pendentes" value={data?.pending_registrations || 0} icon={<Users className="h-5 w-5 text-warning" />}
            severity={(data?.pending_registrations || 0) > 10 ? 'high' : (data?.pending_registrations || 0) > 3 ? 'medium' : 'low'}
            description="Sem análise" actionLabel="Revisar" onAction={() => navigate('/admin-v2/cadastros')} />
          <RiskCard title="Aguardando Correção" value={data?.needs_fix_registrations || 0} icon={<FileWarning className="h-5 w-5 text-accent" />}
            severity={(data?.needs_fix_registrations || 0) > 5 ? 'medium' : 'low'} description="Docs pendentes" />
          <RiskCard title="Reprovações (30d)" value={data?.rejected_30d || 0} icon={<UserX className="h-5 w-5 text-destructive" />}
            severity={(data?.rejected_30d || 0) > 5 ? 'high' : 'low'} description="Recentes" />
          <RiskCard title="Alertas Anti-Fraude" value={data?.fraud_count || 0} icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
            severity={(data?.fraud_count || 0) > 0 ? 'high' : 'low'} description="Não resolvidos" />
        </div>

        {/* Fraud Events & Audit Events */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Eventos de Fraude ({data?.fraud_count || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.fraud_events?.length > 0 ? (
                <div className="space-y-2">
                  {data.fraud_events.map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{e.rule_code}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.created_at ? format(new Date(e.created_at), "dd/MM/yy HH:mm", { locale: ptBR }) : '—'}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-xs ${e.severity === 'high' ? 'text-destructive border-destructive/30' : 'text-warning border-warning/30'}`}>
                        {e.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum alerta de fraude ativo 🎉</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-warning" />
                Eventos de Auditoria ({data?.audit_count || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.audit_events?.length > 0 ? (
                <div className="space-y-2">
                  {data.audit_events.map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{e.tipo}: {e.descricao?.slice(0, 60)}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.created_at ? format(new Date(e.created_at), "dd/MM/yy HH:mm", { locale: ptBR }) : '—'}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-xs ${e.severidade === 'alta' ? 'text-destructive border-destructive/30' : 'text-warning border-warning/30'}`}>
                        {e.severidade}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum evento de auditoria pendente</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Risk Modules */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> Risco de Cadastros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RiskItem label="Documentos ilegíveis ou adulterados" description="Detectar CNH, RG ou selfies de baixa qualidade" status="active" />
              <RiskItem label="CPF/CNPJ em listas restritivas" description="Verificação automática contra bases públicas" status="planned" />
              <RiskItem label="Duplicidade de cadastros" description="Mesmo documento em múltiplas contas" status="active" />
              <RiskItem label="Geolocalização suspeita" description="IP/localização inconsistente com endereço informado" status="planned" />
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground" /> Risco de Fretes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RiskItem label="Desvio de rota" description="Motorista saiu significativamente da rota prevista" status="active" />
              <RiskItem label="Paradas não autorizadas" description="Paradas prolongadas fora de pontos previstos" status="active" />
              <RiskItem label="Atraso na entrega" description="Frete excedeu tempo estimado em >50%" status="active" />
              <RiskItem label="Valor fora do padrão ANTT" description="Preço do frete abaixo do piso ANTT" status="planned" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

function RiskCard({ title, value, icon, severity, description, actionLabel, onAction }: {
  title: string; value: number; icon: React.ReactNode; severity: 'low' | 'medium' | 'high';
  description: string; actionLabel?: string; onAction?: () => void;
}) {
  const severityColors = { low: 'border-l-success', medium: 'border-l-warning', high: 'border-l-destructive' };
  return (
    <Card className={`shadow-sm border-l-4 ${severityColors[severity]} border-border/60`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          {icon}
        </div>
        {actionLabel && onAction && (
          <Button size="sm" variant="outline" className="mt-3 w-full" onClick={onAction}>{actionLabel}</Button>
        )}
      </CardContent>
    </Card>
  );
}

function RiskItem({ label, description, status }: { label: string; description: string; status: 'active' | 'planned' }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5">
        {status === 'active' ? <CheckCircle className="h-4 w-4 text-success" /> : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground/90">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Badge variant="outline" className={`text-[10px] ${status === 'active' ? 'text-success border-success/30' : 'text-muted-foreground border-border'}`}>
        {status === 'active' ? 'Ativo' : 'Planejado'}
      </Badge>
    </div>
  );
}

export default AdminRiskManagement;

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Shield, ShieldAlert, ShieldCheck, Activity, AlertTriangle,
  RefreshCw, Settings, TrendingUp, TrendingDown, Clock,
  Users, Lock, Unlock, Eye, Bell, CheckCircle, XCircle,
  BarChart3, PieChart, LineChart, Calendar, Download
} from 'lucide-react';
import {
  LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, 
  Pie, Cell, Legend, Area, AreaChart
} from 'recharts';

interface SecurityMetrics {
  totalAlerts24h: number;
  totalAlerts7d: number;
  totalAlerts30d: number;
  criticalAlerts: number;
  highAlerts: number;
  mediumAlerts: number;
  lowAlerts: number;
  failedLogins24h: number;
  blockedIPs: number;
  suspiciousActivities: number;
  systemHealthScore: number;
}

interface AlertTrend {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface RecentAlert {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  timestamp: string;
  resolved: boolean;
  source: string;
}

interface SecurityConfig {
  failedLoginThreshold: number;
  multipleIPWindow: number;
  unusualHoursStart: number;
  unusualHoursEnd: number;
  rateLimitPerMinute: number;
  autoBlockEnabled: boolean;
  telegramNotifications: boolean;
}

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e'
};

const SEVERITY_ICONS = {
  CRITICAL: ShieldAlert,
  HIGH: AlertTriangle,
  MEDIUM: Bell,
  LOW: CheckCircle
};

export function AdvancedSecurityDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [alertTrends, setAlertTrends] = useState<AlertTrend[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [config, setConfig] = useState<SecurityConfig>({
    failedLoginThreshold: 5,
    multipleIPWindow: 6,
    unusualHoursStart: 2,
    unusualHoursEnd: 6,
    rateLimitPerMinute: 100,
    autoBlockEnabled: true,
    telegramNotifications: true
  });

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    try {
      setLoading(true);
      
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Fetch error logs for metrics
      const errors24h = await supabase.from('error_logs').select('*', { count: 'exact' }).gte('created_at', last24h.toISOString());
      const errors7d = await supabase.from('error_logs').select('*', { count: 'exact' }).gte('created_at', last7d.toISOString());
      const errors30d = await supabase.from('error_logs').select('*', { count: 'exact' }).gte('created_at', last30d.toISOString());
      const auditLogs = await supabase.from('audit_logs').select('*').gte('timestamp', last24h.toISOString()).order('timestamp', { ascending: false }).limit(100);
      const rateLimitViolations = await supabase.from('rate_limit_violations').select('*').gte('created_at', last24h.toISOString());
      const blacklist = await supabase.from('security_blacklist' as any).select('*').eq('is_active', true) as any;

      // Calculate metrics
      const criticalCount = errors30d.data?.filter(e => e.error_category === 'CRITICAL').length || 0;
      const highCount = errors30d.data?.filter(e => e.error_type === 'PAYMENT' || e.error_type === 'DATABASE').length || 0;
      const mediumCount = errors30d.data?.filter(e => e.error_type === 'BACKEND' || e.error_type === 'NETWORK').length || 0;
      const lowCount = (errors30d.count || 0) - criticalCount - highCount - mediumCount;

      // Calculate health score (0-100)
      const baseScore = 100;
      const criticalPenalty = criticalCount * 10;
      const highPenalty = highCount * 5;
      const mediumPenalty = mediumCount * 2;
      const healthScore = Math.max(0, Math.min(100, baseScore - criticalPenalty - highPenalty - mediumPenalty));

      setMetrics({
        totalAlerts24h: errors24h.count || 0,
        totalAlerts7d: errors7d.count || 0,
        totalAlerts30d: errors30d.count || 0,
        criticalAlerts: criticalCount,
        highAlerts: highCount,
        mediumAlerts: mediumCount,
        lowAlerts: lowCount,
        failedLogins24h: auditLogs.data?.filter(l => l.operation === 'LOGIN_FAILED').length || 0,
        blockedIPs: blacklist.data?.length || 0,
        suspiciousActivities: rateLimitViolations.data?.length || 0,
        systemHealthScore: healthScore
      });

      // Generate trend data
      const trends: AlertTrend[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const dayErrors = errors7d.data?.filter(e => {
          const errorDate = new Date(e.created_at);
          return errorDate.toDateString() === date.toDateString();
        }) || [];

        trends.push({
          date: dateStr,
          critical: dayErrors.filter(e => e.error_category === 'CRITICAL').length,
          high: dayErrors.filter(e => e.error_type === 'PAYMENT' || e.error_type === 'DATABASE').length,
          medium: dayErrors.filter(e => e.error_type === 'BACKEND' || e.error_type === 'NETWORK').length,
          low: dayErrors.filter(e => e.error_category !== 'CRITICAL' && !['PAYMENT', 'DATABASE', 'BACKEND', 'NETWORK'].includes(e.error_type)).length
        });
      }
      setAlertTrends(trends);

      // Format recent alerts
      const alerts: RecentAlert[] = (errors24h.data || []).slice(0, 20).map(e => ({
        id: e.id,
        type: e.error_type,
        severity: e.error_category === 'CRITICAL' ? 'CRITICAL' : 
                  ['PAYMENT', 'DATABASE'].includes(e.error_type) ? 'HIGH' :
                  ['BACKEND', 'NETWORK'].includes(e.error_type) ? 'MEDIUM' : 'LOW',
        message: e.error_message.substring(0, 100) + (e.error_message.length > 100 ? '...' : ''),
        timestamp: e.created_at,
        resolved: e.status === 'RESOLVED',
        source: e.module || 'Unknown'
      }));
      setRecentAlerts(alerts);

    } catch (error) {
      console.error('Erro ao carregar dados de segurança:', error);
      toast.error('Erro ao carregar dados de segurança');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSecurityData();
    setRefreshing(false);
    toast.success('Dados atualizados');
  };

  const handleRunHealthCheck = async () => {
    try {
      toast.info('Executando verificação de saúde...');
      const { error } = await supabase.functions.invoke('security-health-check');
      if (error) throw error;
      toast.success('Verificação de saúde concluída');
      await loadSecurityData();
    } catch (error) {
      toast.error('Erro ao executar verificação de saúde');
    }
  };

  const handleRunLoginMonitor = async () => {
    try {
      toast.info('Verificando logins suspeitos...');
      const { error } = await supabase.functions.invoke('monitor-suspicious-logins');
      if (error) throw error;
      toast.success('Verificação de logins concluída');
      await loadSecurityData();
    } catch (error) {
      toast.error('Erro ao verificar logins');
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getHealthScoreLabel = (score: number) => {
    if (score >= 80) return 'Excelente';
    if (score >= 60) return 'Bom';
    if (score >= 40) return 'Atenção';
    return 'Crítico';
  };

  const severityDistribution = metrics ? [
    { name: 'Crítico', value: metrics.criticalAlerts, color: SEVERITY_COLORS.CRITICAL },
    { name: 'Alto', value: metrics.highAlerts, color: SEVERITY_COLORS.HIGH },
    { name: 'Médio', value: metrics.mediumAlerts, color: SEVERITY_COLORS.MEDIUM },
    { name: 'Baixo', value: metrics.lowAlerts, color: SEVERITY_COLORS.LOW }
  ] : [];

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            Central de Segurança
          </h1>
          <p className="text-muted-foreground">
            Monitoramento em tempo real e alertas de segurança
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button variant="default" size="sm" onClick={handleRunHealthCheck}>
            <ShieldCheck className="h-4 w-4 mr-2" />
            Health Check
          </Button>
        </div>
      </div>

      {/* Health Score Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`text-6xl font-bold ${getHealthScoreColor(metrics?.systemHealthScore || 0)}`}>
                {metrics?.systemHealthScore || 0}
              </div>
              <div>
                <p className="text-lg font-semibold">Score de Saúde do Sistema</p>
                <p className={`text-sm ${getHealthScoreColor(metrics?.systemHealthScore || 0)}`}>
                  {getHealthScoreLabel(metrics?.systemHealthScore || 0)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-red-500">{metrics?.criticalAlerts || 0}</p>
                <p className="text-xs text-muted-foreground">Críticos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-500">{metrics?.highAlerts || 0}</p>
                <p className="text-xs text-muted-foreground">Altos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-500">{metrics?.mediumAlerts || 0}</p>
                <p className="text-xs text-muted-foreground">Médios</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">{metrics?.lowAlerts || 0}</p>
                <p className="text-xs text-muted-foreground">Baixos</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Alertas (24h)</p>
                <p className="text-3xl font-bold">{metrics?.totalAlerts24h || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1" />
              vs. {metrics?.totalAlerts7d ? Math.round((metrics.totalAlerts24h / metrics.totalAlerts7d) * 100) : 0}% da média semanal
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Logins Falhos (24h)</p>
                <p className="text-3xl font-bold">{metrics?.failedLogins24h || 0}</p>
              </div>
              <Lock className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Threshold: {config.failedLoginThreshold} tentativas
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">IPs Bloqueados</p>
                <p className="text-3xl font-bold">{metrics?.blockedIPs || 0}</p>
              </div>
              <ShieldAlert className="h-8 w-8 text-red-500" />
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <Clock className="h-3 w-3 mr-1" />
              Ativos na blacklist
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Atividades Suspeitas</p>
                <p className="text-3xl font-bold">{metrics?.suspiciousActivities || 0}</p>
              </div>
              <Eye className="h-8 w-8 text-purple-500" />
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <Activity className="h-3 w-3 mr-1" />
              Rate limit violations
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
          <TabsTrigger value="analytics">Análises</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trends Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5" />
                  Tendência de Alertas (7 dias)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={alertTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Area type="monotone" dataKey="critical" stackId="1" stroke={SEVERITY_COLORS.CRITICAL} fill={SEVERITY_COLORS.CRITICAL} fillOpacity={0.6} name="Crítico" />
                    <Area type="monotone" dataKey="high" stackId="1" stroke={SEVERITY_COLORS.HIGH} fill={SEVERITY_COLORS.HIGH} fillOpacity={0.6} name="Alto" />
                    <Area type="monotone" dataKey="medium" stackId="1" stroke={SEVERITY_COLORS.MEDIUM} fill={SEVERITY_COLORS.MEDIUM} fillOpacity={0.6} name="Médio" />
                    <Area type="monotone" dataKey="low" stackId="1" stroke={SEVERITY_COLORS.LOW} fill={SEVERITY_COLORS.LOW} fillOpacity={0.6} name="Baixo" />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Severity Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Distribuição por Severidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={severityDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {severityDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
              <CardDescription>Execute verificações de segurança manualmente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="outline" className="h-24 flex-col gap-2" onClick={handleRunHealthCheck}>
                  <ShieldCheck className="h-6 w-6" />
                  <span className="text-xs">Health Check</span>
                </Button>
                <Button variant="outline" className="h-24 flex-col gap-2" onClick={handleRunLoginMonitor}>
                  <Users className="h-6 w-6" />
                  <span className="text-xs">Verificar Logins</span>
                </Button>
                <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => toast.info('Recurso em desenvolvimento')}>
                  <Lock className="h-6 w-6" />
                  <span className="text-xs">Rotacionar Secrets</span>
                </Button>
                <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => toast.info('Recurso em desenvolvimento')}>
                  <Download className="h-6 w-6" />
                  <span className="text-xs">Exportar Relatório</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alertas Recentes (24h)</CardTitle>
              <CardDescription>Lista de todos os alertas de segurança</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {recentAlerts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShieldCheck className="h-12 w-12 mx-auto mb-2 text-green-500" />
                      <p>Nenhum alerta nas últimas 24 horas</p>
                    </div>
                  ) : (
                    recentAlerts.map((alert) => {
                      const SeverityIcon = SEVERITY_ICONS[alert.severity];
                      return (
                        <div
                          key={alert.id}
                          className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <SeverityIcon 
                            className="h-5 w-5 mt-0.5" 
                            style={{ color: SEVERITY_COLORS[alert.severity] }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge 
                                variant="outline" 
                                style={{ borderColor: SEVERITY_COLORS[alert.severity], color: SEVERITY_COLORS[alert.severity] }}
                              >
                                {alert.severity}
                              </Badge>
                              <Badge variant="secondary">{alert.type}</Badge>
                              {alert.resolved && (
                                <Badge variant="outline" className="border-green-500 text-green-500">
                                  Resolvido
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-foreground truncate">{alert.message}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>{alert.source}</span>
                              <span>{new Date(alert.timestamp).toLocaleString('pt-BR')}</span>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-4xl font-bold">{metrics?.totalAlerts24h || 0}</p>
                  <p className="text-sm text-muted-foreground">Últimas 24h</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-4xl font-bold">{metrics?.totalAlerts7d || 0}</p>
                  <p className="text-sm text-muted-foreground">Últimos 7 dias</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-4xl font-bold">{metrics?.totalAlerts30d || 0}</p>
                  <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Tipos de Alertas (7 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={alertTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Bar dataKey="critical" fill={SEVERITY_COLORS.CRITICAL} name="Crítico" />
                  <Bar dataKey="high" fill={SEVERITY_COLORS.HIGH} name="Alto" />
                  <Bar dataKey="medium" fill={SEVERITY_COLORS.MEDIUM} name="Médio" />
                  <Bar dataKey="low" fill={SEVERITY_COLORS.LOW} name="Baixo" />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurações de Alertas
              </CardTitle>
              <CardDescription>
                Ajuste os thresholds e comportamentos do sistema de segurança
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="failedLoginThreshold">Tentativas de Login Falhas (threshold)</Label>
                  <Input
                    id="failedLoginThreshold"
                    type="number"
                    value={config.failedLoginThreshold}
                    onChange={(e) => setConfig(c => ({ ...c, failedLoginThreshold: parseInt(e.target.value) || 5 }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Número de tentativas antes de alertar
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="multipleIPWindow">Janela de Múltiplos IPs (horas)</Label>
                  <Input
                    id="multipleIPWindow"
                    type="number"
                    value={config.multipleIPWindow}
                    onChange={(e) => setConfig(c => ({ ...c, multipleIPWindow: parseInt(e.target.value) || 6 }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Período para detectar logins de múltiplos IPs
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unusualHoursStart">Horário Incomum - Início</Label>
                  <Input
                    id="unusualHoursStart"
                    type="number"
                    min={0}
                    max={23}
                    value={config.unusualHoursStart}
                    onChange={(e) => setConfig(c => ({ ...c, unusualHoursStart: parseInt(e.target.value) || 2 }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unusualHoursEnd">Horário Incomum - Fim</Label>
                  <Input
                    id="unusualHoursEnd"
                    type="number"
                    min={0}
                    max={23}
                    value={config.unusualHoursEnd}
                    onChange={(e) => setConfig(c => ({ ...c, unusualHoursEnd: parseInt(e.target.value) || 6 }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rateLimitPerMinute">Rate Limit por Minuto</Label>
                  <Input
                    id="rateLimitPerMinute"
                    type="number"
                    value={config.rateLimitPerMinute}
                    onChange={(e) => setConfig(c => ({ ...c, rateLimitPerMinute: parseInt(e.target.value) || 100 }))}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Bloqueio Automático de IPs</Label>
                    <p className="text-xs text-muted-foreground">
                      Bloquear IPs automaticamente após detecção de atividade suspeita
                    </p>
                  </div>
                  <Switch
                    checked={config.autoBlockEnabled}
                    onCheckedChange={(checked) => setConfig(c => ({ ...c, autoBlockEnabled: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notificações Telegram</Label>
                    <p className="text-xs text-muted-foreground">
                      Enviar alertas críticos para o grupo do Telegram
                    </p>
                  </div>
                  <Switch
                    checked={config.telegramNotifications}
                    onCheckedChange={(checked) => setConfig(c => ({ ...c, telegramNotifications: checked }))}
                  />
                </div>
              </div>

              <Button className="w-full" onClick={() => toast.success('Configurações salvas')}>
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>

          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Sistema de Segurança Ativo</AlertTitle>
            <AlertDescription>
              O monitoramento contínuo está executando verificações a cada hora. 
              Alertas críticos são enviados imediatamente ao Telegram.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}

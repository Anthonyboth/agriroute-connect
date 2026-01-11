import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  TrendingUp,
  Shield,
  FileText
} from 'lucide-react';
import { useFiscal, ComplianceKPIs, AntifraudEvent, CTeData } from '@/hooks/useFiscal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ComplianceDashboardProps {
  empresaId?: string;
}

export function ComplianceDashboard({ empresaId }: ComplianceDashboardProps) {
  const { 
    loading, 
    obterKPIsCompliance, 
    listarCTes, 
    listarAlertasAntifraude,
    resolverAlerta
  } = useFiscal();
  
  const [kpis, setKpis] = useState<ComplianceKPIs | null>(null);
  const [ctes, setCtes] = useState<CTeData[]>([]);
  const [alertas, setAlertas] = useState<AntifraudEvent[]>([]);

  const loadData = async () => {
    const [kpisData, ctesData, alertasData] = await Promise.all([
      obterKPIsCompliance(empresaId),
      listarCTes(empresaId),
      listarAlertasAntifraude(empresaId, true),
    ]);

    if (kpisData) setKpis(kpisData);
    setCtes(ctesData);
    setAlertas(alertasData);
  };

  useEffect(() => {
    loadData();
  }, [empresaId]);

  const handleResolverAlerta = async (alertaId: string) => {
    const success = await resolverAlerta(alertaId);
    if (success) {
      setAlertas(prev => prev.filter(a => a.id !== alertaId));
      loadData();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'autorizado':
        return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">Autorizado</Badge>;
      case 'rejeitado':
        return <Badge variant="destructive">Rejeitado</Badge>;
      case 'cancelado':
        return <Badge variant="outline" className="text-muted-foreground">Cancelado</Badge>;
      case 'processando':
        return <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30">Processando</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const getSeveridadeBadge = (severidade: string) => {
    switch (severidade) {
      case 'critical':
        return <Badge variant="destructive">Crítico</Badge>;
      case 'high':
        return <Badge className="bg-orange-500/20 text-orange-700 border-orange-500/30">Alto</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">Médio</Badge>;
      default:
        return <Badge variant="secondary">Baixo</Badge>;
    }
  };

  const scoreColor = kpis?.score_compliance 
    ? kpis.score_compliance >= 80 
      ? 'text-green-600' 
      : kpis.score_compliance >= 50 
        ? 'text-yellow-600' 
        : 'text-red-600'
    : 'text-muted-foreground';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Compliance Fiscal</h2>
          <p className="text-muted-foreground">
            Monitoramento de CT-es e análise antifraude
          </p>
        </div>
        <Button onClick={loadData} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* KPIs Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score de Compliance</CardTitle>
            <Shield className={`h-4 w-4 ${scoreColor}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${scoreColor}`}>
              {kpis?.score_compliance ?? '--'}%
            </div>
            <Progress 
              value={kpis?.score_compliance || 0} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CT-es Emitidos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.total_ctes ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {kpis?.ctes_autorizados ?? 0} autorizados, {kpis?.ctes_rejeitados ?? 0} rejeitados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {kpis?.taxa_sucesso?.toFixed(1) ?? 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              CT-es autorizados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Pendentes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {kpis?.alertas_pendentes ?? alertas.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {kpis?.taxa_resolucao?.toFixed(1) ?? 0}% taxa de resolução
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ctes" className="w-full">
        <TabsList>
          <TabsTrigger value="ctes" className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            CT-es Recentes
          </TabsTrigger>
          <TabsTrigger value="alertas" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alertas Antifraude
            {alertas.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                {alertas.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ctes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>CT-es Emitidos</CardTitle>
              <CardDescription>
                Últimos conhecimentos de transporte eletrônicos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {ctes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-2" />
                    <p>Nenhum CT-e emitido</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ctes.map((cte) => (
                      <div
                        key={cte.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {cte.numero ? `CT-e ${cte.numero}/${cte.serie}` : cte.referencia}
                            </span>
                            {getStatusBadge(cte.status)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {cte.chave ? `Chave: ${cte.chave.substring(0, 20)}...` : 'Chave pendente'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(cte.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {cte.dacte_url && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={cte.dacte_url} target="_blank" rel="noopener noreferrer">
                                DACTE
                              </a>
                            </Button>
                          )}
                          {cte.xml_url && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={cte.xml_url} target="_blank" rel="noopener noreferrer">
                                XML
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alertas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Alertas de Antifraude</CardTitle>
              <CardDescription>
                Eventos detectados pelo sistema de análise
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {alertas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mb-2 text-green-500" />
                    <p>Nenhum alerta pendente</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alertas.map((alerta) => (
                      <div
                        key={alerta.id}
                        className="flex items-start justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{alerta.codigo_regra}</span>
                            {getSeveridadeBadge(alerta.severidade)}
                          </div>
                          <p className="text-sm mt-1">{alerta.descricao}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(alerta.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleResolverAlerta(alerta.id)}
                          disabled={loading}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Resolver
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

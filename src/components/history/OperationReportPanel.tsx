/**
 * OperationReportPanel.tsx
 * 
 * Painel de relatórios de operações concluídas.
 * Consulta a RPC `get_operation_report` para dados agregados.
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { 
  BarChart3, 
  TrendingUp, 
  MapPin, 
  Calendar,
  RefreshCw,
  Truck,
  Wrench
} from 'lucide-react';
import { formatBRL } from '@/lib/formatters';
import { useOperationReport } from '@/hooks/useOperationReport';

interface OperationReportPanelProps {
  entityType?: 'FREIGHT' | 'SERVICE' | null;
}

export const OperationReportPanel: React.FC<OperationReportPanelProps> = ({
  entityType = null,
}) => {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '365d'>('30d');
  
  const getStartDate = () => {
    const now = new Date();
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return start.toISOString().split('T')[0];
  };

  const { report, loading, error, refetch } = useOperationReport({
    startDate: getStartDate(),
    entityType,
  });

  if (loading) {
    return <CenteredSpinner size="lg" />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive mb-4">Erro ao carregar relatório: {error}</p>
          <Button variant="outline" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totals = report?.totals || { completed: 0, cancelled: 0, revenue: 0, avg_price: 0 };
  const byRegion = report?.by_region || [];
  const byType = report?.by_type || [];

  return (
    <div className="space-y-6">
      {/* Filtro de período */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Período:</span>
        {(['7d', '30d', '90d', '365d'] as const).map((p) => (
          <Button
            key={p}
            variant={period === p ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(p)}
          >
            {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : p === '90d' ? '90 dias' : '1 ano'}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={refetch}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className="text-3xl font-bold text-primary">{totals.completed}</div>
            <div className="text-sm text-muted-foreground">Operações Concluídas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <div className="text-xl font-bold text-green-600">{formatBRL(totals.revenue)}</div>
            <div className="text-sm text-muted-foreground">Receita Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-xl font-bold text-blue-600">{formatBRL(totals.avg_price)}</div>
            <div className="text-sm text-muted-foreground">Valor Médio</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-xl font-bold text-red-600">{totals.cancelled}</div>
            <div className="text-sm text-muted-foreground">Cancelados</div>
          </CardContent>
        </Card>
      </div>

      {/* Por tipo */}
      {byType.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Por Tipo de Operação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {byType.map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {entry.entity_type === 'FREIGHT' ? (
                      <Truck className="h-4 w-4 text-primary" />
                    ) : (
                      <Wrench className="h-4 w-4 text-primary" />
                    )}
                    <span className="text-sm font-medium">
                      {entry.entity_type === 'FREIGHT' ? 'Fretes' : 'Serviços'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold">{entry.completed}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({formatBRL(entry.revenue)})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Por região */}
      {byRegion.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Por Região
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {byRegion.map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{entry.region}</Badge>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold">{entry.completed}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({formatBRL(entry.revenue)})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sem dados */}
      {totals.completed === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Sem dados de relatório</h3>
            <p className="text-muted-foreground">
              Operações concluídas serão refletidas aqui automaticamente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

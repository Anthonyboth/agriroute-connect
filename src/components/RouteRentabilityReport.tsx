import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts';
import { MapPin, TrendingUp, TrendingDown, Download, ArrowUpDown } from 'lucide-react';
import { formatBRL, formatKm } from '@/lib/formatters';
import * as XLSX from 'xlsx';

interface RouteRentabilityReportProps {
  freights: any[];
}

interface RouteAnalysis {
  route: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  totalFreights: number;
  totalRevenue: number;
  avgPrice: number;
  avgDistance: number;
  pricePerKm: number;
  profitabilityScore: number;
}

export const RouteRentabilityReport: React.FC<RouteRentabilityReportProps> = ({ freights }) => {
  const [sortBy, setSortBy] = useState<'profitability' | 'revenue' | 'volume'>('profitability');
  
  const routeAnalytics = useMemo(() => {
    // Agrupar fretes por rota
    const routeMap = new Map<string, RouteAnalysis>();
    
    freights.forEach(freight => {
      const routeKey = `${freight.origin_city || 'Origem'}, ${freight.origin_state || '?'} → ${freight.destination_city || 'Destino'}, ${freight.destination_state || '?'}`;
      
      if (!routeMap.has(routeKey)) {
        routeMap.set(routeKey, {
          route: routeKey,
          origin_city: freight.origin_city,
          origin_state: freight.origin_state,
          destination_city: freight.destination_city,
          destination_state: freight.destination_state,
          totalFreights: 0,
          totalRevenue: 0,
          avgPrice: 0,
          avgDistance: 0,
          pricePerKm: 0,
          profitabilityScore: 0
        });
      }
      
      const route = routeMap.get(routeKey)!;
      route.totalFreights++;
      route.totalRevenue += freight.price || 0;
      route.avgDistance = ((route.avgDistance * (route.totalFreights - 1)) + (freight.distance_km || 0)) / route.totalFreights;
    });
    
    // Calcular métricas finais
    const routes = Array.from(routeMap.values()).map(route => {
      route.avgPrice = route.totalRevenue / route.totalFreights;
      route.pricePerKm = route.avgDistance > 0 ? route.avgPrice / route.avgDistance : 0;
      
      // Score de rentabilidade: combina volume e preço/km
      const volumeWeight = Math.min(route.totalFreights * 10, 50);
      const priceWeight = Math.min(route.pricePerKm * 100, 50);
      route.profitabilityScore = volumeWeight + priceWeight;
      
      return route;
    });
    
    // Ordenar
    routes.sort((a, b) => {
      switch (sortBy) {
        case 'profitability':
          return b.profitabilityScore - a.profitabilityScore;
        case 'revenue':
          return b.totalRevenue - a.totalRevenue;
        case 'volume':
          return b.totalFreights - a.totalFreights;
        default:
          return 0;
      }
    });
    
    return routes;
  }, [freights, sortBy]);
  
  const topRoutes = routeAnalytics.slice(0, 5);
  const bottomRoutes = routeAnalytics.slice(-5).reverse();
  
  const ProfitabilityBadge = ({ score }: { score: number }) => {
    if (score >= 70) return <Badge className="bg-green-500">Excelente</Badge>;
    if (score >= 40) return <Badge variant="secondary">Regular</Badge>;
    return <Badge variant="destructive">Baixa</Badge>;
  };
  
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      routeAnalytics.map(route => ({
        'Rota': route.route,
        'Fretes Realizados': route.totalFreights,
        'Receita Total': route.totalRevenue,
        'Preço Médio': route.avgPrice,
        'Distância Média (km)': route.avgDistance,
        'Preço por KM': route.pricePerKm,
        'Score de Rentabilidade': route.profitabilityScore.toFixed(1)
      }))
    );
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Análise de Rotas');
    XLSX.writeFile(wb, `rotas-rentabilidade-${new Date().toISOString().split('T')[0]}.xlsx`);
  };
  
  // Dados para scatter plot
  const scatterData = routeAnalytics.map(route => ({
    volume: route.totalFreights,
    pricePerKm: route.pricePerKm,
    revenue: route.totalRevenue,
    route: route.route,
    score: route.profitabilityScore
  }));
  
  return (
    <div className="space-y-6" translate="no">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="h-6 w-6 text-primary shrink-0" />
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold truncate">Análise de Rentabilidade por Rota</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Identificando as rotas mais lucrativas
            </p>
          </div>
        </div>
        <Button onClick={exportToExcel} variant="outline" size="sm" className="shrink-0 w-full sm:w-auto">
          <Download className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
      </div>
      
      {/* Cards de Top 5 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <TrendingUp className="h-5 w-5" />
              Top 5 Rotas Mais Rentáveis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topRoutes.map((route, idx) => (
              <div key={route.route} className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{route.route}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{route.totalFreights} fretes</span>
                    <span>•</span>
                    <span>{formatBRL(route.totalRevenue)}</span>
                    <span>•</span>
                    <ProfitabilityBadge score={route.profitabilityScore} />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <TrendingDown className="h-5 w-5" />
              5 Rotas com Menor Rentabilidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bottomRoutes.map((route, idx) => (
              <div key={route.route} className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{route.route}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{route.totalFreights} fretes</span>
                    <span>•</span>
                    <span>{formatBRL(route.totalRevenue)}</span>
                    <span>•</span>
                    <ProfitabilityBadge score={route.profitabilityScore} />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      
      {/* Gráfico de Dispersão */}
      <Card>
        <CardHeader>
          <CardTitle>Análise Visual: Volume vs Preço por KM</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                dataKey="volume" 
                name="Volume de Fretes" 
                label={{ value: 'Quantidade de Fretes', position: 'insideBottom', offset: -10 }} 
              />
              <YAxis 
                type="number" 
                dataKey="pricePerKm" 
                name="Preço por KM" 
                label={{ value: 'R$ por KM', angle: -90, position: 'insideLeft' }} 
              />
              <ZAxis type="number" dataKey="revenue" range={[50, 400]} name="Receita" />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background border rounded-lg p-3 shadow-lg">
                        <p className="font-semibold text-sm mb-2">{data.route}</p>
                        <div className="space-y-1 text-xs">
                          <p>Fretes: {data.volume}</p>
                          <p>Preço/KM: {formatBRL(data.pricePerKm)}</p>
                          <p>Receita: {formatBRL(data.revenue)}</p>
                          <p>Score: {data.score.toFixed(1)}</p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter 
                data={scatterData} 
                fill="hsl(var(--primary))" 
                fillOpacity={0.6}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">Todas as Rotas</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={sortBy === 'profitability' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('profitability')}
              >
                <ArrowUpDown className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Rentabilidade</span>
              </Button>
              <Button
                variant={sortBy === 'revenue' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('revenue')}
              >
                <ArrowUpDown className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Receita</span>
              </Button>
              <Button
                variant={sortBy === 'volume' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('volume')}
              >
                <ArrowUpDown className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Volume</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rota</TableHead>
                  <TableHead className="text-right">Fretes</TableHead>
                  <TableHead className="text-right">Receita Total</TableHead>
                  <TableHead className="text-right">Preço Médio</TableHead>
                  <TableHead className="text-right">Preço/KM</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routeAnalytics.map((route) => (
                  <TableRow key={route.route}>
                    <TableCell className="font-medium max-w-xs truncate">{route.route}</TableCell>
                    <TableCell className="text-right">{route.totalFreights}</TableCell>
                    <TableCell className="text-right">{formatBRL(route.totalRevenue)}</TableCell>
                    <TableCell className="text-right">{formatBRL(route.avgPrice)}</TableCell>
                    <TableCell className="text-right">{formatBRL(route.pricePerKm)}</TableCell>
                    <TableCell className="text-right">
                      <ProfitabilityBadge score={route.profitabilityScore} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

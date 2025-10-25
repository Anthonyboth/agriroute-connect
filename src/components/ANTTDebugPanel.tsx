import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Calculator, RefreshCw, AlertCircle, CheckCircle, Loader2, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export const ANTTDebugPanel: React.FC = () => {
  const [stats, setStats] = useState({
    totalCargaFreights: 0,
    withAntt: 0,
    withoutAntt: 0,
    percentage: 0
  });
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [testData, setTestData] = useState({
    cargo_type: 'graos_soja',
    distance_km: 500,
    axles: 5,
    table_type: 'A' as 'A' | 'B' | 'C' | 'D',
    required_trucks: 1
  });
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Total de fretes CARGA
      const { count: totalCount } = await supabase
        .from('freights')
        .select('*', { count: 'exact', head: true })
        .eq('service_type', 'CARGA');

      // Com ANTT calculado
      const { count: withAnttCount } = await supabase
        .from('freights')
        .select('*', { count: 'exact', head: true })
        .eq('service_type', 'CARGA')
        .not('minimum_antt_price', 'is', null)
        .gt('minimum_antt_price', 0);

      const total = totalCount || 0;
      const withAntt = withAnttCount || 0;
      const withoutAntt = total - withAntt;
      const percentage = total > 0 ? Math.round((withAntt / total) * 100) : 0;

      setStats({ totalCargaFreights: total, withAntt, withoutAntt, percentage });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  const handleTestCalculation = async () => {
    setTestMode(true);
    setTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('antt-calculator', {
        body: testData
      });

      if (error) throw error;
      
      setTestResult(data);
      toast.success('Cálculo teste concluído');
    } catch (error) {
      console.error('Erro no teste:', error);
      toast.error('Erro ao testar cálculo ANTT');
    }
  };

  const handleBatchRecalculation = async () => {
    if (!confirm('Deseja recalcular TODOS os fretes sem ANTT? Esta operação pode levar alguns minutos.')) {
      return;
    }

    setRecalculating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('recalculate-all-antt-freights', {
        body: {}
      });

      if (error) throw error;
      
      toast.success(data.message || 'Recálculo concluído com sucesso');
      console.log('Resultado detalhado:', data);
      
      // Atualizar estatísticas
      await fetchStats();
    } catch (error: any) {
      console.error('Erro no recálculo em massa:', error);
      
      if (error.message?.includes('Rate limit')) {
        toast.error('Rate limit excedido - aguarde 1 hora');
      } else if (error.message?.includes('Acesso negado')) {
        toast.error('Apenas administradores podem executar esta função');
      } else {
        toast.error('Erro ao recalcular fretes');
      }
    } finally {
      setRecalculating(false);
    }
  };

  const cargoTypes = [
    { value: 'graos_soja', label: 'Grãos - Soja' },
    { value: 'graos_milho', label: 'Grãos - Milho' },
    { value: 'graos_arroz', label: 'Grãos - Arroz' },
    { value: 'combustivel', label: 'Combustível' },
    { value: 'acucar', label: 'Açúcar' },
    { value: 'gado_bovino', label: 'Gado Bovino' },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Painel de Debug ANTT</h2>
        <p className="text-muted-foreground">
          Ferramenta administrativa para monitoramento e recálculo de preços mínimos ANTT
        </p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Fretes CARGA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalCargaFreights}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Com ANTT Calculado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.withAntt}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sem ANTT (NULL/0)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.withoutAntt}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cobertura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold">{stats.percentage}%</div>
              <Progress value={stats.percentage} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações em Massa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Recálculo em Massa
          </CardTitle>
          <CardDescription>
            Recalcula o preço mínimo ANTT para todos os fretes CARGA que não possuem valor calculado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats.withoutAntt > 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{stats.withoutAntt} fretes</strong> precisam de recálculo ANTT
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Todos os fretes possuem ANTT calculado!
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleBatchRecalculation}
              disabled={recalculating || stats.withoutAntt === 0}
              className="flex-1"
            >
              {recalculating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recalculando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recalcular {stats.withoutAntt} Fretes
                </>
              )}
            </Button>
            <Button variant="outline" onClick={fetchStats} disabled={loading}>
              <TrendingUp className="mr-2 h-4 w-4" />
              Atualizar Stats
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            ⚠️ Esta operação pode levar alguns minutos e só pode ser executada 1x por hora (rate limit)
          </p>
        </CardContent>
      </Card>

      {/* Simulador de Cálculo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Simulador de Cálculo ANTT
          </CardTitle>
          <CardDescription>
            Teste o cálculo ANTT com diferentes parâmetros
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label>Tipo de Carga</Label>
              <Select
                value={testData.cargo_type}
                onValueChange={(value) => setTestData(prev => ({ ...prev, cargo_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cargoTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Distância (km)</Label>
              <Input
                type="number"
                value={testData.distance_km}
                onChange={(e) => setTestData(prev => ({ ...prev, distance_km: Number(e.target.value) }))}
                min={1}
              />
            </div>

            <div>
              <Label>Número de Eixos</Label>
              <Select
                value={String(testData.axles)}
                onValueChange={(value) => setTestData(prev => ({ ...prev, axles: Number(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 7, 9].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} eixos</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo de Tabela</Label>
              <Select
                value={testData.table_type}
                onValueChange={(value: any) => setTestData(prev => ({ ...prev, table_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A - Normal Próprio</SelectItem>
                  <SelectItem value="B">B - Normal Terceiros</SelectItem>
                  <SelectItem value="C">C - Alta Próprio</SelectItem>
                  <SelectItem value="D">D - Alta Terceiros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Número de Carretas</Label>
              <Input
                type="number"
                value={testData.required_trucks}
                onChange={(e) => setTestData(prev => ({ ...prev, required_trucks: Number(e.target.value) }))}
                min={1}
                max={10}
              />
            </div>
          </div>

          <Button onClick={handleTestCalculation} className="w-full">
            <Calculator className="mr-2 h-4 w-4" />
            Calcular
          </Button>

          {testResult && (
            <div className="mt-4 p-4 bg-muted rounded-lg space-y-3">
              <h3 className="font-semibold text-lg">Resultado do Cálculo:</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Mínimo ANTT (por carreta)</p>
                  <p className="text-2xl font-bold text-green-600">
                    R$ {testResult.minimum_freight_value?.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Mínimo ANTT (total)</p>
                  <p className="text-2xl font-bold text-green-700">
                    R$ {testResult.minimum_freight_value_total?.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-background rounded border">
                <p className="text-sm font-medium mb-2">Detalhes do Cálculo:</p>
                <div className="text-xs space-y-1 font-mono">
                  <p>Categoria: {testResult.calculation_details?.antt_category}</p>
                  <p>Tabela: {testResult.calculation_details?.table_type}</p>
                  <p>Eixos: {testResult.calculation_details?.axles}</p>
                  <p>Distância: {testResult.calculation_details?.distance_km} km</p>
                  <p>Taxa/km: R$ {testResult.calculation_details?.rate_per_km}</p>
                  <p>Taxa fixa: R$ {testResult.calculation_details?.fixed_charge}</p>
                  <p className="mt-2 font-semibold">Fórmula: {testResult.calculation_details?.formula}</p>
                </div>
              </div>

              <Badge variant="outline" className="mt-2">
                Sugestão comercial: R$ {testResult.suggested_freight_value_total?.toFixed(2)} (10% acima do mínimo)
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MapPin, Loader2, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';

interface BackfillResult {
  calculated: number;
  failed: number;
  skipped: number;
  total: number;
  timestamp: string;
}

export const AdminDistanceBackfillPanel: React.FC = () => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentResult, setCurrentResult] = useState<BackfillResult | null>(null);
  const [executionHistory, setExecutionHistory] = useState<BackfillResult[]>([]);

  // 📊 Carregar histórico do localStorage na montagem
  useEffect(() => {
    const storedHistory = localStorage.getItem('distance-backfill-history');
    if (storedHistory) {
      try {
        const parsed = JSON.parse(storedHistory);
        setExecutionHistory(parsed.slice(0, 10)); // Manter apenas últimas 10
      } catch (error) {
        console.error('Erro ao carregar histórico:', error);
      }
    }
  }, []);

  // 🔧 Executar backfill de distâncias
  const executeBackfill = async () => {
    setIsExecuting(true);
    setCurrentResult(null);

    try {
      toast.info('🚀 Iniciando backfill de distâncias...', {
        description: 'Processando até 50 fretes por vez'
      });

      const { data, error } = await supabase.functions.invoke('calculate-freight-distances');

      if (error) {
        throw new Error(error.message || 'Erro ao executar backfill');
      }

      const result: BackfillResult = {
        calculated: data?.calculated || 0,
        failed: data?.failed || 0,
        skipped: data?.skipped || 0,
        total: (data?.calculated || 0) + (data?.failed || 0) + (data?.skipped || 0),
        timestamp: new Date().toISOString()
      };

      setCurrentResult(result);

      // 💾 Salvar no histórico (localStorage)
      const newHistory = [result, ...executionHistory].slice(0, 10); // Máximo 10
      setExecutionHistory(newHistory);
      localStorage.setItem('distance-backfill-history', JSON.stringify(newHistory));

      // 🎉 Notificação de sucesso
      if (result.calculated > 0) {
        toast.success('✅ Backfill concluído com sucesso!', {
          description: `${result.calculated} distâncias calculadas e arredondadas`
        });
      } else if (result.skipped > 0) {
        toast.info('ℹ️ Nenhuma distância calculada', {
          description: `${result.skipped} fretes já possuíam distância ou não tinham coordenadas válidas`
        });
      }

      if (result.failed > 0) {
        toast.warning(`⚠️ ${result.failed} fretes falharam`, {
          description: 'Verifique os logs da edge function para detalhes'
        });
      }

    } catch (error: any) {
      console.error('Erro ao executar backfill:', error);
      toast.error('❌ Erro ao executar backfill', {
        description: error.message || 'Erro desconhecido'
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // 🎨 Formatar timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* 🎯 Título da seção */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" />
          Backfill de Distâncias
        </h2>
        <p className="text-gray-600">
          Calcula e arredonda distâncias faltantes nos fretes usando Google Maps API
        </p>
      </div>

      {/* 📦 Card principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Execução de Backfill
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 📊 Resultado atual */}
          {currentResult && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">{currentResult.calculated}</p>
                <p className="text-xs text-muted-foreground">Calculados</p>
              </div>
              <div className="text-center">
                <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-600">{currentResult.failed}</p>
                <p className="text-xs text-muted-foreground">Falhados</p>
              </div>
              <div className="text-center">
                <Clock className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-yellow-600">{currentResult.skipped}</p>
                <p className="text-xs text-muted-foreground">Pulados</p>
              </div>
              <div className="text-center">
                <MapPin className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-600">{currentResult.total}</p>
                <p className="text-xs text-muted-foreground">Total Processado</p>
              </div>
            </div>
          )}

          <Separator />

          {/* 🚀 Botão de execução */}
          <div className="flex flex-col items-center gap-4">
            <Button
              onClick={executeBackfill}
              disabled={isExecuting}
              size="lg"
              className="w-full md:w-auto"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <MapPin className="mr-2 h-5 w-5" />
                  Executar Backfill de Distâncias
                </>
              )}
            </Button>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 w-full">
              <p className="text-sm text-blue-900 font-medium mb-2">ℹ️ Como funciona:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
                <li>Processa até <strong>50 fretes</strong> por execução</li>
                <li>Calcula distâncias usando <strong>Google Maps API</strong></li>
                <li>Arredonda valores para <strong>inteiros</strong> (ex: 745.78 km → 746 km)</li>
                <li>Pula fretes que já possuem distância calculada</li>
                <li>Registra logs detalhados de cada operação</li>
              </ul>
            </div>
          </div>

          <Separator />

          {/* 📜 Histórico de execuções */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Histórico de Execuções</h3>
            {executionHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma execução registrada ainda
              </p>
            ) : (
              <div className="space-y-2">
                {executionHistory.map((result, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {formatTimestamp(result.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        ✅ {result.calculated}
                      </Badge>
                      <Badge variant="outline" className="text-red-600 border-red-600">
                        ❌ {result.failed}
                      </Badge>
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                        ⏭️ {result.skipped}
                      </Badge>
                      <Badge variant="secondary">
                        📊 {result.total} total
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

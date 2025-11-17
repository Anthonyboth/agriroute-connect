import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDate } from '@/lib/formatters';

interface BackfillResult {
  calculated: number;
  failed: number;
  skipped: number;
  total: number;
  timestamp: string;
}

export const AdminDistanceBackfillPanel: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentResult, setCurrentResult] = useState<BackfillResult | null>(null);
  const [history, setHistory] = useState<BackfillResult[]>([]);

  const handleRunBackfill = async () => {
    setIsRunning(true);
    setCurrentResult(null);

    try {
      console.log('[AdminDistanceBackfill] Invocando edge function...');
      
      const { data, error } = await supabase.functions.invoke('calculate-freight-distances', {
        body: {}
      });

      if (error) throw error;

      const result: BackfillResult = {
        calculated: data.calculated || 0,
        failed: data.failed || 0,
        skipped: data.skipped || 0,
        total: data.total || 0,
        timestamp: new Date().toISOString()
      };

      setCurrentResult(result);
      setHistory(prev => [result, ...prev].slice(0, 10)); // Manter últimas 10 execuções

      // Salvar em localStorage para histórico persistente
      const storedHistory = JSON.parse(localStorage.getItem('distance-backfill-history') || '[]');
      localStorage.setItem('distance-backfill-history', JSON.stringify([result, ...storedHistory].slice(0, 10)));

      if (result.calculated > 0) {
        toast.success(`✅ Backfill concluído!`, {
          description: `${result.calculated} distâncias calculadas de ${result.total} fretes processados`
        });
      } else {
        toast.info('✅ Backfill concluído', {
          description: 'Nenhum frete necessitava recálculo de distância'
        });
      }
    } catch (error: any) {
      console.error('[AdminDistanceBackfill] Erro:', error);
      toast.error('Erro ao executar backfill', {
        description: error.message || 'Verifique os logs do console'
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Carregar histórico do localStorage ao montar
  React.useEffect(() => {
    const storedHistory = JSON.parse(localStorage.getItem('distance-backfill-history') || '[]');
    setHistory(storedHistory);
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Backfill de Distâncias
            </CardTitle>
            <CardDescription>
              Recalcula distâncias de fretes usando Google Maps API
            </CardDescription>
          </div>
          <Button
            onClick={handleRunBackfill}
            disabled={isRunning}
            size="lg"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executando...
              </>
            ) : (
              'Executar Backfill'
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Resultado Atual */}
        {currentResult && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">Resultado da Última Execução</h3>
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                    <span className="text-3xl font-bold">{currentResult.calculated}</span>
                    <span className="text-sm text-muted-foreground">Calculados</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center">
                    <XCircle className="h-8 w-8 text-red-500 mb-2" />
                    <span className="text-3xl font-bold">{currentResult.failed}</span>
                    <span className="text-sm text-muted-foreground">Falhados</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center">
                    <AlertCircle className="h-8 w-8 text-orange-500 mb-2" />
                    <span className="text-3xl font-bold">{currentResult.skipped}</span>
                    <span className="text-sm text-muted-foreground">Pulados</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center">
                    <MapPin className="h-8 w-8 text-blue-500 mb-2" />
                    <span className="text-3xl font-bold">{currentResult.total}</span>
                    <span className="text-sm text-muted-foreground">Total</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Histórico */}
        {history.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">Histórico de Execuções</h3>
            <div className="space-y-2">
              {history.map((result, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(result.timestamp)}
                    </span>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        {result.calculated}
                      </Badge>
                      {result.failed > 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          {result.failed}
                        </Badge>
                      )}
                      {result.skipped > 0 && (
                        <Badge variant="secondary" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {result.skipped}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {result.total} fretes processados
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {history.length === 0 && !currentResult && (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma execução registrada ainda</p>
            <p className="text-sm">Clique em "Executar Backfill" para começar</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
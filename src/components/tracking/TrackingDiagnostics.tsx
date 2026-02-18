import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  MapPin, Wifi, WifiOff, Battery, RefreshCw, 
  CheckCircle, XCircle, AlertTriangle, Clock,
  Compass, Signal, Smartphone, Settings
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DiagnosticResult {
  test: string;
  status: 'success' | 'warning' | 'error' | 'pending';
  message: string;
  details?: string;
}

interface TrackingDiagnosticsProps {
  driverProfileId: string;
}

export const TrackingDiagnostics: React.FC<TrackingDiagnosticsProps> = ({
  driverProfileId
}) => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [currentPosition, setCurrentPosition] = useState<{ coords: GeolocationCoordinates } | null>(null);
  const [lastServerUpdate, setLastServerUpdate] = useState<Date | null>(null);
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);

  const recommendations: Record<string, string[]> = {
    gps_permission: [
      'Acesse Configurações > Localização > Permissões',
      'Permita que o AgriRoute acesse sua localização "Sempre"',
      'Reinicie o aplicativo após alterar as permissões'
    ],
    gps_accuracy: [
      'Vá para um local aberto, longe de prédios',
      'Ative o GPS de alta precisão nas configurações',
      'Aguarde 30 segundos para o GPS estabilizar'
    ],
    gps_signal: [
      'Verifique se o GPS está ativado no dispositivo',
      'Reinicie o GPS desligando e ligando novamente',
      'Em áreas rurais, aguarde mais tempo para obter sinal'
    ],
    network: [
      'Verifique sua conexão com a internet',
      'Tente alternar entre Wi-Fi e dados móveis',
      'Reinicie o roteador ou ative/desative o modo avião'
    ],
    battery: [
      'Conecte o carregador do dispositivo',
      'Desative o modo economia de energia',
      'Feche outros aplicativos em segundo plano'
    ]
  };

  const runDiagnostics = async () => {
    setRunning(true);
    setResults([]);
    
    const newResults: DiagnosticResult[] = [];

    // Test 1: GPS Permission
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      if (permission.state === 'granted') {
        newResults.push({
          test: 'Permissão GPS',
          status: 'success',
          message: 'Localização permitida',
          details: 'O aplicativo tem acesso à sua localização'
        });
      } else if (permission.state === 'prompt') {
        newResults.push({
          test: 'Permissão GPS',
          status: 'warning',
          message: 'Permissão pendente',
          details: 'Você precisa autorizar o acesso à localização'
        });
      } else {
        newResults.push({
          test: 'Permissão GPS',
          status: 'error',
          message: 'Localização bloqueada',
          details: 'O acesso à localização foi negado'
        });
      }
    } catch {
      newResults.push({
        test: 'Permissão GPS',
        status: 'warning',
        message: 'Não foi possível verificar',
        details: 'Navegador não suporta verificação de permissões'
      });
    }
    setResults([...newResults]);

    // Test 2: GPS Signal
    try {
      const { getCurrentPositionSafe } = await import('@/utils/location');
      const position = await getCurrentPositionSafe();
      
      setCurrentPosition(position);
      
      const accuracy = position.coords.accuracy;
      if (accuracy <= 20) {
        newResults.push({
          test: 'Sinal GPS',
          status: 'success',
          message: `Excelente (${accuracy.toFixed(0)}m)`,
          details: 'Precisão ideal para rastreamento'
        });
      } else if (accuracy <= 50) {
        newResults.push({
          test: 'Sinal GPS',
          status: 'success',
          message: `Bom (${accuracy.toFixed(0)}m)`,
          details: 'Precisão adequada para rastreamento'
        });
      } else if (accuracy <= 100) {
        newResults.push({
          test: 'Sinal GPS',
          status: 'warning',
          message: `Regular (${accuracy.toFixed(0)}m)`,
          details: 'Precisão pode afetar a qualidade do rastreamento'
        });
      } else {
        newResults.push({
          test: 'Sinal GPS',
          status: 'error',
          message: `Fraco (${accuracy.toFixed(0)}m)`,
          details: 'Precisão muito baixa, melhore as condições de sinal'
        });
      }
    } catch (error: any) {
      let message = 'GPS indisponível';
      if (error.code === 1) message = 'Permissão negada';
      if (error.code === 2) message = 'Posição indisponível';
      if (error.code === 3) message = 'Tempo esgotado';
      
      newResults.push({
        test: 'Sinal GPS',
        status: 'error',
        message,
        details: 'Não foi possível obter localização'
      });
    }
    setResults([...newResults]);

    // Test 3: Network Connection
    if (navigator.onLine) {
      try {
        const start = Date.now();
        await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors' });
        const latency = Date.now() - start;
        
        if (latency < 200) {
          newResults.push({
            test: 'Conexão Internet',
            status: 'success',
            message: `Excelente (${latency}ms)`,
            details: 'Conexão estável e rápida'
          });
        } else if (latency < 500) {
          newResults.push({
            test: 'Conexão Internet',
            status: 'success',
            message: `Boa (${latency}ms)`,
            details: 'Conexão adequada'
          });
        } else {
          newResults.push({
            test: 'Conexão Internet',
            status: 'warning',
            message: `Lenta (${latency}ms)`,
            details: 'Conexão pode causar atrasos no envio'
          });
        }
      } catch {
        newResults.push({
          test: 'Conexão Internet',
          status: 'warning',
          message: 'Não verificável',
          details: 'Teste de latência bloqueado'
        });
      }
    } else {
      newResults.push({
        test: 'Conexão Internet',
        status: 'error',
        message: 'Offline',
        details: 'Sem conexão com a internet'
      });
    }
    setResults([...newResults]);

    // Test 4: Last Server Update
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('last_gps_update, current_location_lat, current_location_lng')
        .eq('id', driverProfileId)
        .single();

      if (error) throw error;

      if (data?.last_gps_update) {
        const lastUpdate = new Date(data.last_gps_update);
        setLastServerUpdate(lastUpdate);
        const diffMinutes = (Date.now() - lastUpdate.getTime()) / 60000;

        if (diffMinutes < 5) {
          newResults.push({
            test: 'Última Atualização',
            status: 'success',
            message: `${diffMinutes.toFixed(0)} min atrás`,
            details: 'Rastreamento ativo e funcionando'
          });
        } else if (diffMinutes < 30) {
          newResults.push({
            test: 'Última Atualização',
            status: 'warning',
            message: `${diffMinutes.toFixed(0)} min atrás`,
            details: 'Pode haver atraso no envio de localização'
          });
        } else {
          newResults.push({
            test: 'Última Atualização',
            status: 'error',
            message: `${diffMinutes.toFixed(0)} min atrás`,
            details: 'Rastreamento pode estar inativo'
          });
        }
      } else {
        newResults.push({
          test: 'Última Atualização',
          status: 'warning',
          message: 'Sem registros',
          details: 'Nenhuma localização enviada ainda'
        });
      }
    } catch {
      newResults.push({
        test: 'Última Atualização',
        status: 'error',
        message: 'Erro ao verificar',
        details: 'Não foi possível consultar o servidor'
      });
    }
    setResults([...newResults]);

    // Test 5: Battery (if available)
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        const level = Math.round(battery.level * 100);
        const charging = battery.charging;

        if (level > 50 || charging) {
          newResults.push({
            test: 'Bateria',
            status: 'success',
            message: `${level}%${charging ? ' (carregando)' : ''}`,
            details: 'Bateria adequada para rastreamento contínuo'
          });
        } else if (level > 20) {
          newResults.push({
            test: 'Bateria',
            status: 'warning',
            message: `${level}%`,
            details: 'Considere carregar o dispositivo'
          });
        } else {
          newResults.push({
            test: 'Bateria',
            status: 'error',
            message: `${level}%`,
            details: 'Bateria baixa pode interromper o rastreamento'
          });
        }
      } catch {
        // Battery API not available
      }
    }

    setResults([...newResults]);
    setRunning(false);
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground animate-spin" />;
    }
  };

  const overallStatus = results.length === 0 
    ? 'pending' 
    : results.some(r => r.status === 'error')
      ? 'error'
      : results.some(r => r.status === 'warning')
        ? 'warning'
        : 'success';

  const getRecommendations = () => {
    const errorResults = results.filter(r => r.status === 'error' || r.status === 'warning');
    const recs: string[] = [];
    
    errorResults.forEach(result => {
      if (result.test.includes('Permissão')) {
        recs.push(...(recommendations.gps_permission || []));
      } else if (result.test.includes('Sinal')) {
        recs.push(...(recommendations.gps_accuracy || []));
      } else if (result.test.includes('Internet')) {
        recs.push(...(recommendations.network || []));
      } else if (result.test.includes('Bateria')) {
        recs.push(...(recommendations.battery || []));
      }
    });

    return [...new Set(recs)]; // Remove duplicates
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Diagnóstico do Rastreamento
          </span>
          <Badge variant={
            overallStatus === 'success' ? 'default' :
            overallStatus === 'warning' ? 'secondary' :
            overallStatus === 'error' ? 'destructive' : 'outline'
          }>
            {overallStatus === 'success' ? 'Tudo OK' :
             overallStatus === 'warning' ? 'Atenção' :
             overallStatus === 'error' ? 'Problemas' : 'Pendente'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Run Diagnostics Button */}
        <Button
          onClick={runDiagnostics}
          disabled={running}
          className="w-full"
        >
          {running ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Executando diagnóstico...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Executar Diagnóstico Completo
            </>
          )}
        </Button>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((result, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
              >
                {getStatusIcon(result.status)}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{result.test}</span>
                    <span className="text-sm">{result.message}</span>
                  </div>
                  {result.details && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {result.details}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Current Position Info */}
        {currentPosition && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Localização Atual
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Latitude:</span>
                <span className="ml-2">{currentPosition.coords.latitude.toFixed(6)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Longitude:</span>
                <span className="ml-2">{currentPosition.coords.longitude.toFixed(6)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Precisão:</span>
                <span className="ml-2">{currentPosition.coords.accuracy.toFixed(0)}m</span>
              </div>
              {currentPosition.coords.speed && (
                <div>
                  <span className="text-muted-foreground">Velocidade:</span>
                  <span className="ml-2">{(currentPosition.coords.speed * 3.6).toFixed(0)} km/h</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {results.length > 0 && (overallStatus === 'error' || overallStatus === 'warning') && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Recomendações</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {getRecommendations().slice(0, 5).map((rec, index) => (
                  <li key={index} className="text-sm">{rec}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Last Server Update Info */}
        {lastServerUpdate && (
          <div className="text-center text-sm text-muted-foreground">
            <Clock className="h-4 w-4 inline mr-1" />
            Último envio para o servidor: {format(lastServerUpdate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

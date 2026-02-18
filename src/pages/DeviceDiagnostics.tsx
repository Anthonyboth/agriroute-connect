import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BackButton } from '@/components/BackButton';
import { 
  Activity, 
  RefreshCw, 
  Smartphone, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  MapPin,
  Camera,
  Mic,
  Bell,
  HardDrive
} from 'lucide-react';
import { getDeviceInfo } from '@/utils/deviceDetection';
import { useDevicePermissions } from '@/hooks/useDevicePermissions';
import { isNativeApp, getNativePlatform } from '@/utils/capacitorPermissions';
import { toast } from 'sonner';

export default function DeviceDiagnostics() {
  const [deviceInfo, setDeviceInfo] = useState<Awaited<ReturnType<typeof getDeviceInfo>> | null>(null);
  const { permissions, loading, checkAllPermissions } = useDevicePermissions();
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadDeviceInfo();
  }, []);

  const loadDeviceInfo = async () => {
    const info = await getDeviceInfo();
    setDeviceInfo(info);
  };

  const testPermission = async (type: 'location' | 'camera' | 'microphone' | 'notifications') => {
    try {
      let success = false;

      switch (type) {
        case 'location': {
          const { getCurrentPositionSafe } = await import('@/utils/location');
          await getCurrentPositionSafe();
          success = true;
        }
          break;

        case 'camera':
        case 'microphone':
          const constraints = type === 'camera'
            ? { video: true, audio: false }
            : { video: false, audio: true };
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          stream.getTracks().forEach(track => track.stop());
          success = true;
          break;

        case 'notifications':
          if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            success = permission === 'granted';
          }
          break;
      }

      setTestResults(prev => ({ ...prev, [type]: success }));
      
      if (success) {
        toast.success(`Teste de ${type} passou!`);
      } else {
        toast.error(`Teste de ${type} falhou!`);
      }

      await checkAllPermissions();
    } catch (error) {
      console.error(`❌ Erro no teste de ${type}:`, error);
      setTestResults(prev => ({ ...prev, [type]: false }));
      toast.error(`Teste de ${type} falhou!`);
    }
  };

  const resetAllPermissions = () => {
    localStorage.clear();
    sessionStorage.clear();
    toast.success('Cache limpo! Recarregue a página para resetar permissões');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'granted': return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'denied': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <AlertTriangle className="h-4 w-4 text-warning" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'granted': return <Badge variant="default" className="bg-success">Ativo</Badge>;
      case 'denied': return <Badge variant="destructive">Negado</Badge>;
      case 'unsupported': return <Badge variant="secondary">Não suportado</Badge>;
      default: return <Badge variant="outline">Pendente</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <BackButton label="Voltar" className="mb-2" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            Diagnóstico do Dispositivo
          </h1>
          <p className="text-muted-foreground mt-2">
            Informações técnicas e testes de permissões
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            loadDeviceInfo();
            checkAllPermissions();
          }}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Informações do Dispositivo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Informações do Dispositivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {deviceInfo && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Device ID</p>
                <p className="font-mono text-sm">{deviceInfo.deviceId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{deviceInfo.deviceName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <p className="font-medium capitalize">{deviceInfo.deviceType}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sistema Operacional</p>
                <p className="font-medium">{deviceInfo.os}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Navegador</p>
                <p className="font-medium">{deviceInfo.browser}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Plataforma</p>
                <p className="font-medium">
                  {deviceInfo.isNative ? `Nativo (${deviceInfo.platform})` : 'Web'}
                </p>
              </div>
              <div className="lg:col-span-3">
                <p className="text-sm text-muted-foreground">User Agent</p>
                <p className="font-mono text-xs break-all">{deviceInfo.userAgent}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status das Permissões */}
      <Card>
        <CardHeader>
          <CardTitle>Status das Permissões</CardTitle>
          <CardDescription>Permissões atualmente concedidas ao aplicativo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(permissions).map(([key, status]) => (
              <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(status)}
                  <div>
                    <p className="font-medium capitalize">{key}</p>
                    <p className="text-sm text-muted-foreground">{status}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(status)}
                  {key !== 'storage' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testPermission(key as any)}
                    >
                      Testar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Capacidades do Dispositivo */}
      <Card>
        <CardHeader>
          <CardTitle>Capacidades Suportadas</CardTitle>
        </CardHeader>
        <CardContent>
          {deviceInfo && (
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(deviceInfo.capabilities).map(([key, supported]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                  <p className="font-medium capitalize">{key}</p>
                  {supported ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ações de Debug */}
      <Card>
        <CardHeader>
          <CardTitle>Ações de Debug</CardTitle>
          <CardDescription>Ferramentas para diagnóstico e resolução de problemas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={resetAllPermissions}
            >
              Limpar Cache e Resetar Permissões
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Isso limpará todos os dados armazenados localmente e resetará as permissões.
              Você precisará recarregar a página.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

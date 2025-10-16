import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Camera, 
  Mic, 
  Bell, 
  HardDrive,
  Smartphone,
  Monitor,
  Tablet,
  Check,
  X,
  AlertCircle,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { useDevicePermissions, PermissionType } from '@/hooks/useDevicePermissions';
import { getDeviceInfo } from '@/utils/deviceDetection';
import { getActiveDevices, revokeDevice } from '@/services/deviceService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { UserDevice } from '@/services/deviceService';

export const DeviceManager = () => {
  const { profile } = useAuth();
  const { permissions, loading, requestPermission, checkAllPermissions } = useDevicePermissions();
  const [deviceInfo, setDeviceInfo] = useState<Awaited<ReturnType<typeof getDeviceInfo>> | null>(null);
  const [activeDevices, setActiveDevices] = useState<UserDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);

  useEffect(() => {
    getDeviceInfo().then(setDeviceInfo);
  }, []);

  useEffect(() => {
    if (profile) {
      loadActiveDevices();
    }
  }, [profile]);

  const loadActiveDevices = async () => {
    if (!profile) return;
    
    setLoadingDevices(true);
    const devices = await getActiveDevices(profile.id);
    setActiveDevices(devices);
    setLoadingDevices(false);
  };

  const handleRevokeDevice = async (deviceId: string) => {
    const success = await revokeDevice(deviceId);
    if (success) {
      await loadActiveDevices();
    }
  };

  const getPermissionIcon = (type: PermissionType) => {
    const icons = {
      location: MapPin,
      camera: Camera,
      microphone: Mic,
      notifications: Bell,
      storage: HardDrive,
    };
    return icons[type];
  };

  const getPermissionColor = (status: string) => {
    switch (status) {
      case 'granted': return 'text-success';
      case 'denied': return 'text-destructive';
      case 'unsupported': return 'text-muted-foreground';
      default: return 'text-warning';
    }
  };

  const getPermissionBadge = (status: string) => {
    switch (status) {
      case 'granted': return <Badge variant="default" className="bg-success"><Check className="h-3 w-3 mr-1" />Ativo</Badge>;
      case 'denied': return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Negado</Badge>;
      case 'unsupported': return <Badge variant="secondary">Não suportado</Badge>;
      default: return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
  };

  const getDeviceIcon = (type: string | null) => {
    switch (type) {
      case 'mobile': return Smartphone;
      case 'tablet': return Tablet;
      default: return Monitor;
    }
  };

  const permissionsList: { type: PermissionType; label: string; description: string }[] = [
    {
      type: 'location',
      label: 'Localização',
      description: 'Necessária para encontrar fretes e serviços próximos'
    },
    {
      type: 'camera',
      label: 'Câmera',
      description: 'Necessária para capturar fotos de documentos e check-ins'
    },
    {
      type: 'microphone',
      label: 'Microfone',
      description: 'Para futuras funcionalidades de comunicação por voz'
    },
    {
      type: 'notifications',
      label: 'Notificações Push',
      description: 'Receba alertas sobre fretes, propostas e mensagens'
    },
    {
      type: 'storage',
      label: 'Armazenamento',
      description: 'Permite que o app funcione offline'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Informações do Dispositivo Atual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Dispositivo Atual
          </CardTitle>
          <CardDescription>
            Informações sobre este dispositivo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deviceInfo && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{deviceInfo.deviceName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <p className="font-medium capitalize">{deviceInfo.deviceType}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sistema</p>
                <p className="font-medium">{deviceInfo.os}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Navegador</p>
                <p className="font-medium">{deviceInfo.browser}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">Plataforma</p>
                <p className="font-medium">
                  {deviceInfo.isNative ? `App Nativo (${deviceInfo.platform})` : 'Web'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permissões */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Permissões do Dispositivo</CardTitle>
              <CardDescription>
                Gerencie as permissões necessárias para o funcionamento do app
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={checkAllPermissions}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {permissionsList.map(({ type, label, description }) => {
              const Icon = getPermissionIcon(type);
              const status = permissions[type];
              
              return (
                <div key={type} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-start gap-3 flex-1">
                    <Icon className={`h-5 w-5 mt-0.5 ${getPermissionColor(status)}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{label}</p>
                        {getPermissionBadge(status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                  </div>
                  {status !== 'granted' && status !== 'unsupported' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => requestPermission(type)}
                    >
                      Ativar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Dispositivos Ativos */}
      <Card>
        <CardHeader>
          <CardTitle>Dispositivos Conectados</CardTitle>
          <CardDescription>
            Dispositivos que têm acesso à sua conta
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDevices ? (
            <p className="text-center text-muted-foreground py-8">Carregando dispositivos...</p>
          ) : activeDevices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum dispositivo conectado</p>
          ) : (
            <div className="space-y-3">
              {activeDevices.map((device) => {
                const DeviceIcon = getDeviceIcon(device.device_type);
                const isCurrentDevice = device.device_id === deviceInfo?.deviceId;
                
                return (
                  <div key={device.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-start gap-3 flex-1">
                      <DeviceIcon className="h-5 w-5 mt-0.5 text-primary" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{device.device_name}</p>
                          {isCurrentDevice && (
                            <Badge variant="outline" className="text-xs">Este dispositivo</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {device.os} • {device.browser}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Último acesso: {device.last_active_at 
                            ? new Date(device.last_active_at).toLocaleString('pt-BR')
                            : 'Nunca'}
                        </p>
                      </div>
                    </div>
                    {!isCurrentDevice && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeDevice(device.device_id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

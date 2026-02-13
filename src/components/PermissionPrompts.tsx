import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, MapPin, Bell } from 'lucide-react';
import { useDevicePermissions } from '@/hooks/useDevicePermissions';
import { useContextualPermissions } from '@/hooks/useContextualPermissions';
import { useAuth } from '@/hooks/useAuth';

export const PermissionPrompts = () => {
  const { profile } = useAuth();
  const { permissions, requestPermission } = useDevicePermissions();
  const { shouldRequestLocation, shouldRequestNotifications, contextMessage } = useContextualPermissions();
  const [dismissed, setDismissed] = useState<string[]>([]);

  // Carregar permissões dismissadas do localStorage
  useEffect(() => {
    const stored = localStorage.getItem('dismissed_permissions');
    if (stored) {
      try {
        setDismissed(JSON.parse(stored));
      } catch {
        setDismissed([]);
      }
    }
  }, []);

  // Nunca mostrar prompts para usuários não logados
  if (!profile) {
    return null;
  }

  const handleDismiss = (type: string) => {
    const newDismissed = [...dismissed, type];
    setDismissed(newDismissed);
    localStorage.setItem('dismissed_permissions', JSON.stringify(newDismissed));
  };

  const handleRequest = async (type: 'location' | 'notifications') => {
    const granted = await requestPermission(type);
    if (granted) {
      handleDismiss(type);
    }
  };

  // Mostrar apenas se necessário baseado no contexto
  const shouldShowLocation = 
    shouldRequestLocation && 
    permissions.location === 'prompt' && 
    !dismissed.includes('location');
    
  const shouldShowNotifications = 
    shouldRequestNotifications && 
    permissions.notifications === 'prompt' && 
    !dismissed.includes('notifications');

  if (!shouldShowLocation && !shouldShowNotifications) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {shouldShowLocation && (
        <Alert className="bg-card border-primary/20">
          <MapPin className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <AlertTitle>Permissão de Localização</AlertTitle>
            <AlertDescription className="text-sm">
              {contextMessage.location || 'Para encontrar fretes próximos, precisamos acessar sua localização'}
            </AlertDescription>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => handleRequest('location')}
              >
                Permitir
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDismiss('location')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {shouldShowNotifications && (
        <Alert className="bg-card border-primary/20">
          <Bell className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <AlertTitle>Notificações</AlertTitle>
            <AlertDescription className="text-sm">
              Receba alertas sobre novos fretes e mensagens
            </AlertDescription>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => handleRequest('notifications')}
              >
                Permitir
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDismiss('notifications')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Alert>
      )}
    </div>
  );
};

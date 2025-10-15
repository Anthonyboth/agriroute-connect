import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Smartphone, AlertTriangle } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/hooks/useAuth';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose
}) => {
  const { profile } = useAuth();
  const { isSupported, isSubscribed, loading, subscribe, unsubscribe } = usePushNotifications();

  const handlePushToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Preferências de Notificação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Push Notifications */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <Label>Notificações Push</Label>
              </div>
              {isSupported ? (
                isSubscribed ? (
                  <Badge variant="default" className="bg-green-600">Ativado</Badge>
                ) : (
                  <Badge variant="secondary">Desativado</Badge>
                )
              ) : (
                <Badge variant="destructive">Não suportado</Badge>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground">
              Receba notificações no seu celular ou navegador mesmo quando o app estiver fechado
            </p>

            {!isSupported && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <p className="text-sm text-yellow-600">
                  Seu navegador não suporta notificações push. Tente usar Chrome, Firefox ou Edge.
                </p>
              </div>
            )}

            {isSupported && (
              <Button 
                onClick={handlePushToggle}
                disabled={loading}
                variant={isSubscribed ? "outline" : "default"}
                className="w-full"
              >
                {loading ? 'Processando...' : isSubscribed ? (
                  <>
                    <BellOff className="h-4 w-4 mr-2" />
                    Desativar Push
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    Ativar Push
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Tipos de Notificação</h4>
            <div className="space-y-3">
              <NotificationType 
                icon="🚚"
                label="Novos fretes disponíveis"
                enabled={true}
              />
              <NotificationType 
                icon="🔧"
                label="Novos serviços disponíveis"
                enabled={true}
              />
              <NotificationType 
                icon="📝"
                label="Propostas recebidas"
                enabled={true}
              />
              <NotificationType 
                icon="💬"
                label="Mensagens no chat"
                enabled={true}
              />
              <NotificationType 
                icon="💰"
                label="Pagamentos concluídos"
                enabled={true}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const NotificationType: React.FC<{ icon: string; label: string; enabled: boolean }> = ({
  icon,
  label,
  enabled
}) => (
  <div className="flex items-center justify-between">
    <Label htmlFor={label} className="flex items-center gap-2 cursor-pointer">
      <span>{icon}</span>
      <span className="text-sm">{label}</span>
    </Label>
    <Switch
      id={label}
      checked={enabled}
      disabled
    />
  </div>
);

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Bell, BellOff, Smartphone, AlertTriangle, Truck, Wrench, FileText, MessageCircle, DollarSign, Mail } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNotificationPreferences, NotificationPreferences } from '@/hooks/useNotificationPreferences';
import { cn } from '@/lib/utils';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose
}) => {
  const { isSupported, isSubscribed, loading, subscribe, unsubscribe } = usePushNotifications();
  const { preferences, loading: prefsLoading, saving, updatePreference } = useNotificationPreferences();

  const handlePushToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
      if (preferences) {
        await updatePreference('push_enabled', false);
      }
    } else {
      await subscribe();
      if (preferences) {
        await updatePreference('push_enabled', true);
      }
    }
  };

  const notificationTypes: Array<{
    key: keyof NotificationPreferences;
    icon: React.ElementType;
    label: string;
  }> = [
    { key: 'new_freights_enabled', icon: Truck, label: 'Novos fretes disponíveis' },
    { key: 'new_services_enabled', icon: Wrench, label: 'Novos serviços disponíveis' },
    { key: 'proposals_received_enabled', icon: FileText, label: 'Propostas recebidas' },
    { key: 'chat_messages_enabled', icon: MessageCircle, label: 'Mensagens no chat' },
    { key: 'payments_completed_enabled', icon: DollarSign, label: 'Pagamentos concluídos' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Bell className="h-6 w-6 text-primary" />
            Preferências de Notificação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Push Notifications Card */}
          <Card className="p-4 border-primary/20">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  <Label className="text-base font-semibold">Notificações Push</Label>
                </div>
                {isSupported ? (
                  isSubscribed ? (
                    <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                      Ativado
                    </Badge>
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
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-600">
                    Seu navegador não suporta notificações push. Tente usar Chrome, Firefox ou Edge.
                  </p>
                </div>
              )}

              {isSupported && (
                <Button 
                  onClick={handlePushToggle}
                  disabled={loading || saving}
                  className={cn(
                    "w-full h-12 text-base font-semibold transition-all duration-300 transform hover:scale-105",
                    isSubscribed 
                      ? "bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600" 
                      : "bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-700 shadow-lg hover:shadow-xl"
                  )}
                >
                  {loading || saving ? (
                    'Processando...'
                  ) : isSubscribed ? (
                    <>
                      <BellOff className="h-5 w-5 mr-2" />
                      Desativar Push
                    </>
                  ) : (
                    <>
                      <Bell className="h-5 w-5 mr-2 animate-pulse" />
                      Ativar Push
                    </>
                  )}
                </Button>
              )}
            </div>
          </Card>

          {/* Notification Types Card */}
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h4 className="text-base font-semibold">Tipos de Notificação</h4>
              </div>
              
              {prefsLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Carregando preferências...
                </div>
              ) : (
                <div className="space-y-3">
                  {notificationTypes.map(({ key, icon: Icon, label }) => (
                    <div 
                      key={key}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <Label htmlFor={`notif-${key}`} className="flex items-center gap-3 cursor-pointer flex-1">
                        <Icon className="h-5 w-5 text-primary" />
                        <span className="text-sm font-medium">{label}</span>
                      </Label>
                      <Switch
                        id={`notif-${key}`}
                        checked={preferences?.[key] || false}
                        onCheckedChange={(checked) => updatePreference(key, checked)}
                        disabled={saving}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Email Notifications */}
              <div className="border-t pt-3 mt-3">
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors">
                  <Label htmlFor="email-enabled" className="flex items-center gap-3 cursor-pointer flex-1">
                    <Mail className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">Notificações por email</span>
                  </Label>
                  <Switch
                    id="email-enabled"
                    checked={preferences?.email_enabled || false}
                    onCheckedChange={(checked) => updatePreference('email_enabled', checked)}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="min-w-[100px]"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};


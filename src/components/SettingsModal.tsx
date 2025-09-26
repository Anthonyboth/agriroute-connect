import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Bell, 
  Truck, 
  MapPin, 
  DollarSign, 
  Clock,
  Shield,
  Smartphone,
  Mail,
  Volume2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Notification Settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Driver Settings
  const [maxDistance, setMaxDistance] = useState([500]); // km
  const [autoAcceptBookings, setAutoAcceptBookings] = useState(false);
  const [availableServices, setAvailableServices] = useState({
    CARGA: true,
    GUINCHO: false,
    MUDANCA: false
  });

  // Producer Settings
  const [autoPublishFreights, setAutoPublishFreights] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);

  const handleSaveSettings = async () => {
    if (!profile) return;
    
    setLoading(true);
    try {
      // For now, just store settings locally or show success
      // In production, you would create a settings table or add a settings column
      
      toast({
        title: "Configurações salvas",
        description: "Suas configurações foram atualizadas com sucesso.",
      });

      onClose();
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: "Erro ao salvar configurações",
        description: "Não foi possível salvar as configurações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isDriver = profile?.role === 'MOTORISTA';
  const isProducer = profile?.role === 'PRODUTOR';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações
          </DialogTitle>
          <DialogDescription>
            Personalize sua experiência na plataforma
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="notifications" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="notifications">Notificações</TabsTrigger>
            {isDriver && <TabsTrigger value="driver">Motorista</TabsTrigger>}
            {isProducer && <TabsTrigger value="producer">Produtor</TabsTrigger>}
            <TabsTrigger value="account">Conta</TabsTrigger>
          </TabsList>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Preferências de Notificação
                </CardTitle>
                <CardDescription>
                  Configure como deseja receber notificações sobre fretes e atualizações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label>Notificações por E-mail</Label>
                      <p className="text-sm text-muted-foreground">
                        Receba atualizações por e-mail
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label>Notificações Push</Label>
                      <p className="text-sm text-muted-foreground">
                        Notificações instantâneas no aplicativo
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={pushNotifications}
                    onCheckedChange={setPushNotifications}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label>Som das Notificações</Label>
                      <p className="text-sm text-muted-foreground">
                        Reproduzir som ao receber notificações
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={soundEnabled}
                    onCheckedChange={setSoundEnabled}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Driver Settings Tab */}
          {isDriver && (
            <TabsContent value="driver" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Configurações do Motorista
                  </CardTitle>
                  <CardDescription>
                    Configure suas preferências para recebimento de fretes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label>Distância Máxima para Fretes</Label>
                    <div className="px-3">
                      <Slider
                        value={maxDistance}
                        onValueChange={setMaxDistance}
                        max={2000}
                        min={50}
                        step={50}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>50km</span>
                        <span className="font-medium">{maxDistance[0]}km</span>
                        <span>2000km</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Fretes além dessa distância não aparecerão para você
                    </p>
                  </div>

                  <div className="space-y-4">
                    <Label>Tipos de Serviço Disponíveis</Label>
                    <div className="space-y-3">
                      {Object.entries(availableServices).map(([service, enabled]) => (
                        <div key={service} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {service === 'CARGA' && <Truck className="h-4 w-4" />}
                            {service === 'GUINCHO' && <Shield className="h-4 w-4" />}
                            {service === 'MUDANCA' && <MapPin className="h-4 w-4" />}
                            <span>
                              {service === 'CARGA' ? 'Transporte de Cargas' :
                               service === 'GUINCHO' ? 'Serviços de Guincho' :
                               'Mudanças e Fretes Urbanos'}
                            </span>
                          </div>
                          <Switch
                            checked={enabled}
                            onCheckedChange={(checked) => 
                              setAvailableServices(prev => ({
                                ...prev,
                                [service]: checked
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Producer Settings Tab */}
          {isProducer && (
            <TabsContent value="producer" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Configurações do Produtor
                  </CardTitle>
                  <CardDescription>
                    Configure suas preferências para publicação de fretes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Alertas de Preço</Label>
                      <p className="text-sm text-muted-foreground">
                        Receba notificações sobre variações de preço no mercado
                      </p>
                    </div>
                    <Switch
                      checked={priceAlerts}
                      onCheckedChange={setPriceAlerts}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Publicação Automática</Label>
                      <p className="text-sm text-muted-foreground">
                        Publicar automaticamente fretes recorrentes
                      </p>
                    </div>
                    <Switch
                      checked={autoPublishFreights}
                      onCheckedChange={setAutoPublishFreights}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Account Settings Tab */}
          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Segurança da Conta
                </CardTitle>
                <CardDescription>
                  Configurações de segurança e privacidade
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Autenticação de Dois Fatores</p>
                    <p className="text-sm text-muted-foreground">
                      Adicione uma camada extra de segurança
                    </p>
                  </div>
                  <Badge variant="outline">Em breve</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Histórico de Login</p>
                    <p className="text-sm text-muted-foreground">
                      Visualize seus acessos recentes
                    </p>
                  </div>
                  <Button variant="outline" size="sm">Ver Histórico</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-6 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSaveSettings} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
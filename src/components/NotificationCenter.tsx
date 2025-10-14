import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Check, CheckCheck, Info, AlertTriangle, TrendingUp, Truck, DollarSign, CreditCard, MessageSquare, Star, Package, ChevronRight, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { FreightRatingModal } from './FreightRatingModal';
import { Skeleton } from '@/components/ui/skeleton';
import { queryWithTimeout } from '@/lib/query-utils';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  data?: any;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose
}) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [selectedFreightId, setSelectedFreightId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && profile) {
      fetchNotifications();
    }
  }, [isOpen, profile]);

  const fetchNotifications = async () => {
    if (!profile) return;

    setLoading(true);
    setError(null);
    
    try {
      console.log('[NotificationCenter] Iniciando busca de notificações...');
      
      const result = await queryWithTimeout(
        async () => {
          const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(50);
          
          if (error) throw error;
          return data;
        },
        { 
          timeoutMs: 10000, 
          operationName: 'fetchNotifications',
          retries: 1,
          retryDelayMs: 2000
        }
      );
      
      console.log(`[NotificationCenter] ${result?.length || 0} notificações carregadas`);
      setNotifications(result || []);
    } catch (error: any) {
      console.error('[NotificationCenter] Erro ao carregar:', error);
      
      const errorMessage = error.message?.includes('Timeout') || error.message?.includes('demorou muito')
        ? 'A busca demorou muito. Verifique sua conexão.'
        : 'Não foi possível carregar as notificações.';
      
      setError(errorMessage);
      
      toast({
        title: "Erro ao carregar notificações",
        description: errorMessage + " Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, read: true } 
            : notif
        )
      );
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getDashboardRoute = (role?: string) => {
    switch (role) {
      case 'driver':
        return '/dashboard/driver';
      case 'producer':
        return '/dashboard/producer';
      case 'service_provider':
        return '/dashboard/service-provider';
      default:
        return '/';
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Marcar como lida
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    const { type, data } = notification;
    
    // Lógica de navegação baseada no tipo
    switch (type) {
      case 'rating_pending':
        if (data?.freight_id) {
          setSelectedFreightId(data.freight_id);
          setRatingModalOpen(true);
          onClose();
        }
        break;
        
      case 'freight_accepted':
      case 'proposal_received':
      case 'advance_request':
      case 'advance_approved':
      case 'advance_rejected':
      case 'delivery_confirmation_required':
      case 'checkin_confirmation_required':
      case 'freight_in_transit':
      case 'freight_created':
      case 'external_payment_proposed':
        if (data?.freight_id) {
          onClose();
          const dashboardRoute = getDashboardRoute(profile?.role);
          navigate(dashboardRoute, { 
            state: { 
              openFreightId: data.freight_id,
              notificationType: type 
            } 
          });
        }
        break;
        
      case 'chat_message':
        if (data?.freight_id) {
          onClose();
          const dashboardRoute = getDashboardRoute(profile?.role);
          navigate(dashboardRoute, { 
            state: { 
              openChatFreightId: data.freight_id 
            } 
          });
        }
        break;
        
      case 'service_chat_message':
        if (data?.service_request_id) {
          onClose();
          navigate('/dashboard/service-provider', {
            state: {
              openServiceChat: data.service_request_id
            }
          });
        }
        break;
        
      case 'payment_completed':
      case 'payment_confirmation':
        onClose();
        const dashboardRoute = getDashboardRoute(profile?.role);
        navigate(dashboardRoute, {
          state: {
            openPaymentHistory: true
          }
        });
        break;
        
      // Para notificações genéricas, apenas marca como lida
      case 'info':
      case 'warning':
      case 'success':
      case 'error':
      default:
        // Apenas marca como lida, sem navegação
        break;
    }
  };

  const isActionableNotification = (type: string) => {
    const actionableTypes = [
      'rating_pending',
      'freight_accepted',
      'proposal_received',
      'advance_request',
      'advance_approved',
      'advance_rejected',
      'delivery_confirmation_required',
      'checkin_confirmation_required',
      'freight_in_transit',
      'freight_created',
      'external_payment_proposed',
      'chat_message',
      'service_chat_message',
      'payment_completed',
      'payment_confirmation'
    ];
    return actionableTypes.includes(type);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'advance_request':
        return <DollarSign className="h-5 w-5 text-blue-600" />;
      case 'advance_approved':
        return <CheckCheck className="h-5 w-5 text-green-600" />;
      case 'freight_created':
        return <Truck className="h-5 w-5 text-orange-600" />;
      case 'freight_accepted':
        return <Check className="h-5 w-5 text-green-600" />;
      case 'payment_completed':
        return <CreditCard className="h-5 w-5 text-emerald-600" />;
      case 'chat_message':
      case 'service_chat_message':
        return <MessageSquare className="h-5 w-5 text-blue-600" />;
      case 'proposal_received':
        return <Package className="h-5 w-5 text-purple-600" />;
      case 'freight_in_transit':
        return <TrendingUp className="h-5 w-5 text-orange-600" />;
      case 'delivery_confirmation_required':
      case 'checkin_confirmation_required':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'rating_pending':
        return <Star className="h-5 w-5 text-amber-600" />;
      case 'external_payment_proposed':
        return <DollarSign className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'success':
        return <Check className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 0) {
      return `${days} dia${days > 1 ? 's' : ''} atrás`;
    } else if (hours > 0) {
      return `${hours} hora${hours > 1 ? 's' : ''} atrás`;
    } else if (minutes > 0) {
      return `${minutes} minuto${minutes > 1 ? 's' : ''} atrás`;
    } else {
      return 'Agora mesmo';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Central de Notificações
          </DialogTitle>
          <DialogDescription>
            Acompanhe todas as atualizações importantes sobre seus fretes e atividades.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map(i => (
                <Card key={i} className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 px-4">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchNotifications} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma notificação encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <Card 
                  key={notification.id}
                  className={`cursor-pointer transition-all hover:scale-[1.01] ${
                    !notification.read 
                      ? 'bg-primary/5 border-primary/20' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={`font-medium text-sm ${
                            !notification.read ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {notification.title}
                          </h4>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(notification.created_at)}
                            </span>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-primary rounded-full"></div>
                            )}
                          </div>
                        </div>
                        
                        <p className={`text-sm mt-1 ${
                          !notification.read ? 'text-foreground' : 'text-muted-foreground'
                        }`}>
                          {notification.message}
                        </p>
                      </div>

                      {isActionableNotification(notification.type) && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>

      {ratingModalOpen && selectedFreightId && (
        <FreightRatingModal
          isOpen={ratingModalOpen}
          onClose={() => {
            setRatingModalOpen(false);
            setSelectedFreightId(null);
          }}
          freightId={selectedFreightId}
          userRole={profile?.role === 'MOTORISTA' ? 'MOTORISTA' : 'PRODUTOR'}
          onRatingSubmitted={() => {
            setRatingModalOpen(false);
            setSelectedFreightId(null);
            fetchNotifications();
          }}
        />
      )}
    </Dialog>
  );
};
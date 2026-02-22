import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Check, CheckCheck, Info, AlertTriangle, Truck, DollarSign, CreditCard, MessageSquare, Star, Package, ChevronRight, RefreshCw, Filter, MailCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useGlobalRating } from '@/contexts/RatingContext';
import { useNotificationNavigation } from '@/hooks/useNotificationNavigation';
import { Skeleton } from '@/components/ui/skeleton';
import { queryWithTimeout } from '@/lib/query-utils';
import { NotificationSound } from './NotificationSound';

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
  const { navigateTo, getDashboardRoute } = useNotificationNavigation();
  const { openServiceRating, openFreightRating } = useGlobalRating();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const markAllAsRead = async () => {
    if (!profile || unreadCount === 0) return;
    
    setMarkingAllRead(true);
    try {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', unreadIds);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true }))
      );
      
      toast({
        title: "Todas marcadas como lidas",
        description: `${unreadIds.length} notificações marcadas como lidas`,
      });
    } catch (error: any) {
      console.error('Error marking all as read:', error);
      toast({
        title: "Erro",
        description: "Não foi possível marcar todas como lidas",
        variant: "destructive",
      });
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    const { type, data } = notification;
    
    // Ratings need special handling (open modal, not navigate)
    if (type === 'rating_pending' && data?.freight_id && data?.rated_user_id) {
      const { data: ratedProfile } = await supabase
        .from('profiles_secure')
        .select('full_name')
        .eq('id', data.rated_user_id)
        .single();
      
      openFreightRating(data.freight_id, data.rated_user_id, ratedProfile?.full_name);
      onClose();
      return;
    }
    
    if (type === 'service_rating_pending' && data?.service_request_id && data?.rated_user_id) {
      const { data: serviceData } = await supabase
        .from('service_requests')
        .select('service_type')
        .eq('id', data.service_request_id)
        .single();
      
      const { data: ratedProfile } = await supabase
        .from('profiles_secure')
        .select('full_name')
        .eq('id', data.rated_user_id)
        .single();
      
      openServiceRating(
        data.service_request_id, 
        data.rated_user_id, 
        ratedProfile?.full_name,
        serviceData?.service_type
      );
      onClose();
      return;
    }

    // For delivery confirmations, fetch freight data before navigating
    if ((type === 'delivery_confirmation_required' || type === 'freight_delivery_reported') && data?.freight_id) {
      onClose();
      const { data: freightData } = await supabase
        .from('freights')
        .select(`
          *,
          driver_profiles:profiles!left(freights_driver_id_fkey)(
            id, full_name, contact_phone, email, role
          )
        `)
        .eq('id', data.freight_id)
        .single();
      
      const dashboardRoute = getDashboardRoute(profile?.role);
      navigateTo(type, { ...data, freightData }, () => onClose());
      return;
    }
    
    // Use centralized navigation for all other types
    const navigated = navigateTo(type, data, () => onClose());
    if (!navigated) {
      // Fallback: just close the notification center
      onClose();
    }
  };

  const isActionableNotification = (type: string) => {
    const actionableTypes = [
      'rating_pending',
      'service_rating_pending',
      'freight_accepted',
      'proposal_received',
      'advance_request',
      'advance_approved',
      'advance_rejected',
      'delivery_confirmation_required',
      'freight_delivery_reported',
      'checkin_confirmation_required',
      'freight_in_transit',
      'freight_created',
      'external_payment_proposed',
      'external_payment_paid',
      'payment_paid_by_producer',
      'chat_message',
      'service_chat_message',
      'payment_completed',
      'payment_confirmation',
      'proposal_chat_message',
      'company_new_proposal',
      'company_freight_status_change',
      'company_driver_assignment',
      'company_delivery_confirmation',
      'vehicle_assignment_created',
      'vehicle_assignment_removed'
    ];
    return actionableTypes.includes(type);
  };

  const getNotificationIcon = (type: string) => {
    const iconClass = "h-5 w-5";
    switch (type) {
      case 'rating_pending':
      case 'service_rating_pending':
        return <Star className={`${iconClass} text-yellow-500`} />;
      case 'freight_accepted':
      case 'freight_in_transit':
      case 'freight_created':
      case 'company_freight_status_change':
        return <Truck className={`${iconClass} text-blue-500`} />;
      case 'proposal_received':
      case 'company_new_proposal':
        return <Package className={`${iconClass} text-purple-500`} />;
      case 'chat_message':
      case 'service_chat_message':
      case 'proposal_chat_message':
        return <MessageSquare className={`${iconClass} text-green-500`} />;
      case 'payment_completed':
      case 'payment_confirmation':
        return <DollarSign className={`${iconClass} text-green-600`} />;
      case 'advance_request':
      case 'advance_approved':
        return <CreditCard className={`${iconClass} text-indigo-500`} />;
      case 'delivery_confirmation_required':
      case 'checkin_confirmation_required':
      case 'company_delivery_confirmation':
        return <CheckCheck className={`${iconClass} text-orange-500`} />;
      case 'company_driver_assignment':
        return <Truck className={`${iconClass} text-indigo-500`} />;
      case 'vehicle_assignment_created':
      case 'vehicle_assignment_removed':
        return <Truck className={`${iconClass} text-purple-500`} />;
      case 'warning':
        return <AlertTriangle className={`${iconClass} text-yellow-600`} />;
      case 'success':
        return <Check className={`${iconClass} text-green-500`} />;
      case 'error':
        return <AlertTriangle className={`${iconClass} text-red-500`} />;
      case 'info':
      default:
        return <Info className={`${iconClass} text-blue-500`} />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit'
    });
  };

  const getDateGroup = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    
    if (date >= today) return 'Hoje';
    if (date >= yesterday) return 'Ontem';
    if (date >= weekAgo) return 'Esta semana';
    return 'Anteriores';
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const groupedNotifications = useMemo(() => {
    return {
      proposals: notifications.filter(n => 
        n.type.includes('proposal') || n.type === 'advance_request'
      ),
      freights: notifications.filter(n => 
        n.type.includes('freight') || n.type.includes('delivery') || n.type.includes('checkin')
      ),
      payments: notifications.filter(n => 
        n.type.includes('payment') || n.type.includes('advance_approved')
      ),
      chat: notifications.filter(n => 
        n.type.includes('chat') || n.type.includes('message')
      ),
      ratings: notifications.filter(n => 
        n.type.includes('rating')
      ),
      other: notifications.filter(n => 
        !n.type.includes('proposal') && 
        !n.type.includes('freight') && 
        !n.type.includes('payment') && 
        !n.type.includes('chat') && 
        !n.type.includes('rating') &&
        !n.type.includes('advance') &&
        !n.type.includes('delivery') &&
        !n.type.includes('checkin') &&
        !n.type.includes('message')
      )
    };
  }, [notifications]);

  // Group notifications by date
  const notificationsByDate = useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    notifications.forEach(n => {
      const group = getDateGroup(n.created_at);
      if (!groups[group]) groups[group] = [];
      groups[group].push(n);
    });
    return groups;
  }, [notifications]);

  const renderNotificationCard = (notification: Notification) => (
    <div
      key={notification.id}
      className={`group p-3 rounded-lg border transition-all duration-200 cursor-pointer relative z-10 touch-manipulation ${
        !notification.read 
          ? 'bg-primary/5 border-primary/20 hover:bg-primary/10 active:bg-primary/15' 
          : 'bg-card border-border/50 hover:bg-muted/50 active:bg-muted/70'
      } ${isActionableNotification(notification.type) ? 'hover:shadow-sm' : ''}`}
      onClick={() => handleNotificationClick(notification)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNotificationClick(notification);
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 p-2 rounded-full ${
          !notification.read ? 'bg-primary/10' : 'bg-muted'
        }`}>
          {getNotificationIcon(notification.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={`text-sm font-medium leading-tight ${
              !notification.read ? 'text-foreground' : 'text-muted-foreground'
            }`}>
              {notification.title}
            </h4>
            
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[11px] text-muted-foreground">
                {formatDate(notification.created_at)}
              </span>
              {!notification.read && (
                <div className="w-2 h-2 bg-primary rounded-full" />
              )}
            </div>
          </div>
          
          <p className={`text-sm mt-0.5 line-clamp-2 ${
            !notification.read ? 'text-foreground/80' : 'text-muted-foreground'
          }`}>
            {notification.message}
          </p>
          
          {isActionableNotification(notification.type) && (
            <button 
              className="flex items-center gap-1 mt-2 text-primary hover:text-primary/80 active:text-primary/60 touch-manipulation"
              onClick={(e) => {
                e.stopPropagation();
                handleNotificationClick(notification);
              }}
            >
              <span className="text-xs font-medium">Ver detalhes</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderNotificationList = (notifs: Notification[], showDateGroups = false) => {
    if (notifs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-full bg-muted/50 mb-4">
            <Bell className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Nenhuma notificação</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Você está em dia!</p>
        </div>
      );
    }

    if (showDateGroups) {
      const groups = ['Hoje', 'Ontem', 'Esta semana', 'Anteriores'];
      return (
        <div className="space-y-4">
          {groups.map(group => {
            const groupNotifs = notificationsByDate[group];
            if (!groupNotifs || groupNotifs.length === 0) return null;
            
            return (
              <div key={group}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {group}
                  </span>
                  <div className="flex-1 h-px bg-border/50" />
                </div>
                <div className="space-y-2">
                  {groupNotifs.map(renderNotificationCard)}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {notifs.map(renderNotificationCard)}
      </div>
    );
  };

  return (
    <>
      <NotificationSound unreadCount={unreadCount} />
      
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent 
          className="sm:max-w-lg max-h-[85vh] p-0 gap-0 overflow-hidden"
          hideCloseButton={true}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Bell className="h-5 w-5 text-primary" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 h-4 min-w-4 px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="text-base font-semibold">Notificações</h2>
                  <p className="text-xs text-muted-foreground">
                    {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Todas lidas'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={markAllAsRead}
                    disabled={markingAllRead}
                    className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90"
                  >
                    <MailCheck className={`h-3.5 w-3.5 ${markingAllRead ? 'animate-pulse' : ''}`} />
                    Marcar todas lidas
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fetchNotifications}
                  disabled={loading}
                  className="h-8 w-8"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="all" className="flex-1 flex flex-col">
            <div className="px-4 pt-3 overflow-x-auto">
              <TabsList className="inline-flex w-auto min-w-full h-9 p-1 gap-1">
                <TabsTrigger 
                  value="all" 
                  className="flex-1 min-w-[60px] text-xs px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Todas
                </TabsTrigger>
                <TabsTrigger 
                  value="proposals" 
                  className="flex-1 min-w-[80px] text-xs px-2"
                >
                  <Package className="h-3 w-3 mr-1 flex-shrink-0" />
                  <span className="whitespace-nowrap">Propostas</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="freights" 
                  className="flex-1 min-w-[60px] text-xs px-2"
                >
                  <Truck className="h-3 w-3 mr-1 flex-shrink-0" />
                  <span className="whitespace-nowrap">Fretes</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="payments" 
                  className="flex-1 min-w-[80px] text-xs px-2"
                >
                  <DollarSign className="h-3 w-3 mr-1 flex-shrink-0" />
                  <span className="whitespace-nowrap">Pagamentos</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="all" className="m-0 h-full">
                <ScrollArea className="h-[50vh] max-h-[400px] px-4 py-3">
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="p-3 rounded-lg border bg-card">
                          <div className="flex gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-3 w-full" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
                      <p className="text-sm text-muted-foreground">{error}</p>
                      <Button variant="outline" size="sm" onClick={fetchNotifications} className="mt-3">
                        Tentar novamente
                      </Button>
                    </div>
                  ) : (
                    renderNotificationList(notifications, true)
                  )}
                </ScrollArea>
              </TabsContent>

              {['proposals', 'freights', 'payments'].map((group) => (
                <TabsContent key={group} value={group} className="m-0 h-full">
                  <ScrollArea className="h-[50vh] max-h-[400px] px-4 py-3">
                    {renderNotificationList(groupedNotifications[group as keyof typeof groupedNotifications])}
                  </ScrollArea>
                </TabsContent>
              ))}
            </div>
          </Tabs>

          {/* Footer */}
          <div className="px-4 py-3 border-t bg-muted/20">
            <Button variant="outline" onClick={onClose} className="w-full">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

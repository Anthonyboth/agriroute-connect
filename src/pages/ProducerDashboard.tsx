import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/ui/stats-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FreightCard } from '@/components/FreightCard';
import CreateFreightModal from '@/components/CreateFreightModal';
import { EditFreightModal } from '@/components/EditFreightModal';
import { ScheduledFreightsManager } from '@/components/ScheduledFreightsManager';
import { SubscriptionExpiryNotification } from '@/components/SubscriptionExpiryNotification';
import FreightLimitTracker from '@/components/FreightLimitTracker';
import { ProposalCounterModal } from '@/components/ProposalCounterModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FreightStatusTracker } from '@/components/FreightStatusTracker';
import FreightCheckinsViewer from '@/components/FreightCheckinsViewer';
import { FreightTrackingPanel } from '@/components/FreightTrackingPanel';
import { FreightDetails } from '@/components/FreightDetails';
import { DeliveryConfirmationModal } from '@/components/DeliveryConfirmationModal';

import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { getProposalStatusLabel, getFreightStatusLabel } from '@/lib/freight-status';
import { getUrgencyLabel, getUrgencyVariant } from '@/lib/urgency-labels';
import { toast } from 'sonner';
import { MapPin, TrendingUp, Truck, Clock, CheckCircle, Plus, Settings, Play, DollarSign, Package, Calendar, Eye, Users, Phone, CreditCard, X, AlertTriangle, Star, MessageCircle } from 'lucide-react';
import { Wrench } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { PendingRatingsPanel } from '@/components/PendingRatingsPanel';
import { ServicesModal } from '@/components/ServicesModal';
import { UnifiedHistory } from '@/components/UnifiedHistory';
import heroLogistics from '@/assets/hero-logistics-optimized.webp';
import { showErrorToast } from '@/lib/error-handler';
import { SystemAnnouncementModal } from '@/components/SystemAnnouncementModal';
import { useAutoRating } from '@/hooks/useAutoRating';
import { AutoRatingModal } from '@/components/AutoRatingModal';
import { FreightProposalsManager } from '@/components/FreightProposalsManager';
import { UnifiedChatHub } from '@/components/UnifiedChatHub';
import { useUnreadChatsCount } from '@/hooks/useUnifiedChats';

const ProducerDashboard = () => {
  const { profile, hasMultipleProfiles, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect non-producers to their correct dashboard
  React.useEffect(() => {
    if (profile?.role === 'MOTORISTA') {
      navigate('/dashboard/driver', { replace: true });
      return;
    }
    if (profile?.role === 'PRESTADOR_SERVICOS') {
      navigate('/dashboard/service-provider', { replace: true });
      return;
    }
    if (profile?.role && profile.role !== 'PRODUTOR') {
      const correctRoute = profile.role === 'ADMIN' ? '/admin' : '/';
      navigate(correctRoute, { replace: true });
      return;
    }
  }, [profile?.role, navigate]);
  const [freights, setFreights] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('open');
  const [loading, setLoading] = useState(true);
  const [counterProposalModalOpen, setCounterProposalModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [editFreightModalOpen, setEditFreightModalOpen] = useState(false);
  const [selectedFreight, setSelectedFreight] = useState<any>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [freightToCancel, setFreightToCancel] = useState<any>(null);
  const [selectedTrackingFreight, setSelectedTrackingFreight] = useState<any>(null);
  const [selectedFreightDetails, setSelectedFreightDetails] = useState<any>(null);
  const [deliveryConfirmationModal, setDeliveryConfirmationModal] = useState(false);
  const [freightToConfirm, setFreightToConfirm] = useState<any>(null);
  const [externalPayments, setExternalPayments] = useState<any[]>([]);
  const [freightPayments, setFreightPayments] = useState<any[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [servicesModalOpen, setServicesModalOpen] = useState(false);
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  
  // Estado para controlar avaliações automáticas
  const [activeFreightForRating, setActiveFreightForRating] = useState<any>(null);

  // Contador de mensagens não lidas
  const { unreadCount: chatUnreadCount } = useUnreadChatsCount(
    profile?.id || '', 
    'PRODUTOR'
  );

  // Buscar fretes - otimizado e resiliente
  const fetchFreights = useCallback(async () => {
    // Don't fetch if user is not a producer
    if (!profile?.id || profile.role !== 'PRODUTOR') {
      console.log('fetchFreights: Não executando - Profile não é produtor:', profile);
      return;
    }

    console.log('fetchFreights: Iniciando busca para produtor ID:', profile.id);

    try {
      // ✅ Query simplificada sem joins para evitar falhas de RLS
      const { data, error } = await supabase
        .from('freights')
        .select('*')
        .eq('producer_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(100);

      console.log('fetchFreights: Resposta da query:', { data, error, count: data?.length });
      
      if (error) {
        console.error('fetchFreights: ❌ Erro na query:', error);
        toast.error('Erro ao carregar fretes');
        showErrorToast(toast, 'Erro ao carregar fretes', error);
        return;
      }

      // ✅ Se vazio, fazer HEAD count para debug
      if (!data || data.length === 0) {
        console.warn('fetchFreights: ⚠️ Nenhum frete retornado. Verificando count...');
        
        const { count, error: countError } = await supabase
          .from('freights')
          .select('id', { count: 'exact', head: true })
          .eq('producer_id', profile.id);

        console.log('fetchFreights: HEAD count result:', { count, countError });
        
        if (countError) {
          console.error('fetchFreights: ❌ Erro ao buscar count:', countError);
        } else if (count === 0) {
          console.log('fetchFreights: ✅ Confirmado: produtor não tem fretes cadastrados');
        } else {
          console.error('fetchFreights: 🔥 CRÍTICO: count=' + count + ' mas SELECT retornou 0. Problema de RLS ou query!');
        }
        
        setFreights([]);
        return;
      }
      
      const freightData = data || [];
      
      // ✅ Logs detalhados por status
      const openFreights = freightData.filter(f => f.status === 'OPEN');
      console.log('fetchFreights: ✅ Fretes encontrados por status:', {
        OPEN: openFreights.length,
        OPEN_IDs: openFreights.map(f => f.id),
        ACCEPTED: freightData.filter(f => f.status === 'ACCEPTED').length,
        IN_TRANSIT: freightData.filter(f => f.status === 'IN_TRANSIT').length,
        DELIVERED_PENDING_CONFIRMATION: freightData.filter(f => f.status === 'DELIVERED_PENDING_CONFIRMATION').length,
        DELIVERED: freightData.filter(f => f.status === 'DELIVERED').length,
        total: freightData.length,
        allStatuses: freightData.map(f => f.status)
      });
      
      setFreights(freightData);
    } catch (error) {
      console.error('fetchFreights: ❌ Erro fatal:', error);
      toast.error('Erro ao carregar fretes');
      showErrorToast(toast, 'Erro ao carregar fretes', error);
    }
  }, [profile?.id, profile?.role]);

  // Buscar propostas - otimizado
  const fetchProposals = useCallback(async () => {
    // Don't fetch if user is not a producer
    if (!profile?.id || profile.role !== 'PRODUTOR') {
      console.log('fetchProposals: Não executando - Profile não é produtor:', profile);
      return;
    }

    console.log('fetchProposals: Iniciando busca para produtor ID:', profile.id);

    try {
      // First get freight IDs for this producer
      const { data: producerFreights, error: freightError } = await supabase
        .from('freights')
        .select('id')
        .eq('producer_id', profile.id);

      console.log('fetchProposals: Fretes do produtor:', { producerFreights, freightError });

      if (freightError) throw freightError;

      if (!producerFreights || producerFreights.length === 0) {
        console.log('fetchProposals: Nenhum frete encontrado para o produtor');
        setProposals([]);
        return;
      }

      const freightIds = producerFreights.map(f => f.id);
      console.log('fetchProposals: IDs dos fretes:', freightIds);

      // Then get proposals for those freights
      const { data, error } = await supabase
        .from('freight_proposals')
        .select(`
          *,
          freight:freights(*),
          driver:profiles!freight_proposals_driver_id_fkey(*)
        `)
        .in('freight_id', freightIds)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(50);

      console.log('fetchProposals: Resposta da query de propostas:', { data, error, count: data?.length });

      if (error) throw error;
      setProposals(data || []);
    } catch (error) {
      console.error('fetchProposals: Error:', error);
      toast.error('Erro ao carregar propostas');
    }
  }, [profile?.id, profile?.role]);

  // Buscar pagamentos externos
  const fetchExternalPayments = useCallback(async () => {
    if (!profile?.id || profile.role !== 'PRODUTOR') {
      console.log('fetchExternalPayments: Não executando - Profile não é produtor:', profile);
      return;
    }

    console.log('fetchExternalPayments: Iniciando busca para produtor ID:', profile.id);

    try {
      const { data, error } = await supabase
        .from('external_payments')
        .select('*')
        .eq('producer_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('fetchExternalPayments: Erro na query:', error);
        throw error;
      }

      const paymentsData = data || [];
      
      setExternalPayments(paymentsData);
    } catch (error) {
      console.error('fetchExternalPayments: Error:', error);
      toast.error('Erro ao carregar pagamentos');
    }
  }, [profile?.id, profile?.role]);

  // Buscar pagamentos de fretes
  const fetchFreightPayments = useCallback(async () => {
    if (!profile?.id || profile.role !== 'PRODUTOR') {
      console.log('fetchFreightPayments: Não executando - Profile não é produtor:', profile);
      return;
    }

    console.log('fetchFreightPayments: Iniciando busca para produtor ID:', profile.id);

    try {
      const { data, error } = await (supabase as any)
        .from('freight_payments')
        .select('*')
        .eq('payer_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('fetchFreightPayments: Erro na query:', error);
        throw error;
      }

      const paymentsData = data || [];
      
      setFreightPayments(paymentsData);
    } catch (error) {
      console.error('fetchFreightPayments: Error:', error);
      toast.error('Erro ao carregar pagamentos de fretes');
    }
  }, [profile?.id, profile?.role]);

  // Buscar solicitações de serviço
  const fetchServiceRequests = useCallback(async () => {
    if (!profile?.id || profile.role !== 'PRODUTOR') {
      console.log('fetchServiceRequests: Não executando - Profile não é produtor:', profile);
      return;
    }

    console.log('fetchServiceRequests: Iniciando busca para produtor ID:', profile.id);

    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('client_id', profile.id)
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false })
        .limit(100);

      console.log('fetchServiceRequests: Resposta da query:', { data, error, count: data?.length });
      
      if (error) {
        console.error('fetchServiceRequests: Erro na query:', error);
        throw error;
      }
      
      const serviceData = data || [];
      console.log('fetchServiceRequests: Serviços encontrados por status:', {
        OPEN: serviceData.filter(s => s.status === 'OPEN').length,
        ACCEPTED: serviceData.filter(s => s.status === 'ACCEPTED').length,
        IN_PROGRESS: serviceData.filter(s => s.status === 'IN_PROGRESS').length,
        COMPLETED: serviceData.filter(s => s.status === 'COMPLETED').length,
        total: serviceData.length
      });
      
      setServiceRequests(serviceData);
    } catch (error) {
      console.error('fetchServiceRequests: Error:', error);
      toast.error('Erro ao carregar serviços');
    }
  }, [profile?.id, profile?.role]);

  // Listener para redirecionar para histórico quando frete for movido
  useEffect(() => {
    const handleMovedToHistory = () => {
      setActiveTab('history');
      setSelectedFreightDetails(null);
      // Recarregar dados
      fetchFreights();
    };
    
    window.addEventListener('freight:movedToHistory', handleMovedToHistory);
    return () => window.removeEventListener('freight:movedToHistory', handleMovedToHistory);
  }, [fetchFreights]);

  // Carregar dados - otimizado
  useEffect(() => {
    console.log('useEffect loadData executado. Profile:', profile);
    
    const loadData = async () => {
      // Forçar execução mesmo sem profile para debug
      console.log('loadData: Forçando execução. Profile disponível:', !!profile?.id, 'Role:', profile?.role);
      
      if (!profile?.id) {
        console.log('loadData: Profile não está disponível ainda, aguardando...');
        return;
      }

      if (profile.role !== 'PRODUTOR') {
        console.log('loadData: Usuário não é produtor, role:', profile.role);
        return;
      }

      console.log('loadData: Executando fetchFreights, fetchProposals e fetchExternalPayments para:', profile.id);
      setLoading(true);
      
      try {
        // Executar as funções em paralelo
        await Promise.all([
          fetchFreights(),
          fetchProposals(),
          fetchExternalPayments(),
          fetchFreightPayments(),
          fetchServiceRequests()
        ]);
      } catch (error) {
        console.error('loadData: Erro no carregamento:', error);
      } finally {
        setLoading(false);
      }
    };

    // Executar imediatamente se profile estiver disponível
    if (profile?.id && profile?.role === 'PRODUTOR') {
      console.log('loadData: Profile disponível, executando imediatamente');
      loadData();
    }
  }, [profile?.id, profile?.role]);

  // Abrir frete automaticamente quando vem de notificação
  useEffect(() => {
    const state = location.state as any;
    if (!state || !profile?.id || !freights.length) return;
    
    // Aceitar tanto openFreightId quanto openChatFreightId
    const freightId = state.openFreightId || state.openChatFreightId;
    if (freightId) {
      const freight = freights.find(f => f.id === freightId);
      if (freight) {
        setSelectedFreightDetails(freight);
      }
      // Limpar state
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, profile?.id, freights, navigate, location.pathname]);


  // Atualização em tempo real
  useEffect(() => {
    if (!profile?.id) return;
    
    console.log('Configurando realtime para produtor:', profile.id);
    
    // Canal para monitorar mudanças de status e disparar avaliação
    const ratingChannel = supabase
      .channel('producer-rating-trigger')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'freights',
        filter: `producer_id=eq.${profile.id}`
      }, async (payload) => {
        const newStatus = payload.new.status;
        const oldStatus = payload.old?.status;

        // Se mudou para DELIVERED, produtor avalia motorista
        if (newStatus === 'DELIVERED' && oldStatus !== 'DELIVERED') {
          const { data: freightData } = await supabase
            .from('freights')
            .select(`
              *,
              driver:profiles!freights_driver_id_fkey(id, full_name, role)
            `)
            .eq('id', payload.new.id)
            .single();

          if (freightData?.driver) {
            const { data: existingRating } = await supabase
              .from('ratings')
              .select('id')
              .eq('freight_id', freightData.id)
              .eq('rater_user_id', profile.id)
              .maybeSingle();

            if (!existingRating) {
              setActiveFreightForRating(freightData);
            }
          }
        }
      })
      .subscribe();
    
    const channel = supabase
      .channel('realtime-freights-producer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freights' }, (payload) => {
        console.log('Mudança em freights detectada:', payload);
        fetchFreights();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_proposals' }, (payload) => {
        console.log('Mudança em propostas detectada:', payload);
        fetchProposals();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'external_payments' }, (payload) => {
        console.log('Mudança em pagamentos externos detectada:', payload);
        fetchExternalPayments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_payments' }, (payload) => {
        console.log('Mudança em pagamentos de fretes detectada:', payload);
        fetchFreightPayments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, (payload) => {
        console.log('Mudança em service_requests detectada:', payload);
        fetchServiceRequests();
      })
      .subscribe();

    return () => {
      console.log('Removendo canal realtime');
      supabase.removeChannel(ratingChannel);
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const handleAcceptProposal = async (proposalId: string) => {
    try {
      if (!profile?.id) {
        toast.error('Erro: perfil não encontrado');
        return;
      }

      // Buscar a proposta para validar antes de aceitar
      const proposalToAccept = proposals.find(p => p.id === proposalId);
      if (!proposalToAccept) {
        toast.error('Proposta não encontrada');
        return;
      }

      // Validar se o valor da proposta é válido
      if (!proposalToAccept.proposed_price || proposalToAccept.proposed_price <= 0) {
        toast.error('Proposta com valor inválido (R$ 0). Faça uma contra-proposta ou rejeite.');
        return;
      }

      // Usar nova edge function para aceitar proposta e criar assignment
      const { data, error } = await supabase.functions.invoke('accept-freight-proposal', {
        body: {
          proposal_id: proposalId,
          producer_id: profile.id
        }
      });

      if (error) {
        console.error('Error accepting proposal:', error);
        // Tentar exibir a mensagem de erro específica da edge function
        const errorMessage = data?.error || error.message || 'Erro ao aceitar proposta';
        toast.error(errorMessage);
        return;
      }

      // Avisar se valor abaixo do ANTT
      if (data?.below_antt_minimum) {
        toast.warning(
          `⚠️ Valor aceito abaixo do mínimo ANTT por carreta`,
          { 
            description: `Aceito: R$ ${Number(data?.assignment?.agreed_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Mínimo ANTT: R$ ${Number(data.minimum_antt_price_per_truck || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            duration: 6000
          }
        );
      }

      // Mostrar informações sobre vagas restantes
      if (data?.remaining_trucks > 0) {
        toast.success(
          `Proposta aceita! Ainda ${data.remaining_trucks === 1 ? 'falta' : 'faltam'} ${data.remaining_trucks} ${data.remaining_trucks === 1 ? 'carreta' : 'carretas'}.`
        );
      } else {
        toast.success('Proposta aceita! Todas as carretas foram contratadas.');
      }

      // Remove a proposta aceita imediatamente do estado local e atualiza lista de fretes
      setProposals(prev => prev.filter(proposal => proposal.id !== proposalId));
      fetchFreights();
      
    } catch (error) {
      console.error('Error accepting proposal:', error);
      showErrorToast(toast, 'Falha ao aceitar proposta', error);
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    try {
      const { error } = await supabase
        .from('freight_proposals')
        .update({ status: 'REJECTED' })
        .eq('id', proposalId);

      if (error) throw error;

      // Remove a proposta rejeitada imediatamente do estado local
      setProposals(prev => prev.filter(proposal => proposal.id !== proposalId));
      
      toast.success('Proposta rejeitada');
    } catch (error) {
      console.error('Error rejecting proposal:', error);
      toast.error('Erro ao rejeitar proposta');
    }
  };

  const handleCancelProposal = async (proposalId: string) => {
    try {
      const { error } = await supabase
        .from('freight_proposals')
        .update({ status: 'CANCELLED' })
        .eq('id', proposalId);

      if (error) throw error;

      toast.success('Proposta cancelada');
      fetchProposals();
    } catch (error) {
      console.error('Error cancelling proposal:', error);
      toast.error('Erro ao cancelar proposta');
    }
  };

  const openCounterProposalModal = (proposal: any) => {
    setSelectedProposal({
      id: proposal.id,
      freight_id: proposal.freight?.id,
      proposed_price: proposal.proposed_price,
      message: proposal.message,
      driver_name: proposal.driver?.full_name || 'Motorista',
      freight_price: proposal.freight?.price
    });
    setCounterProposalModalOpen(true);
  };

  const handleFreightAction = async (action: 'edit' | 'cancel' | 'request-cancel', freight: any) => {
    if (action === 'edit') {
      setSelectedFreight(freight);
      setEditFreightModalOpen(true);
    } else if (action === 'cancel') {
      setFreightToCancel(freight);
      setConfirmDialogOpen(true);
    } else if (action === 'request-cancel') {
      // Abrir detalhes do frete para contato via chat
      setSelectedFreightDetails(freight);
      toast.info('Entre em contato com o motorista via chat para solicitar o cancelamento', {
        duration: 5000,
      });
    }
  };

  const confirmCancelFreight = async () => {
    if (!freightToCancel) return;
    
    // Validar se pode cancelar diretamente
    const canCancelDirectly = ['OPEN', 'ACCEPTED', 'LOADING'].includes(freightToCancel.status);
    
    if (!canCancelDirectly) {
      toast.error('Este frete está em andamento. Solicite o cancelamento via chat com o motorista.');
      setConfirmDialogOpen(false);
      return;
    }
    
    try {
      // Use safe edge function to handle pickup_date validation
      const { data, error } = await supabase.functions.invoke('cancel-freight-safe', {
        body: {
          freight_id: freightToCancel.id,
          reason: 'Cancelado pelo produtor'
        }
      });

      if (error) {
        console.error('Error cancelling freight:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao cancelar frete');
      }

      // Notificar motorista se houver um assignado
      if (freightToCancel.driver_id) {
        await supabase.functions.invoke('send-notification', {
          body: {
            user_id: freightToCancel.driver_profiles?.user_id,
            title: 'Frete Cancelado',
            message: `O frete de ${freightToCancel.cargo_type} foi cancelado pelo produtor.`,
            type: 'freight_cancelled',
            data: { freight_id: freightToCancel.id }
          }
        }).catch(err => console.warn('Notification failed:', err));
      }

      toast.success('Frete cancelado com sucesso!');
      setConfirmDialogOpen(false);
      setFreightToCancel(null);
      fetchFreights();
    } catch (error: any) {
      console.error('Error cancelling freight:', error);
      toast.error(error.message || 'Erro ao cancelar frete');
    }
  };

  // Estatísticas calculadas - memoizadas
  const statistics = useMemo(() => {
    const pendingExternalPayments = externalPayments.filter(p => p.status === 'proposed').length;
    const pendingFreightPayments = freightPayments.filter(p => p.status === 'PENDING').length;
    const totalPendingPayments = pendingExternalPayments + pendingFreightPayments;
    
    const totalPendingAmount = externalPayments
      .filter(p => p.status === 'proposed')
      .reduce((sum, p) => sum + (p.amount || 0), 0) +
      freightPayments
        .filter(p => p.status === 'PENDING')
        .reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const openServices = serviceRequests.filter(s => s.status === 'OPEN').length;
    
    return {
      openFreights: freights.filter(f => f.status === 'OPEN').length,
      activeFreights: freights.filter(f => ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'].includes(f.status)).length,
      pendingConfirmation: freights.filter(f => f.status === 'DELIVERED_PENDING_CONFIRMATION').length,
      totalValue: freights.reduce((sum, f) => sum + f.price, 0),
      pendingProposals: proposals.length,
      pendingPayments: totalPendingPayments,
      totalPendingAmount,
      openServices
    };
  }, [freights, proposals, externalPayments, freightPayments, serviceRequests]);

  const openDeliveryConfirmationModal = (freight: any) => {
    setFreightToConfirm(freight);
    setDeliveryConfirmationModal(true);
  };

  const closeDeliveryConfirmationModal = () => {
    setFreightToConfirm(null);
    setDeliveryConfirmationModal(false);
  };

  const handleDeliveryConfirmed = () => {
    console.log('handleDeliveryConfirmed chamado - atualizando lista de fretes');
    
    // Após confirmar entrega, solicitar pagamento automático se ainda não foi feito
    if (freightToConfirm && freightToConfirm.driver_profiles) {
      const existingPayment = externalPayments.find(p => 
        p.freight_id === freightToConfirm.id && p.amount === freightToConfirm.price
      );
      
      if (!existingPayment) {
        setTimeout(() => {
          requestFullPayment(
            freightToConfirm.id, 
            freightToConfirm.driver_profiles.id, 
            freightToConfirm.price
          );
        }, 1000);
      }
    }
    
    fetchFreights(); // Recarregar dados após confirmação
    fetchExternalPayments(); // Recarregar pagamentos
  };

  const handlePaymentNotification = async (freightId: string, driverId: string, amount: number) => {
    try {
      console.log('Processando notificação de pagamento:', { freightId, driverId, amount });
      
      // Criar registro de pagamento externo
      const { data: paymentData, error: paymentError } = await supabase
        .from('external_payments')
        .insert([
          {
            freight_id: freightId,
            producer_id: profile?.id,
            driver_id: driverId,
            amount: amount * 0.5, // 50% do valor
            status: 'proposed',
            notes: 'Solicitação de adiantamento do motorista'
          }
        ])
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Enviar notificação para o motorista
      const { error: notificationError } = await supabase.functions.invoke('send-notification', {
        body: {
          user_id: driverId,
          title: 'Pagamento Disponível',
          message: `Produtor informou pagamento de R$ ${(amount * 0.5).toLocaleString('pt-BR')} para o frete. Confirme o recebimento.`,
          type: 'payment_notification',
          data: {
            freight_id: freightId,
            payment_id: paymentData.id,
            amount: amount * 0.5
          }
        }
      });

      if (notificationError) {
        console.error('Erro ao enviar notificação:', notificationError);
        // Não falhar se a notificação der erro
      }

      toast.success('Pagamento informado! O motorista foi notificado para confirmar o recebimento.');
      fetchFreights();
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      toast.error('Erro ao processar pagamento');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao fazer logout');
    }
  };

  // Criar pagamento via sistema (Stripe)
  const handleCreateFreightPayment = async (freightId: string, amount: number, paymentType: string) => {
    try {
      setPaymentLoading(true);
      
      const { data, error } = await supabase.functions.invoke('create-freight-payment', {
        body: {
          freight_id: freightId,
          amount: Math.round(amount * 100), // Converter para centavos
          payment_type: paymentType
        }
      });

      if (error) throw error;

      toast.success('Redirecionando para o pagamento...');
      if (data?.checkout_url) {
        window.open(data.checkout_url, '_blank');
      }
      
      fetchFreightPayments();
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      toast.error('Erro ao processar pagamento');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Confirmar pagamento externo (feito fora do sistema)
  const handleConfirmExternalPayment = async (freightId: string, amount: number) => {
    try {
      setPaymentLoading(true);
      
      // Buscar dados do frete para pegar o driver_id
      const { data: freightData, error: freightError } = await supabase
        .from('freights')
        .select('driver_id')
        .eq('id', freightId)
        .single();

      if (freightError) throw freightError;

      // Verificar se o frete tem um motorista atribuído
      if (!freightData.driver_id) {
        toast.error('Este frete ainda não foi aceito por um motorista');
        return;
      }

      // Buscar dados do driver
      const { data: driverData, error: driverError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', freightData.driver_id)
        .maybeSingle();

      if (driverError) {
        console.error('Erro ao buscar dados do motorista:', driverError);
        toast.error('Erro ao buscar dados do motorista');
        return;
      }

      if (!driverData) {
        console.error('Motorista não encontrado com ID:', freightData.driver_id);
        toast.error('Motorista não encontrado no sistema');
        return;
      }

      // Criar registro de pagamento externo
      const { data: paymentData, error: paymentError } = await supabase
        .from('external_payments')
        .insert([
          {
            freight_id: freightId,
            producer_id: profile?.id,
            driver_id: freightData.driver_id,
            amount: amount,
            status: 'proposed',
            notes: 'Pagamento completo do frete após entrega confirmada'
          }
        ])
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Enviar notificação para o motorista
      if (driverData?.user_id) {
        const { error: notificationError } = await supabase.functions.invoke('send-notification', {
          body: {
            user_id: driverData.user_id,
            title: 'Confirmação de Pagamento',
            message: `Produtor confirmou o pagamento de R$ ${amount.toLocaleString('pt-BR')}. Confirme o recebimento.`,
            type: 'payment_confirmation',
            data: {
              freight_id: freightId,
              payment_id: paymentData.id,
              amount: amount
            }
          }
        });

        if (notificationError) {
          console.error('Erro ao enviar notificação:', notificationError);
        }
      }

      toast.success('Pagamento confirmado! Aguardando confirmação do motorista.');
      fetchExternalPayments();
    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error);
      toast.error('Erro ao confirmar pagamento');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Solicitar pagamento completo após entrega confirmada
  const requestFullPayment = async (freightId: string, driverId: string, amount: number) => {
    try {
      setPaymentLoading(true);
      console.log('Solicitando pagamento completo:', { freightId, driverId, amount });
      
      // Criar registro de pagamento externo
      const { data: paymentData, error: paymentError } = await supabase
        .from('external_payments')
        .insert([
          {
            freight_id: freightId,
            producer_id: profile?.id,
            driver_id: driverId,
            amount: amount,
            status: 'proposed',
            notes: 'Pagamento completo do frete após entrega confirmada'
          }
        ])
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Enviar notificação para o motorista
      const { error: notificationError } = await supabase.functions.invoke('send-notification', {
        body: {
          user_id: driverId,
          title: 'Pagamento Disponível',
          message: `Produtor deve pagar o valor total de R$ ${amount.toLocaleString('pt-BR')} do frete. Confirme quando receber.`,
          type: 'payment_notification',
          data: {
            freight_id: freightId,
            payment_id: paymentData.id,
            amount: amount
          }
        }
      });

      if (notificationError) {
        console.error('Erro ao enviar notificação:', notificationError);
      }

      toast.success('Solicitação de pagamento enviada ao motorista!');
      fetchExternalPayments();
    } catch (error) {
      console.error('Erro ao solicitar pagamento:', error);
      toast.error('Erro ao solicitar pagamento');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Confirmar que pagamento foi realizado
  const confirmPaymentMade = async (paymentId: string) => {
    try {
      setPaymentLoading(true);
      
      const { error } = await supabase
        .from('external_payments')
        .update({ 
          status: 'paid_by_producer',
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      if (error) throw error;

      toast.success('Pagamento confirmado! Aguardando confirmação do motorista.');
      fetchExternalPayments();
    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error);
      toast.error('Erro ao confirmar pagamento');
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/5 to-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-background via-secondary/5 to-background overflow-x-hidden overflow-y-auto">
      <SystemAnnouncementModal />
      <Header
        user={{ name: profile?.full_name || 'Usuário', role: (profile?.role as 'PRODUTOR' | 'MOTORISTA') || 'PRODUTOR' }}
        onLogout={handleLogout}
        onMenuClick={() => {}}
        userProfile={profile}
        notifications={unreadCount}
      />
      
      {/* Hero Section Compacta */}
      <section 
        className="relative py-8 bg-gradient-to-r from-primary/90 via-primary to-primary/90 text-white overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(34, 197, 94, 0.9), rgba(34, 197, 94, 0.95)), url(${heroLogistics})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-primary/60 backdrop-blur-sm"></div>
        <div className="relative container mx-auto px-4 max-w-7xl">
          <div className="text-center space-y-3">
            <h1 className="text-2xl md:text-3xl font-bold">
              Dashboard do Produtor
            </h1>
            <p className="text-primary-foreground/90 max-w-xl mx-auto text-sm md:text-base">
              Gerencie seus fretes, acompanhe propostas e monitore o desempenho
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <CreateFreightModal 
                onFreightCreated={fetchFreights}
                userProfile={profile}
              />
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('proposals')}
                className="bg-background/10 text-white border-white/30 hover:bg-white/20 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Users className="mr-1 h-4 w-4" />
                Ver Propostas
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setServicesModalOpen(true)}
                className="bg-background/10 text-white border-white/30 hover:bg-white/20 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Wrench className="mr-1 h-4 w-4" />
                Solicitar Serviços
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container max-w-7xl mx-auto py-4 px-4 pb-8">
        {/* Stats Cards Compactos - Navegáveis */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <StatsCard
            size="sm"
            icon={<Package className="h-5 w-5" />}
            iconColor="text-blue-500"
            label="Abertos"
            value={statistics.openFreights}
            onClick={() => setActiveTab('open')}
          />

          <StatsCard
            size="sm"
            icon={<Play className="h-5 w-5" />}
            iconColor="text-orange-500"
            label="Andamento"
            value={statistics.activeFreights}
            onClick={() => setActiveTab('ongoing')}
          />

          <StatsCard
            size="sm"
            icon={<Clock className="h-5 w-5" />}
            iconColor="text-amber-500"
            label="P/ Confirmar"
            value={statistics.pendingConfirmation}
            onClick={() => setActiveTab('confirm-delivery')}
          />

          <StatsCard
            size="sm"
            icon={<Users className="h-5 w-5" />}
            iconColor="text-purple-500"
            label="Propostas"
            value={statistics.pendingProposals}
            onClick={() => setActiveTab('proposals')}
          />

          <StatsCard
            size="sm"
            icon={<CreditCard className="h-5 w-5" />}
            iconColor="text-green-500"
            label="Pagamentos"
            value={statistics.pendingPayments}
            onClick={() => setActiveTab('payments')}
          />

          <StatsCard
            size="sm"
            icon={<Wrench className="h-5 w-5" />}
            iconColor="text-teal-500"
            label="Serviços"
            value={statistics.openServices || 0}
            onClick={() => setActiveTab('history')}
          />
        </div>


        {/* Tabs Compactas */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="w-full overflow-x-auto pb-2">
            <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-card p-1 text-muted-foreground min-w-fit">
              <TabsTrigger 
                value="open" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Package className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Fretes Abertos</span>
                <span className="sm:hidden">Abertos</span>
              </TabsTrigger>
              <TabsTrigger 
                value="ongoing" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Play className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Em Andamento</span>
                <span className="sm:hidden">Ativo</span>
              </TabsTrigger>
              <TabsTrigger 
                value="confirm-delivery" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Clock className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Confirmar Entrega</span>
                <span className="sm:hidden">Confirm</span>
                {statistics.pendingConfirmation > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 text-xs">
                    {statistics.pendingConfirmation}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="proposals" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Users className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Propostas</span>
                <span className="sm:hidden">Propos</span>
              </TabsTrigger>
              <TabsTrigger 
                value="scheduled" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Calendar className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Agendados</span>
                <span className="sm:hidden">Agenda</span>
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Histórico</span>
                <span className="sm:hidden">Hist</span>
              </TabsTrigger>
              <TabsTrigger 
                value="payments" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <CreditCard className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Pagamentos</span>
                <span className="sm:hidden">Pag</span>
              </TabsTrigger>
              <TabsTrigger 
                value="ratings" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Star className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Avaliações</span>
                <span className="sm:hidden">Aval</span>
              </TabsTrigger>
              <TabsTrigger 
                value="chat" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <MessageCircle className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Chat</span>
                <span className="sm:hidden">Chat</span>
                {chatUnreadCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                    {chatUnreadCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Notificação de assinatura */}
          <SubscriptionExpiryNotification />
          <FreightLimitTracker hideForAffiliatedDriver={true} />

          <TabsContent value="open" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Fretes Abertos</h3>
            </div>
            
            {freights.filter(f => f.status === 'OPEN').length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Nenhum frete aberto</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">
                    Você não possui fretes abertos no momento. Crie um novo frete para começar.
                  </p>
                  <CreateFreightModal 
                    onFreightCreated={fetchFreights}
                    userProfile={profile}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
                {freights.filter(f => f.status === 'OPEN').map((freight) => (
                  <FreightCard
                    key={freight.id}
                    freight={{
                      id: freight.id,
                      cargo_type: freight.cargo_type,
                      weight: (freight.weight / 1000),
                      distance_km: freight.distance_km,
                      origin_address: freight.origin_address,
                      destination_address: freight.destination_address,
                      price: freight.price,
                      status: freight.status as 'OPEN' | 'IN_TRANSIT' | 'DELIVERED' | 'ACCEPTED' | 'IN_NEGOTIATION' | 'CANCELLED',
                      pickup_date: freight.pickup_date,
                      delivery_date: freight.delivery_date,
                      urgency: freight.urgency,
                      minimum_antt_price: freight.minimum_antt_price || 0,
                      required_trucks: freight.required_trucks || 1,
                      accepted_trucks: freight.accepted_trucks || 0
                    }}
                    showProducerActions={true}
                    onAction={(action) => handleFreightAction(action as 'edit' | 'cancel', freight)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ongoing" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Fretes em Andamento</h3>
            </div>
            
            {freights.filter(f => ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'].includes(f.status)).length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Play className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Nenhum frete em andamento</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">
                    Você não possui fretes em andamento no momento.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="max-h-[600px] overflow-y-auto pr-2 scroll-area">
                <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">{freights.filter(f => ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'].includes(f.status)).map((freight) => (
                  <Card key={freight.id} className="border-l-4 border-l-primary hover:shadow-lg transition-all duration-300">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <h3 className="font-semibold text-lg">{freight.cargo_type}</h3>
                          <p className="text-sm text-muted-foreground">
                            {freight.origin_address} → {freight.destination_address}
                          </p>
                          <div className="flex items-center gap-4 mt-3">
                            <div className="flex items-center gap-2 p-2 bg-muted/40 rounded">
                              <Truck className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">{(freight.weight / 1000).toFixed(1)}t</span>
                            </div>
                            <div className="flex items-center gap-2 p-2 bg-muted/40 rounded">
                              <MapPin className="h-4 w-4 text-accent" />
                              <span className="text-sm font-medium">{freight.distance_km}km</span>
                            </div>
                            <div className="flex items-center gap-2 p-2 bg-muted/40 rounded">
                              <Clock className="h-4 w-4 text-warning" />
                              <span className="text-sm font-medium">
                                {new Date(freight.pickup_date).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <Badge variant={freight.status === 'IN_TRANSIT' ? 'default' : 'secondary'} className="font-medium">
                            {getFreightStatusLabel(freight.status)}
                          </Badge>
                          <p className="font-bold text-xl text-primary">R$ {freight.price.toLocaleString()}</p>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-6">
                      {/* Informações básicas */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium">Motorista:</p>
                          <p className="text-muted-foreground">
                            {freight.driver_profiles?.full_name || 'Aguardando aceite'}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Telefone:</p>
                          <p className="text-muted-foreground">
                            {freight.driver_profiles?.contact_phone || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Data de Coleta:</p>
                          <p className="text-muted-foreground">
                            {new Date(freight.pickup_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Data de Entrega:</p>
                          <p className="text-muted-foreground">
                            {new Date(freight.delivery_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>

                      {/* Botões de Ação */}
                      <div className="flex gap-3 pt-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="flex-1 border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                          onClick={() => {
                            setSelectedFreightDetails(freight);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalhes
                        </Button>
                        
                        {/* Cancelamento direto para ACCEPTED e LOADING */}
                        {['ACCEPTED', 'LOADING'].includes(freight.status) && (
                          <Button 
                            size="sm" 
                            variant="destructive"
                            className="flex-1 hover:shadow-lg transition-all duration-300"
                            onClick={() => handleFreightAction('cancel', freight)}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar Frete
                          </Button>
                        )}
                        
                        {/* Solicitar cancelamento via chat para LOADED e IN_TRANSIT */}
                        {['LOADED', 'IN_TRANSIT'].includes(freight.status) && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                            onClick={() => handleFreightAction('request-cancel', freight)}
                          >
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Solicitar Cancelamento
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="confirm-delivery" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Confirmar Entregas</h3>
            </div>
            
            {freights.filter(f => f.status === 'DELIVERED_PENDING_CONFIRMATION').length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Nenhuma entrega aguardando confirmação</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">
                    Não há entregas reportadas pelos motoristas aguardando sua confirmação.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {freights.filter(f => f.status === 'DELIVERED_PENDING_CONFIRMATION').map((freight) => (
                  <Card key={freight.id} className="p-4 border-amber-200 bg-amber-50/50">
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-lg">
                            {freight.cargo_type}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {freight.origin_address} → {freight.destination_address}
                          </p>
                          <p className="text-sm font-medium text-amber-700 mt-2">
                            ⏰ Entrega reportada pelo motorista - Aguardando sua confirmação
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
                            Aguardando Confirmação
                          </Badge>
                          <p className="text-lg font-bold text-green-600 mt-1">
                            R$ {freight.price?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium">Motorista:</p>
                          <p className="text-muted-foreground">
                            {freight.driver_profiles?.full_name || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Telefone:</p>
                          <p className="text-muted-foreground">
                            {freight.driver_profiles?.contact_phone || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Reportado em:</p>
                          <p className="text-muted-foreground">
                            {new Date(freight.updated_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Prazo para confirmação:</p>
                          <p className="text-muted-foreground">
                            {freight.metadata?.confirmation_deadline 
                              ? new Date(freight.metadata.confirmation_deadline).toLocaleString('pt-BR')
                              : '72h após reportado'
                            }
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setSelectedFreightDetails(freight);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalhes
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={() => openDeliveryConfirmationModal(freight)}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Confirmar Entrega
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="proposals" className="space-y-4">
            <FreightProposalsManager 
              producerId={profile?.id || ''}
              onProposalAccepted={() => {
                fetchFreights();
                fetchProposals();
              }}
            />
          </TabsContent>

          <TabsContent value="scheduled">
            <ScheduledFreightsManager />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <UnifiedHistory userRole="PRODUTOR" />
          </TabsContent>

          <TabsContent value="ratings" className="mt-6">
            <PendingRatingsPanel
              userRole="PRODUTOR"
              userProfileId={profile?.id || ''}
            />
          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            <UnifiedChatHub 
              userProfileId={profile.id}
              userRole="PRODUTOR"
            />
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Pagamentos</h3>
            </div>
            
            <div className="space-y-6">
              {/* Pagamentos Externos Solicitados */}
              {externalPayments.filter(payment => payment.status === 'proposed').length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-md font-semibold text-blue-700">Solicitações de Pagamento Recebidas</h4>
                  {externalPayments.filter(payment => payment.status === 'proposed').map((payment) => (
                    <Card key={payment.id} className="p-4 border-blue-200 bg-blue-50/50">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-semibold text-lg">
                              Solicitação de Pagamento - {payment.freight?.cargo_type || 'Frete'}
                            </h5>
                            <p className="text-sm text-muted-foreground">
                              Valor solicitado: R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Motorista: {payment.driver?.full_name}
                            </p>
                            {payment.notes && (
                              <p className="text-sm mt-2 p-2 bg-gray-100 rounded">
                                Nota: {payment.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button
                              onClick={() => handleConfirmExternalPayment(payment.freight_id, payment.amount)}
                              size="sm"
                              disabled={paymentLoading}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Confirmar Pagamento
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Pagamentos Aguardando Confirmação do Motorista */}
              {externalPayments.filter(payment => payment.status === 'paid_by_producer').length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-md font-semibold text-orange-700">Aguardando Confirmação do Motorista</h4>
                  {externalPayments.filter(payment => payment.status === 'paid_by_producer').map((payment) => (
                    <Card key={payment.id} className="p-4 border-orange-200 bg-orange-50/50">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-semibold text-lg">
                              Pagamento Confirmado - {payment.freight?.cargo_type || 'Frete'}
                            </h5>
                            <p className="text-sm text-muted-foreground">
                              Valor pago: R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Motorista: {payment.driver?.full_name}
                            </p>
                            <p className="text-sm text-orange-600 mt-2">
                              ⏳ Aguardando confirmação de recebimento do motorista
                            </p>
                          </div>
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                            Pendente Confirmação
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Pagamentos Concluídos */}
              {(externalPayments.filter(payment => payment.status === 'completed').length > 0 || freightPayments.length > 0) && (
                <div className="space-y-4">
                  <h4 className="text-md font-semibold text-green-700">Pagamentos Concluídos</h4>
                  
                  {/* Pagamentos Externos Concluídos */}
                  {externalPayments.filter(payment => payment.status === 'completed').map((payment) => (
                    <Card key={payment.id} className="p-4 border-green-200 bg-green-50/50">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-semibold text-lg">
                              {payment.freight?.cargo_type || 'Frete'}
                            </h5>
                            <p className="text-sm text-muted-foreground">
                              Valor pago: R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Motorista: {payment.driver?.full_name}
                            </p>
                          </div>
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            ✓ Concluído
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  ))}

                  {/* Pagamentos via Sistema */}
                  {freightPayments.map((payment) => (
                    <Card key={payment.id} className="p-4 border-green-200 bg-green-50/50">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-semibold text-lg">
                              {payment.freight?.cargo_type || 'Carregamento'}
                            </h5>
                            <p className="text-sm text-muted-foreground">
                              Pagamento de R$ {(payment.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Tipo: {payment.payment_type === 'UPFRONT_50_PERCENT' ? '50% Adiantamento' : 'Pagamento Final'}
                            </p>
                          </div>
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            {payment.status === 'COMPLETED' ? '✓ Concluído' : 'Processando'}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Fretes Entregues Precisando Pagamento Final */}
              {freights.filter(freight => 
                freight.status === 'DELIVERED' && 
                freight.driver_profiles &&
                !externalPayments.some(payment => 
                  payment.freight_id === freight.id && 
                  payment.status === 'completed' &&
                  payment.amount >= (freight.price * 0.5)
                )
              ).length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-md font-semibold text-purple-700">Fretes Entregues - Confirmar Pagamento Final</h4>
                  {freights.filter(freight => 
                    freight.status === 'DELIVERED' && 
                    freight.driver_profiles &&
                    !externalPayments.some(payment => 
                      payment.freight_id === freight.id && 
                      payment.status === 'completed' &&
                      payment.amount >= (freight.price * 0.5)
                    )
                  ).map((freight) => {
                    const paidAmount = freightPayments
                      .filter(payment => payment.freight_id === freight.id)
                      .reduce((sum, payment) => sum + (payment.amount / 100), 0);
                    const remainingAmount = freight.price - paidAmount;
                    
                    return (
                      <Card key={freight.id} className="p-4 border-purple-200 bg-purple-50/50">
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-semibold text-lg">
                                Frete Entregue - {freight.cargo_type}
                              </h5>
                              <p className="text-sm text-muted-foreground">
                                Valor total do frete: R$ {freight.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Já pago: R$ {paidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-sm font-semibold">
                                Restante: R$ {remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Motorista: {freight.driver_profiles?.full_name}
                              </p>
                            </div>
                            <Button
                              onClick={() => handleConfirmExternalPayment(freight.id, remainingAmount)}
                              disabled={paymentLoading}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Confirmar Pagamento
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Mensagem se não há pagamentos */}
              {freightPayments.length === 0 && 
               externalPayments.length === 0 && 
               freights.filter(freight => freight.status === 'ACCEPTED_BY_DRIVER' && freight.driver_profiles).length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg mb-2">Nenhum pagamento encontrado</h3>
                    <p className="text-muted-foreground">
                      Não há registros de pagamentos no momento.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

        </Tabs>
      </div>

      <EditFreightModal
        isOpen={editFreightModalOpen}
        onClose={() => setEditFreightModalOpen(false)}
        freight={selectedFreight}
        onSuccess={() => {
          fetchFreights();
          setEditFreightModalOpen(false);
        }}
      />

      <ProposalCounterModal
        isOpen={counterProposalModalOpen}
        onClose={() => setCounterProposalModalOpen(false)}
        originalProposal={selectedProposal}
        freightPrice={selectedProposal?.freight_price || 0}
        freightDistance={selectedProposal?.freight_distance || 0}
        onSuccess={() => {
          fetchProposals();
          setCounterProposalModalOpen(false);
        }}
      />

      <ConfirmDialog
        isOpen={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={confirmCancelFreight}
        title="Cancelar Frete"
        description="Tem certeza que deseja cancelar este frete? Esta ação não pode ser desfeita."
        confirmText="Sim, cancelar"
        cancelText="Não, manter"
        variant="destructive"
      />

      <Dialog open={!!selectedFreightDetails} onOpenChange={(open) => !open && setSelectedFreightDetails(null)}>
        <DialogContent className="max-w-6xl h-[90vh] overflow-y-auto" hideCloseButton>
          <DialogDescription className="sr-only">
            Detalhes completos do frete
          </DialogDescription>
          {selectedFreightDetails && (
            <FreightDetails
              freightId={selectedFreightDetails.id}
              currentUserProfile={profile}
              initialTab={
                (location.state as any)?.openChatFreightId || 
                (location.state as any)?.notificationType === 'chat_message' || 
                (location.state as any)?.notificationType === 'advance_request' 
                  ? 'chat' 
                  : 'status'
              }
              onClose={() => {
                setSelectedFreightDetails(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {freightToConfirm && (
        <DeliveryConfirmationModal
          freight={{
            id: freightToConfirm.id,
            cargo_type: freightToConfirm.cargo_type,
            origin_address: freightToConfirm.origin_address,
            destination_address: freightToConfirm.destination_address,
            status: freightToConfirm.status,
            updated_at: freightToConfirm.updated_at,
            metadata: freightToConfirm.metadata,
            driver: freightToConfirm.driver_profiles ? {
              full_name: freightToConfirm.driver_profiles.full_name,
              contact_phone: freightToConfirm.driver_profiles.contact_phone || freightToConfirm.driver_profiles.phone
            } : undefined
          }}
          isOpen={deliveryConfirmationModal}
          onClose={closeDeliveryConfirmationModal}
          onConfirm={handleDeliveryConfirmed}
        />
      )}
      
      <ServicesModal 
        isOpen={servicesModalOpen}
        onClose={() => setServicesModalOpen(false)}
      />

      {/* Modal de Avaliação Automática */}
      {activeFreightForRating && (
        <AutoRatingModal
          isOpen={true}
          onClose={() => setActiveFreightForRating(null)}
          freightId={activeFreightForRating.id}
          userToRate={
            activeFreightForRating.driver
              ? {
                  id: activeFreightForRating.driver.id,
                  full_name: activeFreightForRating.driver.full_name,
                  role: 'MOTORISTA' as const
                }
              : null
          }
          currentUserProfile={profile}
        />
      )}
    </div>
  );
};

export default ProducerDashboard;
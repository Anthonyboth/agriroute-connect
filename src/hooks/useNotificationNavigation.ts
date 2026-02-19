import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook centralizado para gerenciar a navegação a partir de notificações.
 * 
 * Mapeia tipos de notificação → rota do dashboard + state com aba/modal a abrir.
 * Garante que o usuário é redirecionado para a aba correta do seu dashboard
 * ao clicar em "Ver detalhes" no centro de notificações.
 */

export interface NavigationTarget {
  route: string;
  state: Record<string, any>;
}

export function useNotificationNavigation() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const getDashboardRoute = useCallback((role?: string): string => {
    switch (role) {
      case 'driver':
      case 'MOTORISTA':
      case 'MOTORISTA_AFILIADO':
        return '/dashboard/driver';
      case 'producer':
      case 'PRODUTOR':
        return '/dashboard/producer';
      case 'service_provider':
      case 'PRESTADOR_SERVICOS':
        return '/dashboard/service-provider';
      case 'TRANSPORTADORA':
        return '/dashboard/company';
      default:
        return '/dashboard/producer';
    }
  }, []);

  /**
   * Resolve o destino de navegação para um dado tipo de notificação + dados.
   * Retorna null se a notificação não for acionável.
   */
  const resolveTarget = useCallback((
    type: string,
    data?: Record<string, any>
  ): NavigationTarget | null => {
    const dashboardRoute = getDashboardRoute(profile?.role);

    switch (type) {
      // ============ FRETES ============
      case 'delivery_confirmation_required':
      case 'freight_delivery_reported':
        if (!data?.freight_id) return null;
        return {
          route: dashboardRoute,
          state: {
            openTab: 'confirm-delivery',
            highlightFreightId: data.freight_id,
          },
        };

      case 'proposal_received':
        if (!data?.freight_id) return null;
        return {
          route: dashboardRoute,
          state: {
            openTab: 'proposals',
            highlightFreightId: data.freight_id,
            notificationType: type,
          },
        };

      case 'freight_accepted':
      case 'advance_request':
      case 'advance_approved':
      case 'advance_rejected':
      case 'checkin_confirmation_required':
      case 'freight_in_transit':
      case 'freight_created':
      case 'external_payment_proposed':
        if (!data?.freight_id) return null;
        return {
          route: dashboardRoute,
          state: {
            openFreightId: data.freight_id,
            notificationType: type,
          },
        };

      // ============ CHAT DE FRETE ============
      case 'chat_message':
        if (!data?.freight_id) return null;
        return {
          route: dashboardRoute,
          state: { openChatFreightId: data.freight_id },
        };

      // ============ CHAT DE PROPOSTA ============
      case 'proposal_chat_message':
        if (!data?.proposal_id) return null;
        return {
          route: dashboardRoute,
          state: {
            openProposal: data.proposal_id,
            openProposalChat: true,
          },
        };

      // ============ TRANSPORTADORA ============
      case 'company_new_proposal':
      case 'company_freight_status_change':
      case 'company_driver_assignment':
      case 'company_delivery_confirmation':
        return {
          route: '/dashboard/company',
          state: {
            openFreightId: data?.freight_id,
            notificationType: type,
          },
        };

      // ============ VEÍCULOS ============
      case 'vehicle_assignment_created':
      case 'vehicle_assignment_removed':
        if (profile?.role === 'MOTORISTA' || profile?.role === 'MOTORISTA_AFILIADO') {
          return {
            route: '/dashboard/driver',
            state: {
              openTab: 'vehicles',
              highlightAssignmentId: data?.assignment_id,
            },
          };
        }
        return {
          route: '/dashboard/company',
          state: {
            openTab: 'vinculos',
            highlightAssignmentId: data?.assignment_id,
          },
        };

      // ============ SERVIÇOS - CHAT ============
      case 'service_chat_message':
        if (!data?.service_request_id) return null;
        return {
          route: dashboardRoute,
          state: {
            openTab: 'chat',
            openServiceChat: data.service_request_id,
          },
        };

      // ============ SERVIÇOS - STATUS ============
      case 'service_accepted':
      case 'service_completed':
      case 'service_status_change':
        if (!data?.service_request_id) return null;
        return {
          route: '/dashboard/service-provider',
          state: {
            openServiceRequest: data.service_request_id,
            openTab: 'accepted',
          },
        };

      // ============ PAGAMENTOS ============
      case 'payment_paid_by_producer':
      case 'external_payment_paid':
        if (!data?.freight_id) return null;
        return {
          route: dashboardRoute,
          state: {
            openTab: 'payments',
            highlightFreightId: data.freight_id,
            notificationType: type,
          },
        };

      case 'payment_completed':
      case 'payment_confirmation':
        return {
          route: dashboardRoute,
          state: { openPaymentHistory: true },
        };

      // ============ AVALIAÇÕES ============
      case 'rating_pending':
        if (!data?.freight_id || !data?.rated_user_id) return null;
        return {
          route: dashboardRoute,
          state: {
            openRating: true,
            ratingFreightId: data.freight_id,
            ratedUserId: data.rated_user_id,
          },
        };

      case 'service_rating_pending':
        if (!data?.service_request_id || !data?.rated_user_id) return null;
        return {
          route: dashboardRoute,
          state: {
            openServiceRating: true,
            ratingServiceRequestId: data.service_request_id,
            ratedUserId: data.rated_user_id,
          },
        };

      default:
        return null;
    }
  }, [getDashboardRoute, profile?.role]);

  /**
   * Navega para o destino correto de uma notificação.
   * Retorna true se a navegação foi realizada, false caso contrário.
   */
  const navigateTo = useCallback((
    type: string,
    data?: Record<string, any>,
    onBeforeNavigate?: () => void
  ): boolean => {
    const target = resolveTarget(type, data);
    if (!target) return false;

    onBeforeNavigate?.();
    navigate(target.route, { state: target.state });
    return true;
  }, [resolveTarget, navigate]);

  return {
    resolveTarget,
    navigateTo,
    getDashboardRoute,
  };
}

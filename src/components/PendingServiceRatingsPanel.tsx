import React, { useEffect, useState } from 'react';
import { devLog } from '@/lib/devLogger';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Calendar, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ServiceAutoRatingModal } from './ServiceAutoRatingModal';
import { useServiceRatingSubmit } from '@/hooks/useServiceRatingSubmit';
import { appTexts } from '@/lib/app-texts';
import { toast } from 'sonner';

interface PendingService {
  id: string;
  service_type: string;
  updated_at: string;
  client_id: string;
  provider_id: string;
  client_name?: string;
  provider_name?: string;
}

export const PendingServiceRatingsPanel: React.FC = () => {
  const { profile } = useAuth();
  const [pendingServices, setPendingServices] = useState<PendingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<PendingService | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { submitRating, isSubmitting: isSubmittingHook } = useServiceRatingSubmit();

  useEffect(() => {
    if (!profile) return;
    fetchPendingRatings();
  }, [profile]);

  const fetchPendingRatings = async () => {
    if (!profile) return;

    try {
      // Buscar serviços COMPLETED - permitir client_id nulo para serviços aceitos diretamente
      const { data: services, error } = await supabase
        .from('service_requests')
        .select('id, service_type, updated_at, client_id, provider_id')
        .eq('status', 'COMPLETED')
        .or(`client_id.eq.${profile.id},provider_id.eq.${profile.id}`)
        .not('provider_id', 'is', null)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (!services || services.length === 0) {
        setPendingServices([]);
        return;
      }

      // Buscar nomes dos perfis separadamente
      const allProfileIds = Array.from(new Set([
        ...services.map(s => s.client_id),
        ...services.map(s => s.provider_id)
      ])).filter(id => id != null);

      const { data: profilesData } = await supabase
        .from('profiles_secure')
        .select('id, full_name')
        .in('id', allProfileIds);

      const profilesMap = new Map(
        (profilesData || []).map(p => [p.id, p.full_name])
      );

      // OTIMIZAÇÃO: Buscar TODAS as avaliações existentes do usuário de uma vez (batch)
      const serviceIds = services.map(s => s.id);
      const { data: existingRatings } = await supabase
        .from('service_ratings')
        .select('service_request_id, rating_type')
        .eq('rater_id', profile.id)
        .in('service_request_id', serviceIds);

      // Criar Set para busca O(1) em vez de N consultas
      const ratedServiceKeys = new Set(
        (existingRatings || []).map(r => `${r.service_request_id}_${r.rating_type}`)
      );

      // Filtrar serviços pendentes SEM consultas adicionais ao banco
      const pending: PendingService[] = services
        .filter(service => {
          // Se não tem client_id, só o provider pode avaliar (não há cliente para avaliar)
          if (!service.client_id) {
            // Provider não precisa avaliar se não há cliente
            return false;
          }
          const isClient = service.client_id === profile.id;
          const ratingType = isClient ? 'CLIENT_TO_PROVIDER' : 'PROVIDER_TO_CLIENT';
          const key = `${service.id}_${ratingType}`;
          return !ratedServiceKeys.has(key);
        })
        .map(service => ({
          id: service.id,
          service_type: service.service_type,
          updated_at: service.updated_at,
          client_id: service.client_id || '',
          provider_id: service.provider_id,
          client_name: service.client_id ? (profilesMap.get(service.client_id) || 'Cliente') : 'Cliente não cadastrado',
          provider_name: profilesMap.get(service.provider_id) || 'Prestador',
        }));

      setPendingServices(pending);
    } catch (error) {
      console.error('Erro ao buscar avaliações pendentes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async (rating: number, comment?: string) => {
    if (!selectedService) {
      console.error('[PendingServiceRatingsPanel] Nenhum serviço selecionado');
      return;
    }

    // Validação defensiva antes de determinar ratedUserId
    if (!selectedService.client_id || !selectedService.provider_id) {
      console.error('[PendingServiceRatingsPanel] Service request com IDs inválidos:', {
        serviceId: selectedService.id,
        client_id: selectedService.client_id,
        provider_id: selectedService.provider_id,
      });
      toast.error('Erro: Dados do serviço estão incompletos. Por favor, contate o suporte.');
      setSelectedService(null);
      return;
    }

    if (isSubmitting || isSubmittingHook) return;
    
    setIsSubmitting(true);
    
    const isClient = selectedService.client_id === profile?.id;
    const ratedUserId = isClient ? selectedService.provider_id : selectedService.client_id;
    const raterRole: 'CLIENT' | 'PROVIDER' = isClient ? 'CLIENT' : 'PROVIDER';

    // Validação adicional do ratedUserId
    if (!ratedUserId) {
      console.error('[PendingServiceRatingsPanel] ratedUserId inválido após determinação:', {
        isClient,
        provider_id: selectedService.provider_id,
        client_id: selectedService.client_id,
      });
      toast.error('Erro: Não foi possível identificar o usuário a ser avaliado.');
      setIsSubmitting(false);
      setSelectedService(null);
      return;
    }

    devLog('[PendingServiceRatingsPanel] Submetendo avaliação:', {
      serviceRequestId: selectedService.id,
      ratedUserId,
      raterRole,
      rating,
    });

    try {
      const result = await submitRating({
        serviceRequestId: selectedService.id,
        ratedUserId,
        raterRole,
        rating,
        comment,
      });

      if (result.success) {
        // Optimistic update - remover imediatamente da lista
        setPendingServices(prev => prev.filter(s => s.id !== selectedService.id));
        setSelectedService(null);
        
        // Recarregar em background para garantir sincronização
        fetchPendingRatings();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Avaliações Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  if (pendingServices.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            {appTexts.pendingRatings.count(pendingServices.length)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pendingServices.map((service) => {
              const isServiceClient = service.client_id === profile?.id;
              const otherUserName = isServiceClient 
                ? service.provider_name 
                : service.client_name;
              const otherUserRole = isServiceClient ? 'Prestador' : 'Cliente';

              return (
                <Card
                  key={service.id}
                  className="border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {service.service_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="p-1.5 rounded-full bg-primary/10">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{otherUserRole} a ser avaliado</p>
                            <p className="font-semibold text-base">{otherUserName || 'Não identificado'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                      <Calendar className="h-3 w-3" />
                      <span>Concluído em {new Date(service.updated_at).toLocaleDateString('pt-BR')}</span>
                    </div>

                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => setSelectedService(service)}
                      disabled={isSubmitting || isSubmittingHook}
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Avaliar {otherUserName || otherUserRole}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedService && (
        <ServiceAutoRatingModal
          isOpen={!!selectedService}
          onClose={() => setSelectedService(null)}
          onSubmit={handleSubmitRating}
          ratedUserName={
            selectedService.client_id === profile?.id
              ? selectedService.provider_name
              : selectedService.client_name
          }
          raterRole={selectedService.client_id === profile?.id ? 'CLIENT' : 'PROVIDER'}
          serviceType={selectedService.service_type}
        />
      )}
    </>
  );
};

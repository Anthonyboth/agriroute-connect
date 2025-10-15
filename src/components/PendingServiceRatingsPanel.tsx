import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Calendar } from 'lucide-react';
import { ServiceAutoRatingModal } from './ServiceAutoRatingModal';
import { useServiceRating } from '@/hooks/useServiceRating';
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

  const isClient = selectedService?.client_id === profile?.id;
  const ratedUserId = isClient ? selectedService?.provider_id : selectedService?.client_id;
  const raterRole: 'CLIENT' | 'PROVIDER' = isClient ? 'CLIENT' : 'PROVIDER';

  const { submitRating } = useServiceRating({
    serviceRequestId: selectedService?.id || '',
    ratedUserId: ratedUserId || '',
    raterRole,
  });

  useEffect(() => {
    if (!profile) return;
    fetchPendingRatings();
  }, [profile]);

  const fetchPendingRatings = async () => {
    if (!profile) return;

    try {
      const { data: services, error } = await supabase
        .from('service_requests')
        .select(`
          id,
          status,
          service_type,
          updated_at,
          client_id,
          provider_id,
          client:profiles!service_requests_client_id_fkey(full_name),
          provider:profiles!service_requests_provider_id_fkey(full_name)
        `)
        .eq('status', 'COMPLETED')
        .or(`client_id.eq.${profile.id},provider_id.eq.${profile.id}`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Filtrar serviços que ainda não foram avaliados
      const pending: PendingService[] = [];
      
      for (const service of services || []) {
        const isClient = service.client_id === profile.id;
        const ratingType = isClient ? 'CLIENT_TO_PROVIDER' : 'PROVIDER_TO_CLIENT';

        const { data: existingRating } = await supabase
          .from('service_ratings')
          .select('id')
          .eq('service_request_id', service.id)
          .eq('rater_id', profile.id)
          .eq('rating_type', ratingType)
          .maybeSingle();

        if (!existingRating) {
          pending.push({
            id: service.id,
            service_type: service.service_type,
            updated_at: service.updated_at,
            client_id: service.client_id,
            provider_id: service.provider_id,
            client_name: (service.client as any)?.[0]?.full_name,
            provider_name: (service.provider as any)?.[0]?.full_name,
          });
        }
      }

      setPendingServices(pending);
    } catch (error) {
      console.error('Erro ao buscar avaliações pendentes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async (rating: number, comment?: string) => {
    const result = await submitRating(rating, comment);
    if (result.success) {
      toast.success('Avaliação enviada com sucesso!');
      setSelectedService(null);
      fetchPendingRatings();
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
            Avaliações Pendentes ({pendingServices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pendingServices.map((service) => {
              const isServiceClient = service.client_id === profile?.id;
              const otherUserName = isServiceClient 
                ? service.provider_name 
                : service.client_name;

              return (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium">{service.service_type}</p>
                    <p className="text-sm text-muted-foreground">
                      {isServiceClient ? 'Prestador' : 'Cliente'}: {otherUserName}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(service.updated_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setSelectedService(service)}
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Avaliar
                  </Button>
                </div>
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
          raterRole={raterRole}
          serviceType={selectedService.service_type}
        />
      )}
    </>
  );
};

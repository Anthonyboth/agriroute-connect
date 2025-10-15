import React, { useState } from 'react';
import { useGlobalRating } from '@/contexts/RatingContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, X } from 'lucide-react';
import { InteractiveStarRating } from '@/components/InteractiveStarRating';

export const GlobalRatingModals: React.FC = () => {
  const { profile } = useAuth();
  const {
    serviceRatingOpen,
    closeServiceRating,
    serviceRequestId,
    serviceRatedUserId,
    serviceRatedUserName,
    serviceType,
    freightRatingOpen,
    closeFreightRating,
    freightId,
    freightRatedUserId,
    freightRatedUserName,
  } = useGlobalRating();

  // Service rating state
  const [serviceRating, setServiceRating] = useState(0);
  const [serviceComment, setServiceComment] = useState('');
  const [serviceSubmitting, setServiceSubmitting] = useState(false);

  // Freight rating state
  const [freightRating, setFreightRating] = useState(0);
  const [freightComment, setFreightComment] = useState('');
  const [freightSubmitting, setFreightSubmitting] = useState(false);

  const handleServiceRatingSubmit = async () => {
    if (serviceRating === 0 || !serviceRequestId || !serviceRatedUserId || !profile?.id) {
      return;
    }

    setServiceSubmitting(true);
    try {
      // Determinar tipo de avaliação
      const { data: serviceData } = await supabase
        .from('service_requests')
        .select('client_id, provider_id')
        .eq('id', serviceRequestId)
        .single();

      const ratingType = serviceData?.client_id === profile.id 
        ? 'CLIENT_TO_PROVIDER' 
        : 'PROVIDER_TO_CLIENT';

      const { error } = await supabase
        .from('service_ratings')
        .insert({
          service_request_id: serviceRequestId,
          rater_id: profile.id,
          rated_user_id: serviceRatedUserId,
          rating: serviceRating,
          comment: serviceComment || null,
          rating_type: ratingType,
        });

      if (error) throw error;

      toast.success('Avaliação enviada com sucesso!');
      
      // Resetar e fechar
      setServiceRating(0);
      setServiceComment('');
      closeServiceRating();
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error);
      toast.error('Erro ao enviar avaliação');
    } finally {
      setServiceSubmitting(false);
    }
  };

  const handleFreightRatingSubmit = async () => {
    if (freightRating === 0 || !freightId || !freightRatedUserId || !profile?.id) {
      return;
    }

    setFreightSubmitting(true);
    try {
      // Determinar tipo de avaliação
      const { data: freightData } = await supabase
        .from('freights')
        .select('producer_id, driver_id')
        .eq('id', freightId)
        .single();

      const ratingType = freightData?.producer_id === profile.id 
        ? 'PRODUCER_TO_DRIVER' 
        : 'DRIVER_TO_PRODUCER';

      const { error } = await supabase
        .from('freight_ratings')
        .insert({
          freight_id: freightId,
          rater_id: profile.id,
          rated_user_id: freightRatedUserId,
          rating: freightRating,
          comment: freightComment || null,
          rating_type: ratingType,
        });

      if (error) throw error;

      toast.success('Avaliação enviada com sucesso!');
      
      // Resetar e fechar
      setFreightRating(0);
      setFreightComment('');
      closeFreightRating();
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error);
      toast.error('Erro ao enviar avaliação');
    } finally {
      setFreightSubmitting(false);
    }
  };

  const handleServiceClose = () => {
    setServiceRating(0);
    setServiceComment('');
    closeServiceRating();
  };

  const handleFreightClose = () => {
    setFreightRating(0);
    setFreightComment('');
    closeFreightRating();
  };

  const getRoleText = (isService: boolean) => {
    if (!profile?.id) return '';
    
    if (isService && serviceRequestId) {
      return serviceRatedUserId ? 'o prestador' : 'o cliente';
    }
    
    if (!isService && freightId) {
      return freightRatedUserId ? 'o motorista' : 'o produtor';
    }
    
    return 'o usuário';
  };

  return (
    <>
      {/* Modal de Avaliação de Serviço */}
      <Dialog open={serviceRatingOpen} onOpenChange={handleServiceClose}>
        <DialogContent className="sm:max-w-md animate-in fade-in-0 zoom-in-95 duration-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
              Avalie {getRoleText(true)}
            </DialogTitle>
            <DialogDescription className="text-base">
              {serviceRatedUserName ? (
                <>
                  Como foi sua experiência com <strong>{serviceRatedUserName}</strong>
                  {serviceType && ` no serviço de ${serviceType}`}?
                </>
              ) : (
                'Como foi sua experiência neste serviço?'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6">
            <div className="flex flex-col items-center gap-4">
              <InteractiveStarRating
                rating={serviceRating}
                onRatingChange={setServiceRating}
                size="lg"
              />
              {serviceRating > 0 && (
                <p className="text-sm font-medium text-muted-foreground">
                  {serviceRating === 1 && '😞 Muito ruim'}
                  {serviceRating === 2 && '😕 Ruim'}
                  {serviceRating === 3 && '😐 Regular'}
                  {serviceRating === 4 && '😊 Bom'}
                  {serviceRating === 5 && '🤩 Excelente'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Comentário (opcional)
              </label>
              <Textarea
                placeholder="Compartilhe sua experiência..."
                value={serviceComment}
                onChange={(e) => setServiceComment(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleServiceClose}
              disabled={serviceSubmitting}
            >
              <X className="h-4 w-4 mr-2" />
              Avaliar depois
            </Button>
            <Button
              onClick={handleServiceRatingSubmit}
              disabled={serviceRating === 0 || serviceSubmitting}
              className="bg-primary hover:bg-primary/90"
            >
              <Star className="h-4 w-4 mr-2" />
              {serviceSubmitting ? 'Enviando...' : 'Enviar Avaliação'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Avaliação de Frete */}
      <Dialog open={freightRatingOpen} onOpenChange={handleFreightClose}>
        <DialogContent className="sm:max-w-md animate-in fade-in-0 zoom-in-95 duration-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
              Avalie {getRoleText(false)}
            </DialogTitle>
            <DialogDescription className="text-base">
              {freightRatedUserName ? (
                <>
                  Como foi sua experiência com <strong>{freightRatedUserName}</strong> neste frete?
                </>
              ) : (
                'Como foi sua experiência neste frete?'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6">
            <div className="flex flex-col items-center gap-4">
              <InteractiveStarRating
                rating={freightRating}
                onRatingChange={setFreightRating}
                size="lg"
              />
              {freightRating > 0 && (
                <p className="text-sm font-medium text-muted-foreground">
                  {freightRating === 1 && '😞 Muito ruim'}
                  {freightRating === 2 && '😕 Ruim'}
                  {freightRating === 3 && '😐 Regular'}
                  {freightRating === 4 && '😊 Bom'}
                  {freightRating === 5 && '🤩 Excelente'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Comentário (opcional)
              </label>
              <Textarea
                placeholder="Compartilhe sua experiência..."
                value={freightComment}
                onChange={(e) => setFreightComment(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleFreightClose}
              disabled={freightSubmitting}
            >
              <X className="h-4 w-4 mr-2" />
              Avaliar depois
            </Button>
            <Button
              onClick={handleFreightRatingSubmit}
              disabled={freightRating === 0 || freightSubmitting}
              className="bg-primary hover:bg-primary/90"
            >
              <Star className="h-4 w-4 mr-2" />
              {freightSubmitting ? 'Enviando...' : 'Enviar Avaliação'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGlobalRating } from '@/contexts/RatingContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-handler';
import { ErrorMonitoringService } from '@/services/errorMonitoringService';
import { useRatingSubmit } from '@/hooks/useRatingSubmit';
import { FreightRatingMultiStepModal, getRatingStepIcon, getRatingStepLabel } from '@/components/FreightRatingMultiStepModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, X, AlertCircle } from 'lucide-react';
import { InteractiveStarRating } from '@/components/InteractiveStarRating';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
    freightCompanyId,
    freightCompanyName,
    ratingSteps,
  } = useGlobalRating();

  // Service rating state
  const [serviceRating, setServiceRating] = useState(0);
  const [serviceComment, setServiceComment] = useState('');
  const [serviceSubmitting, setServiceSubmitting] = useState(false);

  // Freight rating state (para modal simples sem multi-step)
  const [freightRating, setFreightRating] = useState(0);
  const [freightComment, setFreightComment] = useState('');
  const [freightSubmitting, setFreightSubmitting] = useState(false);
  const [paymentNotConfirmedWarning, setPaymentNotConfirmedWarning] = useState<string | null>(null);

  // Hook centralizado para submissão de ratings
  const { canSubmitRating, submitRating } = useRatingSubmit();
  const queryClient = useQueryClient();

  // Determinar se deve usar modal multi-step (quando há transportadora envolvida)
  const useMultiStepModal = ratingSteps.length > 1 || freightCompanyId;

  // Preparar steps com ícones
  const stepsWithIcons = ratingSteps.map(step => ({
    ...step,
    icon: getRatingStepIcon(step.type),
    label: step.label || getRatingStepLabel(step.type)
  }));

  // Verificar se pode avaliar quando o modal de frete abre
  useEffect(() => {
    const checkCanSubmit = async () => {
      if (freightRatingOpen && freightId && !useMultiStepModal) {
        const { canSubmit, reason } = await canSubmitRating(freightId);
        if (!canSubmit) {
          console.log('[GlobalRatingModals] Pagamento não confirmado, fechando modal:', reason);
          setPaymentNotConfirmedWarning(reason || 'Avaliação não disponível');
          setTimeout(() => {
            closeFreightRating();
            setPaymentNotConfirmedWarning(null);
          }, 3000);
        } else {
          setPaymentNotConfirmedWarning(null);
        }
      }
    };
    checkCanSubmit();
  }, [freightRatingOpen, freightId, canSubmitRating, closeFreightRating, useMultiStepModal]);

  const handleServiceRatingSubmit = async () => {
    if (serviceRating === 0 || !serviceRequestId || !serviceRatedUserId || !profile?.id) {
      return;
    }

    setServiceSubmitting(true);
    try {
      const { data: serviceData } = await supabase
        .from('service_requests')
        .select('client_id, provider_id')
        .eq('id', serviceRequestId)
        .maybeSingle();

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
      setServiceRating(0);
      setServiceComment('');
      // ✅ Invalidar cache de serviços em andamento
      queryClient.invalidateQueries({ queryKey: ['driver-ongoing-cards'] });
      queryClient.invalidateQueries({ queryKey: ['freight-driver-manager'] });
      closeServiceRating();
    } catch (error: any) {
      console.error('❌ Erro ao enviar avaliação de serviço:', error);
      await ErrorMonitoringService.getInstance().captureError(
        new Error(`Service Rating Submission Failed: ${error?.message || 'Unknown error'}`),
        {
          module: 'GlobalRatingModals',
          functionName: 'handleServiceRatingSubmit',
          serviceRequestId,
          ratedUserId: serviceRatedUserId,
          rating: serviceRating,
          errorCode: error?.code,
          userFacing: true
        }
      );
      showErrorToast(toast, 'Falha ao enviar avaliação', error);
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
      const { data: freightData } = await supabase
        .from('freights')
        .select('producer_id, driver_id')
        .eq('id', freightId)
        .maybeSingle();

      const ratingType = freightData?.producer_id === profile.id 
        ? 'PRODUCER_TO_DRIVER' 
        : 'DRIVER_TO_PRODUCER';

      const success = await submitRating({
        freightId,
        raterId: profile.id,
        ratedUserId: freightRatedUserId,
        rating: freightRating,
        comment: freightComment || undefined,
        ratingType
      });

      if (success) {
        setFreightRating(0);
        setFreightComment('');
        setPaymentNotConfirmedWarning(null);
        // ✅ Invalidar cache de fretes em andamento para remover frete finalizado
        queryClient.invalidateQueries({ queryKey: ['driver-ongoing-cards'] });
        queryClient.invalidateQueries({ queryKey: ['freight-driver-manager'] });
        queryClient.invalidateQueries({ queryKey: ['ongoing-freights'] });
        closeFreightRating();
      }
    } catch (error: any) {
      console.error('❌ Erro ao enviar avaliação de frete:', error);
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
    setPaymentNotConfirmedWarning(null);
    closeFreightRating();
  };

  const handleAllRatingsSubmitted = () => {
    toast.success('Todas as avaliações foram enviadas!');
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

      {/* Modal de Avaliação de Frete - Multi-Step quando há transportadora */}
      {useMultiStepModal && freightId && profile?.id && stepsWithIcons.length > 0 ? (
        <FreightRatingMultiStepModal
          isOpen={freightRatingOpen}
          onClose={handleFreightClose}
          onAllRatingsSubmitted={handleAllRatingsSubmitted}
          freightId={freightId}
          raterId={profile.id}
          steps={stepsWithIcons}
        />
      ) : (
        /* Modal de Avaliação de Frete - Simples (sem transportadora) */
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

            {paymentNotConfirmedWarning && (
              <Alert variant="destructive" className="my-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {paymentNotConfirmedWarning}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-6 py-6">
              <div className="flex flex-col items-center gap-4">
                <InteractiveStarRating
                  rating={freightRating}
                  onRatingChange={setFreightRating}
                  size="lg"
                  disabled={!!paymentNotConfirmedWarning}
                />
                {freightRating > 0 && !paymentNotConfirmedWarning && (
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
                  disabled={!!paymentNotConfirmedWarning}
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
                {paymentNotConfirmedWarning ? 'Fechar' : 'Avaliar depois'}
              </Button>
              {!paymentNotConfirmedWarning && (
                <Button
                  onClick={handleFreightRatingSubmit}
                  disabled={freightRating === 0 || freightSubmitting}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Star className="h-4 w-4 mr-2" />
                  {freightSubmitting ? 'Enviando...' : 'Enviar Avaliação'}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

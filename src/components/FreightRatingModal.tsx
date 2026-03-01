import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { InteractiveStarRating } from '@/components/InteractiveStarRating';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Star, User, AlertCircle, Loader2 } from 'lucide-react';
import { appTexts } from '@/lib/app-texts';
import { useRatingSubmit, RatingType } from '@/hooks/useRatingSubmit';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FreightRatingModalProps {
  freight?: {
    id: string;
    producer_profiles?: { full_name: string };
    driver_profiles?: { full_name: string };
    metadata?: any;
  };
  // Legacy props (backward compatibility)
  freightId?: string;
  userToRate?: { full_name?: string; id?: string } | null;
  currentUserProfile?: { id: string; role: 'PRODUTOR' | 'MOTORISTA' } | null;

  isOpen: boolean;
  onClose: () => void;
  onRatingSubmitted: () => void;
  userRole?: 'PRODUTOR' | 'MOTORISTA';
}

export const FreightRatingModal: React.FC<FreightRatingModalProps> = ({
  freight,
  freightId: freightIdProp,
  userToRate,
  currentUserProfile,
  isOpen,
  onClose,
  onRatingSubmitted,
  userRole
}) => {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [canSubmit, setCanSubmit] = useState<boolean | null>(null);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [checkingPermission, setCheckingPermission] = useState(false);
  
  const { submitRating, isSubmitting, canSubmitRating } = useRatingSubmit();
  const queryClient = useQueryClient();

  const effectiveFreightId = freight?.id || freightIdProp || '';
  const effectiveUserRole = userRole || currentUserProfile?.role || 'PRODUTOR';
  const isProducerRating = effectiveUserRole === 'PRODUTOR';
  const ratedUserName = isProducerRating 
    ? freight?.driver_profiles?.full_name || userToRate?.full_name || 'Motorista'
    : freight?.producer_profiles?.full_name || userToRate?.full_name || 'Produtor';

  // Verificar permissão ao abrir o modal
  useEffect(() => {
    if (isOpen && effectiveFreightId) {
      const checkPermission = async () => {
        setCheckingPermission(true);
        const ratingType: RatingType = isProducerRating ? 'PRODUCER_TO_DRIVER' : 'DRIVER_TO_PRODUCER';
        const result = await canSubmitRating(effectiveFreightId, ratingType);
        setCanSubmit(result.canSubmit);
        setBlockReason(result.reason || null);
        setCheckingPermission(false);
      };
      checkPermission();
    }
  }, [isOpen, effectiveFreightId, isProducerRating, canSubmitRating]);

  // Reset ao fechar
  useEffect(() => {
    if (!isOpen) {
      setRating(0);
      setComment('');
      setCanSubmit(null);
      setBlockReason(null);
    }
  }, [isOpen]);

  const handleSubmitRating = async () => {
    if (rating === 0) {
      toast({
        title: appTexts.ratings.required,
        description: "Por favor, selecione uma nota de 1 a 5 estrelas.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get current user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (profileError) throw profileError;

      // Get freight details to identify producer and driver
      const { data: freightData, error: freightError } = await supabase
        .from('freights')
        .select('producer_id, driver_id, metadata')
        .eq('id', effectiveFreightId)
        .single();

      if (freightError) throw freightError;

      const ratedUserId = isProducerRating ? freightData.driver_id : freightData.producer_id;
      
      if (!ratedUserId) {
        toast({
          title: "Avaliação não disponível",
          description: isProducerRating 
            ? "Nenhum motorista atribuído a este frete." 
            : "Produtor não encontrado para este frete.",
          variant: "destructive",
        });
        return;
      }

      const ratingType: RatingType = isProducerRating ? 'PRODUCER_TO_DRIVER' : 'DRIVER_TO_PRODUCER';

      // Usar o hook centralizado para submeter
      const success = await submitRating({
        freightId: effectiveFreightId,
        raterId: profile.id,
        ratedUserId: ratedUserId,
        rating: rating,
        comment: comment.trim() || undefined,
        ratingType: ratingType
      });

      if (success) {
        // Check if both parties have now rated
        const { data: bothRated } = await supabase
          .rpc('check_mutual_ratings_complete', { freight_id_param: effectiveFreightId });

        // If both have rated, we can consider the freight fully completed
        if (bothRated && freight) {
          await supabase
            .from('freights')
            .update({ 
              metadata: {
                ...(freight.metadata || freightData.metadata || {}),
                ratings_completed: true,
                ratings_pending: false
              }
            })
            .eq('id', effectiveFreightId);
        }

        toast({
          title: appTexts.ratings.success,
          description: `Sua avaliação para ${ratedUserName} foi enviada com sucesso.`,
        });
        // ✅ Invalidar cache para remover frete finalizado das listas de "em andamento"
        queryClient.invalidateQueries({ queryKey: ['driver-ongoing-cards'] });
        queryClient.invalidateQueries({ queryKey: ['freight-driver-manager'] });
        queryClient.invalidateQueries({ queryKey: ['ongoing-freights'] });
        
        onRatingSubmitted();
        onClose();
      }
      
    } catch (error: any) {
      console.error('Erro ao enviar avaliação:', error);
      toast({
        title: appTexts.ratings.error,
        description: error.message || appTexts.errors.generic,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            {isProducerRating ? appTexts.ratings.rateDriver : appTexts.ratings.rateProducer}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Loading state */}
          {checkingPermission && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Verificando permissões...</span>
            </div>
          )}

          {/* Block message if cannot submit */}
          {!checkingPermission && canSubmit === false && blockReason && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{blockReason}</AlertDescription>
            </Alert>
          )}

          {/* User Info */}
          {!checkingPermission && canSubmit !== false && (
            <>
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{ratedUserName}</p>
                  <p className="text-sm text-muted-foreground">
                    {isProducerRating ? appTexts.ratings.driverResponsible : appTexts.ratings.freightProducer}
                  </p>
                </div>
              </div>

              {/* Rating */}
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  {appTexts.ratings.howWasFreight}
                </label>
                <div className="flex justify-center">
                  <InteractiveStarRating 
                    rating={rating} 
                    onRatingChange={setRating}
                  />
                </div>
                {rating > 0 && (
                  <p className="text-center text-sm text-muted-foreground">
                    {appTexts.ratings.satisfaction[rating as 1 | 2 | 3 | 4 | 5]}
                  </p>
                )}
              </div>

              {/* Comment */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {appTexts.ratings.commentOptional}
                </label>
                <Textarea
                  placeholder={appTexts.ratings.commentPlaceholder}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {comment.length}/500
                </p>
              </div>
            </>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {appTexts.ratings.cancel}
            </Button>
            {canSubmit !== false && (
              <Button 
                onClick={handleSubmitRating} 
                disabled={isSubmitting || rating === 0 || checkingPermission}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {appTexts.general.sending}
                  </>
                ) : (
                  appTexts.ratings.submitRating
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
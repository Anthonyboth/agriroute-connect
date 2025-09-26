import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { InteractiveStarRating } from '@/components/InteractiveStarRating';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Star, User } from 'lucide-react';

interface FreightRatingModalProps {
  freight: {
    id: string;
    producer_profiles?: {
      full_name: string;
    };
    driver_profiles?: {
      full_name: string;
    };
    metadata?: any;
  };
  isOpen: boolean;
  onClose: () => void;
  onRatingSubmitted: () => void;
  userRole: 'PRODUTOR' | 'MOTORISTA';
}

export const FreightRatingModal: React.FC<FreightRatingModalProps> = ({
  freight,
  isOpen,
  onClose,
  onRatingSubmitted,
  userRole
}) => {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const isProducerRating = userRole === 'PRODUTOR';
  const ratedUserName = isProducerRating 
    ? freight.driver_profiles?.full_name || 'Motorista'
    : freight.producer_profiles?.full_name || 'Produtor';

  const handleSubmitRating = async () => {
    if (rating === 0) {
      toast({
        title: "Avaliação obrigatória",
        description: "Por favor, selecione uma nota de 1 a 5 estrelas.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
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
        .select('producer_id, driver_id')
        .eq('id', freight.id)
        .single();

      if (freightError) throw freightError;

      const ratedUserId = isProducerRating ? freightData.driver_id : freightData.producer_id;
      const ratingType = isProducerRating ? 'PRODUCER_TO_DRIVER' : 'DRIVER_TO_PRODUCER';

      // Submit rating
      const { error: ratingError } = await supabase
        .from('freight_ratings')
        .insert({
          freight_id: freight.id,
          rater_id: profile.id,
          rated_user_id: ratedUserId,
          rating: rating,
          comment: comment.trim() || null,
          rating_type: ratingType
        });

      if (ratingError) throw ratingError;

      // Check if both parties have now rated
      const { data: bothRated, error: checkError } = await supabase
        .rpc('check_mutual_ratings_complete', { freight_id_param: freight.id });

      if (checkError) throw checkError;

      // If both have rated, we can consider the freight fully completed
      if (bothRated) {
        await supabase
          .from('freights')
          .update({ 
            metadata: {
              ...freight.metadata || {},
              ratings_completed: true,
              ratings_pending: false
            }
          })
          .eq('id', freight.id);
      }

      toast({
        title: "Avaliação enviada",
        description: `Sua avaliação para ${ratedUserName} foi enviada com sucesso.`,
      });
      
      onRatingSubmitted();
      onClose();
      
    } catch (error: any) {
      console.error('Erro ao enviar avaliação:', error);
      toast({
        title: "Erro ao enviar avaliação",
        description: error.message || 'Erro desconhecido',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Avaliar {isProducerRating ? 'Motorista' : 'Produtor'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* User Info */}
          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
            <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{ratedUserName}</p>
              <p className="text-sm text-muted-foreground">
                {isProducerRating ? 'Motorista responsável' : 'Produtor do frete'}
              </p>
            </div>
          </div>

          {/* Rating */}
          <div className="space-y-3">
            <label className="text-sm font-medium">
              Como você avalia o serviço prestado?
            </label>
            <div className="flex justify-center">
              <InteractiveStarRating 
                rating={rating} 
                onRatingChange={setRating}
              />
            </div>
            {rating > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                {rating === 1 && "Muito insatisfeito"}
                {rating === 2 && "Insatisfeito"}
                {rating === 3 && "Neutro"}
                {rating === 4 && "Satisfeito"}
                {rating === 5 && "Muito satisfeito"}
              </p>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Comentários (opcional)
            </label>
            <Textarea
              placeholder="Conte mais sobre sua experiência..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/500
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmitRating} 
              disabled={loading || rating === 0}
              className="flex-1"
            >
              {loading ? 'Enviando...' : 'Enviar Avaliação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
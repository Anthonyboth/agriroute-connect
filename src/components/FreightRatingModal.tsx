import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star, User, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FreightRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  freightId: string;
  userToRate: {
    id: string;
    full_name: string;
    role: 'PRODUTOR' | 'MOTORISTA';
  };
  currentUserProfile: any;
}

export const FreightRatingModal: React.FC<FreightRatingModalProps> = ({
  isOpen,
  onClose,
  freightId,
  userToRate,
  currentUserProfile
}) => {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserProfile || rating === 0) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('ratings')
        .insert({
          freight_id: freightId,
          rater_user_id: currentUserProfile.id,
          rated_user_id: userToRate.id,
          rating: rating,
          comment: comment.trim() || null
        });

      if (error) throw error;

      toast({
        title: "Avaliação enviada",
        description: `Você avaliou ${userToRate.full_name} com ${rating} estrela${rating > 1 ? 's' : ''}.`,
      });

      onClose();
      setRating(0);
      setComment('');
    } catch (error: any) {
      toast({
        title: "Erro ao enviar avaliação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setRating(0);
    setComment('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {userToRate.role === 'MOTORISTA' ? 
              <Truck className="h-5 w-5" /> : 
              <User className="h-5 w-5" />
            }
            Avaliar {userToRate.role === 'MOTORISTA' ? 'Motorista' : 'Produtor'}
          </DialogTitle>
          <DialogDescription>
            Como foi sua experiência com {userToRate.full_name}?
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rating Stars */}
          <div className="space-y-2">
            <Label>Sua Avaliação</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`p-1 rounded transition-colors ${
                    star <= (hoveredRating || rating)
                      ? 'text-yellow-400'
                      : 'text-gray-300'
                  }`}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(star)}
                >
                  <Star 
                    className={`h-8 w-8 ${
                      star <= (hoveredRating || rating) ? 'fill-current' : ''
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-muted-foreground">
                {rating === 1 && "Muito ruim"}
                {rating === 2 && "Ruim"}
                {rating === 3 && "Regular"}
                {rating === 4 && "Bom"}
                {rating === 5 && "Excelente"}
              </p>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">Comentário (opcional)</Label>
            <Textarea
              id="comment"
              placeholder={`Conte como foi trabalhar com ${userToRate.full_name}...`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/500 caracteres
            </p>
          </div>

          {/* Evaluation Criteria */}
          <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
            <h4 className="font-medium">Critérios de Avaliação:</h4>
            <ul className="space-y-1 text-muted-foreground">
              {userToRate.role === 'MOTORISTA' ? (
                <>
                  <li>• Pontualidade no carregamento e entrega</li>
                  <li>• Cuidado com a carga</li>
                  <li>• Comunicação durante o transporte</li>
                  <li>• Profissionalismo</li>
                </>
              ) : (
                <>
                  <li>• Organização do local de carregamento</li>
                  <li>• Clareza nas instruções</li>
                  <li>• Cumprimento dos prazos acordados</li>
                  <li>• Comunicação e cordialidade</li>
                </>
              )}
            </ul>
          </div>

          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => { onClose(); handleReset(); }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading || rating === 0}
              className="flex-1"
            >
              {loading ? 'Enviando...' : 'Avaliar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
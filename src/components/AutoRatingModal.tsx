import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star, User, Truck, CheckCircle, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AutoRatingModalProps {
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

export const AutoRatingModal: React.FC<AutoRatingModalProps> = ({
  isOpen,
  onClose,
  freightId,
  userToRate,
  currentUserProfile
}) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setRating(0);
      setComment('');
      setHoveredRating(0);
    }
  }, [isOpen]);

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

      toast.success(
        `Avaliação enviada com sucesso!`,
        {
          description: `Você avaliou ${userToRate.full_name} com ${rating} estrela${rating > 1 ? 's' : ''}.`,
        }
      );

      onClose();
    } catch (error: any) {
      console.error('Error submitting rating:', error);
      toast.error(
        "Erro ao enviar avaliação",
        {
          description: error.message || "Tente novamente em alguns instantes.",
        }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    toast.info("Avaliação ignorada", {
      description: "Você pode avaliar mais tarde nos detalhes do frete."
    });
    onClose();
  };

  const getRatingText = (stars: number) => {
    switch (stars) {
      case 1: return "Muito ruim";
      case 2: return "Ruim";
      case 3: return "Regular";
      case 4: return "Bom";
      case 5: return "Excelente";
      default: return "";
    }
  };

  const getMotivationalText = () => {
    const isRatingDriver = userToRate.role === 'MOTORISTA';
    if (isRatingDriver) {
      return {
        title: "Como foi o transporte?",
        subtitle: "Ajude outros produtores compartilhando sua experiência"
      };
    } else {
      return {
        title: "Como foi trabalhar com este produtor?",
        subtitle: "Sua avaliação ajuda outros motoristas a fazer boas escolhas"
      };
    }
  };

  const motivationalText = getMotivationalText();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <DialogTitle className="flex items-center justify-center gap-2 text-xl">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Frete Finalizado!
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p className="text-lg font-medium text-foreground">
              {motivationalText.title}
            </p>
            <p className="text-muted-foreground">
              {motivationalText.subtitle}
            </p>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Info */}
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
            {userToRate.role === 'MOTORISTA' ? 
              <Truck className="h-8 w-8 text-primary" /> : 
              <User className="h-8 w-8 text-primary" />
            }
            <div>
              <p className="font-medium">{userToRate.full_name}</p>
              <p className="text-sm text-muted-foreground">
                {userToRate.role === 'MOTORISTA' ? 'Motorista' : 'Produtor'}
              </p>
            </div>
          </div>

          {/* Rating Stars */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Sua Avaliação *</Label>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`p-2 rounded-full transition-all duration-200 ${
                    star <= (hoveredRating || rating)
                      ? 'text-yellow-400 scale-110'
                      : 'text-gray-300 hover:text-yellow-200'
                  }`}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(star)}
                >
                  <Star 
                    className={`h-10 w-10 ${
                      star <= (hoveredRating || rating) ? 'fill-current' : ''
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center text-sm font-medium text-primary">
                {getRatingText(rating)}
              </p>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">Comentário (opcional)</Label>
            <Textarea
              id="comment"
              placeholder={`Compartilhe detalhes sobre sua experiência com ${userToRate.full_name}...`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/300 caracteres
            </p>
          </div>

          <div className="flex gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleSkip}
              className="flex-1"
              disabled={loading}
            >
              Avaliar Depois
            </Button>
            <Button 
              type="submit" 
              disabled={loading || rating === 0}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Enviando...' : 'Enviar Avaliação'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
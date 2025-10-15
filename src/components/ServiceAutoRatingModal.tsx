import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { InteractiveStarRating } from '@/components/InteractiveStarRating';
import { Star, X } from 'lucide-react';

interface ServiceAutoRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment?: string) => Promise<void>;
  ratedUserName?: string;
  raterRole: 'CLIENT' | 'PROVIDER';
  serviceType?: string;
}

export const ServiceAutoRatingModal: React.FC<ServiceAutoRatingModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  ratedUserName,
  raterRole,
  serviceType
}) => {
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(rating, comment);
      setRating(0);
      setComment('');
      onClose();
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleText = raterRole === 'CLIENT' ? 'o prestador' : 'o cliente';
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Avalie {roleText}
          </DialogTitle>
          <DialogDescription>
            {ratedUserName ? `Como foi sua experiência com ${ratedUserName}` : `Como foi sua experiência`}
            {serviceType && ` no serviço de ${serviceType}`}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex flex-col items-center gap-4">
            <InteractiveStarRating
              rating={rating}
              onRatingChange={setRating}
              size="lg"
            />
            {rating > 0 && (
              <p className="text-sm text-muted-foreground">
                {rating === 1 && 'Muito ruim'}
                {rating === 2 && 'Ruim'}
                {rating === 3 && 'Regular'}
                {rating === 4 && 'Bom'}
                {rating === 5 && 'Excelente'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Comentário (opcional)
            </label>
            <Textarea
              placeholder="Compartilhe sua experiência..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4 mr-2" />
            Avaliar depois
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
          >
            <Star className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Enviando...' : 'Enviar Avaliação'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { InteractiveStarRating } from '@/components/InteractiveStarRating';
import { Star, X } from 'lucide-react';
import { appTexts } from '@/lib/app-texts';

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

  const roleText = raterRole === 'CLIENT' ? 'o Prestador' : 'o Cliente';
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            {appTexts.ratings.rateService} - {roleText}
          </DialogTitle>
          <DialogDescription>
            {ratedUserName ? `Como foi sua experiência com ${ratedUserName}` : appTexts.ratings.howWasService}
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
                {appTexts.ratings.satisfaction[rating as 1 | 2 | 3 | 4 | 5]}
              </p>
            )}
          </div>

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
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {appTexts.ratings.rateLater}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
          >
            <Star className="h-4 w-4 mr-2" />
            {isSubmitting ? appTexts.general.sending : appTexts.ratings.submitRating}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

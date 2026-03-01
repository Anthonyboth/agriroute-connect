import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { InteractiveStarRating } from '@/components/InteractiveStarRating';
import { Star, User, Building2, Truck, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react';
import { appTexts } from '@/lib/app-texts';
import { useRatingSubmit, RatingType } from '@/hooks/useRatingSubmit';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RatingStep {
  type: RatingType;
  ratedUserId: string;
  ratedUserName: string;
  companyId?: string;
  label: string;
  icon: React.ReactNode;
}

interface FreightRatingMultiStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAllRatingsSubmitted: () => void;
  freightId: string;
  assignmentId?: string;
  raterId: string;
  steps: RatingStep[];
}

/**
 * Modal de avaliação multi-etapas
 * 
 * Permite ao usuário avaliar múltiplas entidades em sequência:
 * - Produtor avalia Motorista e Transportadora (se afiliado)
 * - Motorista avalia Produtor
 * - Transportadora avalia Produtor
 */
export const FreightRatingMultiStepModal: React.FC<FreightRatingMultiStepModalProps> = ({
  isOpen,
  onClose,
  onAllRatingsSubmitted,
  freightId,
  assignmentId,
  raterId,
  steps
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const { submitRating, isSubmitting } = useRatingSubmit();
  const queryClient = useQueryClient();

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const allCompleted = completedSteps.length === steps.length;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
      setRating(0);
      setComment('');
      setCompletedSteps([]);
    }
  }, [isOpen]);

  const handleSubmitCurrentStep = async () => {
    if (rating === 0 || !currentStep) return;

    const success = await submitRating({
      freightId,
      raterId,
      ratedUserId: currentStep.ratedUserId,
      rating,
      comment: comment.trim() || undefined,
      ratingType: currentStep.type,
      companyId: currentStep.companyId,
      assignmentId
    });

    if (success) {
      setCompletedSteps(prev => [...prev, currentStepIndex]);
      
      if (isLastStep) {
        // ✅ Invalidar cache para remover frete finalizado
        queryClient.invalidateQueries({ queryKey: ['driver-ongoing-cards'] });
        queryClient.invalidateQueries({ queryKey: ['freight-driver-manager'] });
        queryClient.invalidateQueries({ queryKey: ['ongoing-freights'] });
        // Todas as avaliações concluídas
        setTimeout(() => {
          onAllRatingsSubmitted();
          onClose();
        }, 500);
      } else {
        // Próxima etapa
        setRating(0);
        setComment('');
        setCurrentStepIndex(prev => prev + 1);
      }
    }
  };

  const handleSkipStep = () => {
    if (isLastStep) {
      onClose();
    } else {
      setRating(0);
      setComment('');
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  if (!currentStep) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Avaliação do Frete
          </DialogTitle>
          <DialogDescription>
            Avalie os participantes deste frete
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        {steps.length > 1 && (
          <div className="flex items-center justify-center gap-2 py-2">
            {steps.map((step, index) => (
              <React.Fragment key={step.type}>
                <div 
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors",
                    completedSteps.includes(index) 
                      ? "bg-primary text-primary-foreground"
                      : index === currentStepIndex
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {completedSteps.includes(index) ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < steps.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="space-y-6">
          {/* Current Step Info */}
          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
            <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
              {currentStep.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{currentStep.ratedUserName}</p>
                <Badge variant="outline" className="text-xs">
                  {currentStep.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {currentStep.type === 'PRODUCER_TO_DRIVER' && 'Motorista responsável pelo frete'}
                {currentStep.type === 'DRIVER_TO_PRODUCER' && 'Produtor contratante'}
                {currentStep.type === 'PRODUCER_TO_COMPANY' && 'Transportadora do motorista'}
                {currentStep.type === 'COMPANY_TO_PRODUCER' && 'Produtor contratante'}
              </p>
            </div>
          </div>

          {/* Rating */}
          <div className="space-y-3">
            <label className="text-sm font-medium">
              Como foi a experiência?
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
              Comentário (opcional)
            </label>
            <Textarea
              placeholder="Deixe um comentário sobre sua experiência..."
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
            <Button 
              variant="outline" 
              onClick={handleSkipStep} 
              className="flex-1"
              disabled={isSubmitting}
            >
              {isLastStep ? 'Fechar' : 'Pular'}
            </Button>
            <Button 
              onClick={handleSubmitCurrentStep} 
              disabled={isSubmitting || rating === 0}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : isLastStep ? (
                'Finalizar'
              ) : (
                <>
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>

          {/* Step indicator text */}
          {steps.length > 1 && (
            <p className="text-center text-xs text-muted-foreground">
              Etapa {currentStepIndex + 1} de {steps.length}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Helper para criar ícones baseado no tipo
export const getRatingStepIcon = (type: RatingType): React.ReactNode => {
  switch (type) {
    case 'PRODUCER_TO_DRIVER':
    case 'DRIVER_TO_PRODUCER':
      return <User className="h-6 w-6 text-primary" />;
    case 'PRODUCER_TO_COMPANY':
    case 'COMPANY_TO_PRODUCER':
      return <Building2 className="h-6 w-6 text-primary" />;
    default:
      return <Truck className="h-6 w-6 text-primary" />;
  }
};

// Helper para criar label baseado no tipo
export const getRatingStepLabel = (type: RatingType): string => {
  switch (type) {
    case 'PRODUCER_TO_DRIVER':
      return 'Motorista';
    case 'DRIVER_TO_PRODUCER':
      return 'Produtor';
    case 'PRODUCER_TO_COMPANY':
      return 'Transportadora';
    case 'COMPANY_TO_PRODUCER':
      return 'Produtor';
    default:
      return 'Avaliação';
  }
};

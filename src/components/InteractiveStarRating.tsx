import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InteractiveStarRatingProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}

export const InteractiveStarRating: React.FC<InteractiveStarRatingProps> = ({
  rating,
  onRatingChange,
  maxRating = 5,
  size = 'md',
  className,
  disabled = false
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  const handleStarClick = (starValue: number) => {
    if (disabled) return;
    onRatingChange(starValue);
  };

  const renderStar = (index: number) => {
    const starValue = index + 1;
    const isFilled = starValue <= rating;
    
    return (
      <button
        key={starValue}
        type="button"
        onClick={() => handleStarClick(starValue)}
        disabled={disabled}
        className={cn(
          "transition-colors transform transition-transform",
          disabled 
            ? "cursor-not-allowed opacity-50" 
            : "hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
        )}
      >
        <Star 
          className={cn(
            sizeClasses[size],
            isFilled 
              ? "text-yellow-400 fill-yellow-400" 
              : disabled 
                ? "text-muted-foreground/20"
                : "text-muted-foreground/30 hover:text-yellow-300"
          )}
        />
      </button>
    );
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {Array.from({ length: maxRating }, (_, index) => renderStar(index))}
    </div>
  );
};
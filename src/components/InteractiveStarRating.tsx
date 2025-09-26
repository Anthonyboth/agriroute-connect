import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InteractiveStarRatingProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const InteractiveStarRating: React.FC<InteractiveStarRatingProps> = ({
  rating,
  onRatingChange,
  maxRating = 5,
  size = 'md',
  className
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  const handleStarClick = (starValue: number) => {
    onRatingChange(starValue);
  };

  const renderStar = (index: number) => {
    const starValue = index + 1;
    const isFilled = starValue <= rating;
    
    return (
      <button
        key={index}
        type="button"
        onClick={() => handleStarClick(starValue)}
        className={cn(
          "transition-colors hover:scale-110 transform transition-transform",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
        )}
      >
        <Star 
          className={cn(
            sizeClasses[size],
            isFilled 
              ? "text-yellow-400 fill-yellow-400" 
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
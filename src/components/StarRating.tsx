import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  className?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  size = 'md',
  showValue = false,
  className
}) => {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const renderStar = (index: number) => {
    const starValue = index + 1;
    const fillValue = rating - index;
    const isFullFilled = fillValue >= 1;
    const isHalfFilled = fillValue >= 0.5 && fillValue < 1;
    
    return (
      <div key={starValue} className="relative inline-block">
        {/* Background star (empty) */}
        <Star 
          className={cn(
            sizeClasses[size],
            "text-muted-foreground/20"
          )}
        />
        
        {/* Half star fill */}
        {isHalfFilled && (
          <div 
            className="absolute inset-0 overflow-hidden"
            style={{ width: '50%' }}
          >
            <Star 
              className={cn(
                sizeClasses[size],
                "text-yellow-400 fill-yellow-400"
              )}
            />
          </div>
        )}
        
        {/* Full star fill */}
        {isFullFilled && (
          <div className="absolute inset-0">
            <Star 
              className={cn(
                sizeClasses[size],
                "text-yellow-400 fill-yellow-400"
              )}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex">
        {Array.from({ length: maxRating }, (_, index) => renderStar(index))}
      </div>
      {showValue && (
        <span className={cn("text-muted-foreground ml-1", textSizeClasses[size])}>
          ({rating.toFixed(1)})
        </span>
      )}
    </div>
  );
};

export default StarRating;
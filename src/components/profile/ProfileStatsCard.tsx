/**
 * ProfileStatsCard.tsx
 * 
 * Card de avaliações e estatísticas premium.
 * 
 * CORREÇÃO CRÍTICA: Não exibir nota/histograma quando totalRatings === 0.
 * Garante: soma do histograma === totalRatings, average coerente.
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, Award, Calendar, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileStatsCardProps {
  rating: number;
  totalRatings: number;
  memberSince?: string;
  totalServices?: number;
  ratingDistribution?: { star_rating: number; count: number }[];
  className?: string;
}

const renderStars = (rating: number, size: 'sm' | 'md' | 'lg' = 'md') => {
  const sizeClasses = { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' };
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const stars = [];
  
  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(<Star key={i} className={cn(sizeClasses[size], "fill-yellow-400 text-yellow-400")} />);
    } else if (i === fullStars && hasHalf) {
      stars.push(<Star key={i} className={cn(sizeClasses[size], "fill-yellow-400/50 text-yellow-400")} />);
    } else {
      stars.push(<Star key={i} className={cn(sizeClasses[size], "text-muted-foreground/30")} />);
    }
  }
  return stars;
};

export const ProfileStatsCard: React.FC<ProfileStatsCardProps> = ({
  rating,
  totalRatings,
  memberSince,
  totalServices = 0,
  ratingDistribution = [],
  className
}) => {
  const memberYear = memberSince ? new Date(memberSince).getFullYear() : new Date().getFullYear();
  const memberDate = memberSince
    ? new Date(memberSince).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : null;

  // ✅ Recalculate average from distribution to guarantee consistency
  const { computedAverage, computedTotal } = useMemo(() => {
    if (!ratingDistribution || ratingDistribution.length === 0) {
      return { computedAverage: rating, computedTotal: totalRatings };
    }

    let sum = 0;
    let count = 0;
    for (const r of ratingDistribution) {
      sum += r.star_rating * r.count;
      count += r.count;
    }

    if (count === 0) return { computedAverage: 0, computedTotal: 0 };
    return { computedAverage: sum / count, computedTotal: count };
  }, [ratingDistribution, rating, totalRatings]);

  const hasRatings = computedTotal > 0;
  const displayRating = hasRatings ? computedAverage : 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Card de Avaliações */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Award className="h-4 w-4 text-primary" />
            Avaliações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasRatings ? (
            <>
              {/* Rating Principal — nota 40px/800 */}
              <div className="text-center py-2">
                <div className="text-[40px] leading-[44px] font-extrabold text-primary mb-1">
                  {displayRating.toFixed(1)}
                </div>
                <div className="flex justify-center mb-1">
                  {renderStars(displayRating, 'lg')}
                </div>
                <p className="text-sm text-muted-foreground">
                  {computedTotal} {computedTotal === 1 ? 'avaliação' : 'avaliações'}
                </p>
              </div>

              {/* Histograma — só quando tem dados */}
              {ratingDistribution.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const starData = ratingDistribution.find(r => r.star_rating === stars);
                    const count = starData?.count || 0;
                    const percentage = computedTotal > 0 ? (count / computedTotal) * 100 : 0;
                    
                    return (
                      <div key={stars} className="flex items-center gap-2">
                        <span className="text-xs w-4 text-muted-foreground text-right">{stars}</span>
                        <Star className="h-3 w-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-400 transition-all duration-300 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* ✅ No ratings: clean empty state */
            <div className="text-center py-6">
              <Star className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Sem avaliações ainda</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card Membro Desde */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Calendar className="h-4 w-4 text-primary" />
            Membro Desde
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-3">
            <div className="text-3xl font-bold text-primary mb-1">
              {memberYear}
            </div>
            {memberDate && (
              <p className="text-sm text-muted-foreground capitalize">
                {memberDate}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * ProfileStatsCard.tsx
 * 
 * Card de estatísticas e avaliações estilo Facebook.
 * Exibe rating, total de avaliações e data de membro.
 */

import React from 'react';
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
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };
  
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const stars = [];
  
  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(
        <Star 
          key={i} 
          className={cn(sizeClasses[size], "fill-yellow-400 text-yellow-400")} 
        />
      );
    } else if (i === fullStars && hasHalf) {
      stars.push(
        <Star 
          key={i} 
          className={cn(sizeClasses[size], "fill-yellow-400/50 text-yellow-400")} 
        />
      );
    } else {
      stars.push(
        <Star 
          key={i} 
          className={cn(sizeClasses[size], "text-muted-foreground/30")} 
        />
      );
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
  const memberYear = memberSince 
    ? new Date(memberSince).getFullYear() 
    : new Date().getFullYear();
  
  const memberDate = memberSince
    ? new Date(memberSince).toLocaleDateString('pt-BR', { 
        month: 'long', 
        year: 'numeric' 
      })
    : null;

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
          {/* Rating Principal */}
          <div className="text-center py-2">
            <div className="text-4xl font-bold text-primary mb-1">
              {rating > 0 ? rating.toFixed(1) : '—'}
            </div>
            <div className="flex justify-center mb-1">
              {renderStars(rating, 'lg')}
            </div>
            <p className="text-sm text-muted-foreground">
              {totalRatings} {totalRatings === 1 ? 'avaliação' : 'avaliações'}
            </p>
          </div>

          {/* Distribuição de Estrelas */}
          {ratingDistribution.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t">
              {[5, 4, 3, 2, 1].map((stars) => {
                const starData = ratingDistribution.find(r => r.star_rating === stars);
                const count = starData?.count || 0;
                const percentage = totalRatings > 0 
                  ? (count / totalRatings) * 100 
                  : 0;
                
                return (
                  <div key={stars} className="flex items-center gap-2">
                    <span className="text-xs w-14 text-muted-foreground">
                      {stars} {stars === 1 ? 'estrela' : 'estrelas'}
                    </span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-6 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card de Estatísticas Gerais */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <TrendingUp className="h-4 w-4 text-primary" />
            Estatísticas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">Total de serviços</span>
            <span className="text-lg font-semibold">{totalServices}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">Avaliações recebidas</span>
            <span className="text-lg font-semibold">{totalRatings}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Nota média</span>
            <span className="text-lg font-semibold flex items-center gap-1">
              {rating > 0 ? rating.toFixed(1) : '—'}
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            </span>
          </div>
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

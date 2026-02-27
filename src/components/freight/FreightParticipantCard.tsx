/**
 * FreightParticipantCard.tsx
 * 
 * Card clicável que exibe informações resumidas de um participante (produtor ou motorista).
 * Ao clicar, abre o modal de perfil público com fotos e detalhes.
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-avatar-image';
import { Badge } from '@/components/ui/badge';
import { Star, ChevronRight, User, Truck, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FreightParticipantCardProps {
  participantId: string;
  participantType: 'producer' | 'driver';
  name: string;
  avatarUrl?: string;
  rating?: number;
  totalRatings?: number;
  completedFreights?: number;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export const FreightParticipantCard: React.FC<FreightParticipantCardProps> = ({
  participantId,
  participantType,
  name,
  avatarUrl,
  rating = 0,
  totalRatings = 0,
  completedFreights,
  onClick,
  disabled = false,
  className
}) => {
  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const renderStars = (ratingValue: number, size = 'sm') => {
    const fullStars = Math.floor(ratingValue);
    const hasHalf = ratingValue - fullStars >= 0.5;
    const starSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
    const stars = [];
    
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} className={cn(starSize, 'fill-yellow-400 text-yellow-400')} />);
      } else if (i === fullStars && hasHalf) {
        stars.push(<Star key={i} className={cn(starSize, 'fill-yellow-400/50 text-yellow-400')} />);
      } else {
        stars.push(<Star key={i} className={cn(starSize, 'text-muted-foreground/30')} />);
      }
    }
    return stars;
  };

  const Icon = participantType === 'driver' ? Truck : MapPin;
  const label = participantType === 'driver' ? 'Motorista' : 'Produtor';

  return (
    <Card 
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:border-primary/30 active:scale-[0.99]',
        disabled && 'opacity-60 pointer-events-none',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <Avatar className="h-14 w-14 border-2 border-background shadow-md">
            <SignedAvatarImage 
              src={avatarUrl} 
              alt={name}
            />
            <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">
                <Icon className="h-3 w-3 mr-1" />
                {label}
              </Badge>
            </div>
            
            <p className="font-semibold text-sm truncate">{name}</p>
            
            {/* Rating */}
            {totalRatings > 0 ? (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="flex">
                  {renderStars(rating)}
                </div>
                <span className="text-xs text-muted-foreground">
                  {rating.toFixed(1)} ({totalRatings})
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Sem avaliações ainda</p>
            )}

            {/* Completed freights indicator */}
            {completedFreights !== undefined && completedFreights > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {completedFreights} fretes concluídos
              </p>
            )}
          </div>

          {/* Arrow */}
          <div className="flex-shrink-0">
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

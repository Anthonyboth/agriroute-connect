import React, { useState, useEffect, useCallback } from 'react';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SafeListWrapper } from './SafeListWrapper';
import { Star, User, MapPin, Clock, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FreightRatingMultiStepModal, getRatingStepIcon, getRatingStepLabel } from './FreightRatingMultiStepModal';
import { FreightRatingModal } from './FreightRatingModal';
import { useRatingSubmit, RatingType } from '@/hooks/useRatingSubmit';
import { format } from 'date-fns';

interface PendingRating {
  freightId: string;
  assignmentId: string | null;
  driverId: string;
  driverName: string;
  companyId: string | null;
  companyName: string | null;
  producerId: string;
  producerName: string;
  pendingTypes: RatingType[];
  paymentConfirmedAt: string;
  // Campos adicionais para exibição
  cargoType?: string;
  originAddress?: string;
  destinationAddress?: string;
  price?: number;
}

interface PendingRatingsPanelProps {
  userRole: 'PRODUTOR' | 'MOTORISTA' | 'TRANSPORTADORA';
  userProfileId: string;
}

export const PendingRatingsPanel: React.FC<PendingRatingsPanelProps> = React.memo(({
  userRole,
  userProfileId
}) => {
  const [pendingRatings, setPendingRatings] = useState<PendingRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRating, setSelectedRating] = useState<PendingRating | null>(null);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  
  const { getPendingRatings } = useRatingSubmit();

  const fetchPendingRatings = useCallback(async () => {
    try {
      setLoading(true);
      
      console.log('[PendingRatingsPanel] 🔍 Buscando avaliações pendentes via RPC...');
      console.log('[PendingRatingsPanel] 👤 Profile ID:', userProfileId);
      console.log('[PendingRatingsPanel] 🎭 Role:', userRole);
      
      // Usar a nova função RPC
      const ratings = await getPendingRatings(userProfileId);
      
      console.log('[PendingRatingsPanel] 📝 Avaliações pendentes:', ratings.length);
      
      // Enriquecer com dados do frete se necessário
      if (ratings.length > 0) {
        const freightIds = [...new Set(ratings.map(r => r.freightId))];
        
        const { data: freightsData } = await supabase
          .from('freights')
          .select('id, cargo_type, origin_address, destination_address, price')
          .in('id', freightIds);
        
        const freightMap = new Map(freightsData?.map(f => [f.id, f]) || []);
        
        const enrichedRatings = ratings.map(r => {
          const freight = freightMap.get(r.freightId);
          return {
            ...r,
            cargoType: freight?.cargo_type,
            originAddress: freight?.origin_address,
            destinationAddress: freight?.destination_address,
            price: freight?.price
          };
        });
        
        setPendingRatings(enrichedRatings);
      } else {
        setPendingRatings([]);
      }
      
    } catch (error) {
      console.error('[PendingRatingsPanel] ❌ Erro ao buscar avaliações:', error);
      setPendingRatings([]);
    } finally {
      setLoading(false);
    }
  }, [userProfileId, getPendingRatings]);

  useEffect(() => {
    let mounted = true;
    
    const loadRatings = async () => {
      if (!userProfileId || !mounted) return;
      await fetchPendingRatings();
    };
    
    loadRatings();
    
    return () => {
      mounted = false;
    };
  }, [userProfileId, fetchPendingRatings]);

  const handleRatingSubmitted = () => {
    fetchPendingRatings();
  };

  const openRatingModal = (rating: PendingRating) => {
    setSelectedRating(rating);
    setRatingModalOpen(true);
  };

  const getRatingTargetText = (rating: PendingRating): string => {
    if (rating.pendingTypes.includes('PRODUCER_TO_DRIVER') && rating.pendingTypes.includes('PRODUCER_TO_COMPANY')) {
      return `${rating.driverName} e ${rating.companyName}`;
    }
    if (rating.pendingTypes.includes('PRODUCER_TO_DRIVER')) {
      return rating.driverName;
    }
    if (rating.pendingTypes.includes('PRODUCER_TO_COMPANY')) {
      return rating.companyName || 'Transportadora';
    }
    if (rating.pendingTypes.includes('DRIVER_TO_PRODUCER') || rating.pendingTypes.includes('COMPANY_TO_PRODUCER')) {
      return rating.producerName;
    }
    return 'Participante';
  };

  const buildRatingSteps = (rating: PendingRating) => {
    return rating.pendingTypes.map(type => ({
      type,
      ratedUserId: type === 'PRODUCER_TO_DRIVER' ? rating.driverId :
                   type === 'PRODUCER_TO_COMPANY' ? (rating.companyId || '') :
                   rating.producerId,
      ratedUserName: type === 'PRODUCER_TO_DRIVER' ? rating.driverName :
                     type === 'PRODUCER_TO_COMPANY' ? (rating.companyName || 'Transportadora') :
                     rating.producerName,
      companyId: type === 'PRODUCER_TO_COMPANY' || type === 'COMPANY_TO_PRODUCER' ? rating.companyId || undefined : undefined,
      label: getRatingStepLabel(type),
      icon: getRatingStepIcon(type)
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Avaliações Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <AppSpinner size="sm" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Avaliações Pendentes
            {pendingRatings.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingRatings.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRatings.length === 0 ? (
            <div className="text-center py-8">
              <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhuma avaliação pendente
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Todas as suas entregas foram avaliadas
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <SafeListWrapper fallback={<div className="p-4 text-sm text-muted-foreground animate-pulse">Atualizando avaliações...</div>}>
                {pendingRatings.map((rating) => (
                  <React.Fragment key={`rating-${rating.freightId}-${rating.assignmentId || 'main'}`}>
                    <Card className="border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">
                                {rating.cargoType || 'Frete'}
                              </Badge>
                              {rating.price && (
                                <span className="text-sm font-semibold ml-auto">
                                  R$ {rating.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                            
                            {/* Nome da pessoa a ser avaliada - destaque */}
                            <div className="flex items-center gap-2 mt-2">
                              <div className="p-1.5 rounded-full bg-primary/10">
                                <User className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Avaliar</p>
                                <p className="font-semibold text-base">{getRatingTargetText(rating)}</p>
                              </div>
                            </div>

                            {/* Badge para indicar transportadora envolvida */}
                            {rating.companyId && rating.pendingTypes.includes('PRODUCER_TO_COMPANY') && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2 ml-9">
                                <Building2 className="h-3 w-3" />
                                <span>Inclui avaliação da transportadora</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {(rating.originAddress || rating.destinationAddress) && (
                          <div className="space-y-1.5 mb-3 ml-9">
                            {rating.originAddress && (
                              <div className="flex items-center gap-2 text-sm">
                                <MapPin className="h-3 w-3 text-green-600 shrink-0" />
                                <span className="truncate">{rating.originAddress}</span>
                              </div>
                            )}
                            {rating.destinationAddress && (
                              <div className="flex items-center gap-2 text-sm">
                                <MapPin className="h-3 w-3 text-red-600 shrink-0" />
                                <span className="truncate">{rating.destinationAddress}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                          <Clock className="h-3 w-3" />
                          <span>Pagamento confirmado em {format(new Date(rating.paymentConfirmedAt), 'dd/MM/yyyy HH:mm')}</span>
                        </div>

                        <Button 
                          onClick={() => openRatingModal(rating)}
                          className="w-full"
                          size="sm"
                        >
                          <Star className="h-4 w-4 mr-2" />
                          {rating.pendingTypes.length > 1 
                            ? `Avaliar (${rating.pendingTypes.length} etapas)`
                            : `Avaliar ${getRatingStepLabel(rating.pendingTypes[0])}`
                          }
                        </Button>
                      </CardContent>
                    </Card>
                  </React.Fragment>
                ))}
              </SafeListWrapper>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Multi-Step para avaliações com múltiplas etapas */}
      {selectedRating && selectedRating.pendingTypes.length > 0 && (
        <FreightRatingMultiStepModal
          isOpen={ratingModalOpen}
          onClose={() => {
            setRatingModalOpen(false);
            setSelectedRating(null);
          }}
          onAllRatingsSubmitted={handleRatingSubmitted}
          freightId={selectedRating.freightId}
          assignmentId={selectedRating.assignmentId || undefined}
          raterId={userProfileId}
          steps={buildRatingSteps(selectedRating)}
        />
      )}
    </>
  );
}, (prevProps, nextProps) => {
  return prevProps.userProfileId === nextProps.userProfileId &&
         prevProps.userRole === nextProps.userRole;
});

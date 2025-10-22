import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, User, MapPin, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FreightRatingModal } from './FreightRatingModal';
import { format } from 'date-fns';

interface PendingRating {
  id: string;
  cargo_type: string;
  origin_address: string;
  destination_address: string;
  price: number;
  updated_at: string;
  producer_profiles?: {
    full_name: string;
  };
  driver_profiles?: {
    full_name: string;
  };
}

interface PendingRatingsPanelProps {
  userRole: 'PRODUTOR' | 'MOTORISTA';
  userProfileId: string;
}

export const PendingRatingsPanel: React.FC<PendingRatingsPanelProps> = React.memo(({
  userRole,
  userProfileId
}) => {
  const [pendingRatings, setPendingRatings] = useState<PendingRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFreight, setSelectedFreight] = useState<PendingRating | null>(null);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);

  const fetchPendingRatings = async () => {
    try {
      setLoading(true);
      
      // Get freights that are COMPLETED but user hasn't rated yet
      const { data: freights, error: freightsError } = await supabase
        .from('freights')
        .select(`
          id,
          cargo_type,
          origin_address,
          destination_address,
          price,
          updated_at,
          producer_id,
          driver_id,
          producer_profiles:profiles!freights_producer_id_fkey(full_name),
          driver_profiles:profiles!freights_driver_id_fkey(full_name)
        `)
        .eq('status', 'COMPLETED')
        .or(`producer_id.eq.${userProfileId},driver_id.eq.${userProfileId}`);

      if (freightsError) throw freightsError;

      if (!freights || freights.length === 0) {
        setPendingRatings([]);
        return;
      }

      // Check which ones the user hasn't rated yet
      const freightIds = freights.map(f => f.id);
      const ratingType = userRole === 'PRODUTOR' ? 'PRODUCER_TO_DRIVER' : 'DRIVER_TO_PRODUCER';

      const { data: existingRatings, error: ratingsError } = await supabase
        .from('freight_ratings')
        .select('freight_id')
        .in('freight_id', freightIds)
        .eq('rater_id', userProfileId)
        .eq('rating_type', ratingType);

      if (ratingsError) throw ratingsError;

      const ratedFreightIds = new Set(existingRatings?.map(r => r.freight_id) || []);
      const unratedFreights = freights.filter(f => !ratedFreightIds.has(f.id));

      setPendingRatings(unratedFreights);
      
    } catch (error) {
      console.error('Erro ao buscar avaliações pendentes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    const loadRatings = async () => {
      if (!userProfileId || !mounted) return;
      
      try {
        setLoading(true);
        await fetchPendingRatings();
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    loadRatings();
    
    return () => {
      mounted = false;
    };
  }, [userProfileId]);

  const handleRatingSubmitted = () => {
    fetchPendingRatings(); // Refresh the list
  };

  const openRatingModal = (freight: PendingRating) => {
    setSelectedFreight(freight);
    setRatingModalOpen(true);
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
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
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
              {pendingRatings.map((freight) => (
                <Card key={`rating-${freight.id}-${freight.updated_at}`} className="border-l-4 border-l-amber-500 bg-amber-50/50">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold">{freight.cargo_type}</h4>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <User className="h-3 w-3" />
                          <span>
                            {userRole === 'PRODUTOR' 
                              ? freight.driver_profiles?.full_name || 'Motorista'
                              : freight.producer_profiles?.full_name || 'Produtor'
                            }
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">
                          R$ {freight.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3 w-3 text-green-600" />
                        <span className="truncate">{freight.origin_address}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3 w-3 text-red-600" />
                        <span className="truncate">{freight.destination_address}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Concluído em {format(new Date(freight.updated_at), 'dd/MM/yyyy HH:mm')}</span>
                      </div>
                    </div>

                    <Button 
                      onClick={() => openRatingModal(freight)}
                      className="w-full"
                      size="sm"
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Avaliar {userRole === 'PRODUTOR' ? 'Motorista' : 'Produtor'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedFreight && (
        <FreightRatingModal
          freight={selectedFreight}
          isOpen={ratingModalOpen}
          onClose={() => {
            setRatingModalOpen(false);
            setSelectedFreight(null);
          }}
          onRatingSubmitted={handleRatingSubmitted}
          userRole={userRole}
        />
      )}
    </>
  );
}, (prevProps, nextProps) => {
  // Evitar re-renders desnecessários
  return prevProps.userProfileId === nextProps.userProfileId &&
         prevProps.userRole === nextProps.userRole;
});
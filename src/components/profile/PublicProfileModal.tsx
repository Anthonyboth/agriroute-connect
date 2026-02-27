/**
 * PublicProfileModal.tsx
 * 
 * Modal somente leitura para visualização de perfil público.
 * Não exibe dados sensíveis (CPF/CNPJ, e-mail, telefone, endereço).
 * 
 * CORREÇÕES:
 * - Substituiu ScrollArea por scroll nativo (compatibilidade iOS/Capacitor)
 * - Ratings: não exibe nota quando totalRatings === 0
 * - Usa useSignedImageUrl para resolver foto privada
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  User, Star, Truck, MapPin, Calendar, Award, CheckCircle, Clock, Loader2, ExternalLink
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSignedImageUrl } from '@/hooks/useSignedImageUrl';

interface PublicProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userType: 'driver' | 'producer';
  userName?: string;
}

interface PublicProfileData {
  id: string;
  full_name: string;
  avatar_url?: string;
  role: string;
  created_at: string;
  completed_freights?: number;
  average_rating?: number;
  total_ratings?: number;
  is_verified?: boolean;
}

const AvatarWithSignedUrl: React.FC<{ url?: string; name: string; onZoom?: () => void }> = ({ url, name, onZoom }) => {
  const { url: resolvedUrl } = useSignedImageUrl(url || null);
  const getInitials = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="relative group">
      <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
        <AvatarImage src={resolvedUrl || undefined} alt={name} className="object-cover" />
        <AvatarFallback className="text-2xl bg-primary/10 text-primary">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      {resolvedUrl && onZoom && (
        <Button
          size="sm"
          variant="secondary"
          className="absolute -bottom-1 -right-1 h-7 w-7 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onZoom}
          title="Ampliar foto"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
};

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({
  isOpen,
  onClose,
  userId,
  userType,
  userName
}) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [photoZoom, setPhotoZoom] = useState(false);

  useEffect(() => {
    if (isOpen && userId) fetchPublicProfile();
  }, [isOpen, userId]);

  const fetchPublicProfile = async () => {
    setLoading(true);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles_secure')
        .select('id, full_name, profile_photo_url, created_at, rating, total_ratings, status')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profileData) { setProfile(null); return; }

      let completedFreights = 0;
      if (userType === 'driver') {
        const { count } = await supabase
          .from('freights')
          .select('*', { count: 'exact', head: true })
          .eq('driver_id', userId)
          .in('status', ['DELIVERED', 'COMPLETED']);
        completedFreights = count || 0;
      } else {
        const { count } = await supabase
          .from('freights')
          .select('*', { count: 'exact', head: true })
          .eq('producer_id', userId)
          .in('status', ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED', 'DELIVERED', 'DELIVERED_PENDING_CONFIRMATION', 'COMPLETED']);
        completedFreights = count || 0;
      }

      const totalRatings = (profileData as any).total_ratings || 0;
      const averageRating = (profileData as any).rating || 0;
      const avatarUrl = (profileData as any).profile_photo_url;

      setProfile({
        id: (profileData as any).id,
        full_name: (profileData as any).full_name,
        avatar_url: avatarUrl || undefined,
        role: userType === 'driver' ? 'MOTORISTA' : 'PRODUTOR',
        created_at: (profileData as any).created_at,
        completed_freights: completedFreights,
        average_rating: averageRating,
        total_ratings: totalRatings,
        is_verified: (profileData as any).status === 'APPROVED',
      });
    } catch (error) {
      console.error('Erro ao buscar perfil público:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      'MOTORISTA': 'Motorista', 'MOTORISTA_AFILIADO': 'Motorista Afiliado',
      'PRODUTOR': 'Produtor Rural', 'TRANSPORTADORA': 'Transportadora',
    };
    return labels[role] || role;
  };

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.5;
    const stars = [];
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) stars.push(<Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />);
      else if (i === fullStars && hasHalf) stars.push(<Star key={i} className="h-4 w-4 fill-yellow-400/50 text-yellow-400" />);
      else stars.push(<Star key={i} className="h-4 w-4 text-muted-foreground/30" />);
    }
    return stars;
  };

  const hasRatings = (profile?.total_ratings || 0) > 0;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 !overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Perfil {userType === 'driver' ? 'do Motorista' : 'do Produtor'}
            </DialogTitle>
            <DialogDescription>Informações públicas do perfil</DialogDescription>
          </DialogHeader>

          {/* ✅ Native scroll instead of ScrollArea — iOS compatible */}
          <div 
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !profile ? (
              <div className="text-center py-12 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Perfil não encontrado</p>
                <p className="text-sm">Não foi possível carregar as informações.</p>
              </div>
            ) : (
              <div className="space-y-6 pb-6">
                {/* Avatar e Nome */}
                <div className="flex flex-col items-center text-center">
                  <AvatarWithSignedUrl 
                    url={profile.avatar_url} 
                    name={profile.full_name} 
                    onZoom={() => setPhotoZoom(true)} 
                  />

                  <h3 className="mt-4 text-xl font-semibold">{profile.full_name}</h3>
                  
                  <Badge variant="secondary" className="mt-2">
                    {userType === 'driver' ? <Truck className="h-3 w-3 mr-1" /> : <MapPin className="h-3 w-3 mr-1" />}
                    {getRoleLabel(profile.role)}
                  </Badge>

                  {/* ✅ Only show rating when there are actual ratings */}
                  {hasRatings && (
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex">{renderStars(profile.average_rating || 0)}</div>
                      <span className="text-sm text-muted-foreground">
                        {(profile.average_rating || 0).toFixed(1)} ({profile.total_ratings} avaliações)
                      </span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Estatísticas */}
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-primary">{profile.completed_freights || 0}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {userType === 'driver' ? 'Fretes Realizados' : 'Fretes Contratados'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                        {hasRatings ? (
                          <>
                            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                            {(profile.average_rating || 0).toFixed(1)}
                          </>
                        ) : (
                          <span className="text-muted-foreground text-lg">—</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Avaliação Média</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Informações */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Informações
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Membro desde {format(new Date(profile.created_at), "MMMM 'de' yyyy", { locale: ptBR })}</span>
                    </div>
                    {(profile.completed_freights || 0) > 0 && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        <span>
                          {userType === 'driver' 
                            ? 'Motorista verificado com entregas concluídas'
                            : 'Produtor com histórico de fretes'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Nota de privacidade */}
                <div className="bg-muted/30 p-3 rounded-lg text-xs text-muted-foreground text-center">
                  <Clock className="h-4 w-4 inline-block mr-1" />
                  Apenas informações públicas são exibidas. Dados de contato são compartilhados apenas após aceite do frete.
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t flex-shrink-0">
            <Button onClick={onClose} className="w-full" variant="outline">Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de zoom da foto */}
      <Dialog open={photoZoom} onOpenChange={setPhotoZoom}>
        <DialogContent className="max-w-lg p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Foto de {profile?.full_name}</DialogTitle>
          </DialogHeader>
          {profile?.avatar_url && (
            <ZoomedImage url={profile.avatar_url} name={profile.full_name} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const ZoomedImage: React.FC<{ url: string; name: string }> = ({ url, name }) => {
  const { url: resolvedUrl } = useSignedImageUrl(url);
  return (
    <img 
      src={resolvedUrl || '/placeholder.svg'} 
      alt={name}
      className="w-full h-auto rounded-lg object-cover max-h-[80vh]"
      onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
    />
  );
};

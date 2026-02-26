/**
 * ParticipantProfileModal.tsx
 * 
 * Modal expandido para visualização de perfil público de participantes.
 * Inclui informações não sensíveis, fotos de veículo para motoristas, e estatísticas.
 * 
 * ATUALIZAÇÃO: Agora usa hook dedicado useVehiclePhotoViewer e VehiclePhotoZoomModal
 * para garantir que as fotos do veículo abram corretamente para produtores.
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  User, 
  Star, 
  Truck, 
  MapPin, 
  Calendar, 
  Award, 
  CheckCircle,
  Clock,
  Loader2,
  ExternalLink,
  Camera,
  ShieldCheck,
  Weight
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useParticipantProfile } from '@/hooks/useParticipantProfile';
import { useVehiclePhotoViewer } from '@/hooks/useVehiclePhotoViewer';
import { VehiclePhotoZoomModal } from './VehiclePhotoZoomModal';
import { cn } from '@/lib/utils';
import { StorageImage } from '@/components/ui/storage-image';

interface ParticipantProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userType: 'driver' | 'producer';
  userName?: string;
  /** Contexto opcional para autorizar fallback via Edge Function */
  freightId?: string;
}

export const ParticipantProfileModal: React.FC<ParticipantProfileModalProps> = ({
  isOpen,
  onClose,
  userId,
  userType,
  userName,
  freightId
}) => {
  // Hook dedicado para visualização de fotos do veículo
  const photoViewer = useVehiclePhotoViewer();

  const { profile, vehicle, vehiclePhotos, isLoading } = useParticipantProfile(
    isOpen ? userId : null,
    userType,
    freightId
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      'MOTORISTA': 'Motorista',
      'MOTORISTA_AFILIADO': 'Motorista Afiliado',
      'PRODUTOR': 'Produtor Rural',
      'TRANSPORTADORA': 'Transportadora',
      'ADMIN': 'Administrador',
      'GUEST': 'Visitante'
    };
    return labels[role] || role;
  };

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.5;
    const stars = [];
    
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />);
      } else if (i === fullStars && hasHalf) {
        stars.push(<Star key={i} className="h-4 w-4 fill-yellow-400/50 text-yellow-400" />);
      } else {
        stars.push(<Star key={i} className="h-4 w-4 text-muted-foreground/30" />);
      }
    }
    return stars;
  };

  // Handler para abrir foto do avatar
  const handleAvatarClick = () => {
    if (profile?.avatar_url) {
      photoViewer.openPhoto([{
        id: 'avatar',
        photo_url: profile.avatar_url,
        photo_type: 'avatar',
        created_at: profile.created_at
      }], 0);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-md max-h-[90vh] h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Perfil {userType === 'driver' ? 'do Motorista' : 'do Produtor'}
            </DialogTitle>
            <DialogDescription>
              Informações públicas do perfil
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 px-6">
            {isLoading ? (
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
                  <div className="relative group">
                    <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                      <AvatarImage 
                        src={profile.avatar_url || undefined} 
                        alt={profile.full_name}
                        className="object-cover"
                      />
                      <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                        {getInitials(profile.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    {profile.avatar_url && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="absolute -bottom-1 -right-1 h-7 w-7 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={handleAvatarClick}
                        title="Ampliar foto"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {profile.is_verified && (
                      <div className="absolute -top-1 -right-1">
                        <ShieldCheck className="h-6 w-6 text-primary fill-primary/20" />
                      </div>
                    )}
                  </div>

                  <h3 className="mt-4 text-xl font-semibold">{profile.full_name}</h3>
                  
                  <Badge variant="secondary" className="mt-2">
                    {userType === 'driver' ? <Truck className="h-3 w-3 mr-1" /> : <MapPin className="h-3 w-3 mr-1" />}
                    {getRoleLabel(profile.role)}
                  </Badge>

                  {/* Avaliação */}
                  {(profile.total_ratings || 0) > 0 && (
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex">
                        {renderStars(profile.average_rating || 0)}
                      </div>
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
                      <div className="text-2xl font-bold text-primary">
                        {profile.completed_freights || 0}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {userType === 'driver' ? 'Fretes Realizados' : 'Fretes Contratados'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                        {(profile.average_rating || 0) > 0 ? (
                          <>
                            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                            {(profile.average_rating || 0).toFixed(1)}
                          </>
                        ) : (
                          <span className="text-muted-foreground text-lg">—</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Avaliação Média
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Veículo (apenas para motoristas) */}
                {userType === 'driver' && vehicle && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Veículo
                      </h4>
                      
                      <Card>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Tipo:</span>
                            <span className="text-sm font-medium">{vehicle.type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Placa:</span>
                            <span className="text-sm font-medium font-mono">{vehicle.plate_masked}</span>
                          </div>
                          {vehicle.capacity_kg && (
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Capacidade:</span>
                              <span className="text-sm font-medium flex items-center gap-1">
                                <Weight className="h-3 w-3" />
                                {(vehicle.capacity_kg / 1000).toFixed(1)}t
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Fotos do Veículo */}
                      {vehiclePhotos.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Camera className="h-3 w-3" />
                            Fotos do Veículo ({vehiclePhotos.length})
                          </h5>
                          <div className="grid grid-cols-3 gap-2">
                            {vehiclePhotos.map((photo, index) => (
                              <div 
                                key={photo.id}
                                className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all group"
                                onClick={() => photoViewer.openPhoto(vehiclePhotos, index)}
                              >
                                <StorageImage
                                  src={photo.photo_url}
                                  alt={`${vehicle.type} - ${photo.photo_type}`}
                                  className="w-full h-full"
                                  showLoader
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <ExternalLink className="h-4 w-4 text-white" />
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5 text-[10px] text-white truncate">
                                  {photoViewer.getPhotoTypeLabel(photo.photo_type)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Informações Adicionais */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Informações
                  </h4>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Membro desde {format(new Date(profile.created_at), "MMMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    </div>

                    {(profile.completed_freights || 0) > 0 && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>
                          {userType === 'driver' 
                            ? 'Motorista com entregas concluídas'
                            : 'Produtor com histórico de fretes'
                          }
                        </span>
                      </div>
                    )}

                    {profile.is_verified && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <span>Perfil verificado</span>
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
          </ScrollArea>

          <div className="p-4 border-t">
            <Button onClick={onClose} className="w-full" variant="outline">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de zoom da foto com navegação */}
      <VehiclePhotoZoomModal
        isOpen={photoViewer.viewerState.isOpen}
        photoUrl={photoViewer.currentPhoto?.photo_url || null}
        photoTitle={
          photoViewer.currentPhoto 
            ? `${vehicle?.type || 'Veículo'} - ${photoViewer.getPhotoTypeLabel(photoViewer.currentPhoto.photo_type)}`
            : ''
        }
        onClose={photoViewer.closeViewer}
        onNext={photoViewer.goToNext}
        onPrevious={photoViewer.goToPrevious}
        hasNext={photoViewer.hasNext}
        hasPrevious={photoViewer.hasPrevious}
        currentIndex={photoViewer.viewerState.currentIndex}
        totalPhotos={photoViewer.totalPhotos}
      />
    </>
  );
};

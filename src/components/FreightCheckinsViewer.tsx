import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  CheckCircle, 
  Clock, 
  MapPin, 
  Camera, 
  MessageSquare,
  User,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FreightCheckin {
  id: string;
  freight_id: string;
  user_id: string;
  checkin_type: string;
  observations?: string;
  status: string;
  location_lat?: number;
  location_lng?: number;
  location_address?: string;
  photos?: string[];
  created_at: string;
  updated_at: string;
  requires_counterpart_confirmation: boolean;
  counterpart_confirmed_by?: string;
  counterpart_confirmed_at?: string;
  metadata?: any;
}

interface FreightCheckinsViewerProps {
  freightId: string;
  currentUserProfile: any;
  onRefresh?: () => void;
}

const FreightCheckinsViewer: React.FC<FreightCheckinsViewerProps> = ({
  freightId,
  currentUserProfile,
  onRefresh
}) => {
  const [checkins, setCheckins] = useState<FreightCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmationObservations, setConfirmationObservations] = useState('');
  const [confirmingCheckinId, setConfirmingCheckinId] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [showPhotosModal, setShowPhotosModal] = useState(false);

  const fetchCheckins = async () => {
    try {
      const { data, error } = await supabase
        .from('freight_checkins' as any)
        .select('*')
        .eq('freight_id', freightId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCheckins((data as any[] || []).filter(item => item && typeof item === 'object'));
    } catch (error: any) {
      console.error('Erro ao buscar check-ins:', error);
      toast.error('Erro ao carregar check-ins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCheckins();
  }, [freightId]);

  const getCheckinTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'LOADING': 'A caminho da coleta',
      'UNLOADING': 'Descarregamento',
      'IN_TRANSIT': 'Em Trajeto',
      'DELAY': 'Atraso/Problema',
      'REST_STOP': 'Parada de Descanso'
    };
    return types[type] || type;
  };

  const getStatusBadge = (checkin: FreightCheckin) => {
    if (checkin.status === 'CONFIRMED') {
      return <Badge variant="default" className="bg-green-500">Confirmado</Badge>;
    } else if (checkin.requires_counterpart_confirmation) {
      return <Badge variant="secondary">Aguardando Confirmação</Badge>;
    } else {
      return <Badge variant="outline">Registrado</Badge>;
    }
  };

  const canConfirmCheckin = (checkin: FreightCheckin) => {
    if (!checkin.requires_counterpart_confirmation) return false;
    if (checkin.status === 'CONFIRMED') return false;
    if (checkin.user_id === currentUserProfile.id) return false;
    return true;
  };

  const handleConfirmCheckin = async (checkinId: string) => {
    try {
      const { data, error } = await supabase.rpc('confirm_checkin_as_counterpart' as any, {
        p_checkin_id: checkinId,
        p_observations: confirmationObservations || null
      });

      if (error) throw error;

      if (data) {
        toast.success('Check-in confirmado com sucesso!');
        setConfirmingCheckinId(null);
        setConfirmationObservations('');
        fetchCheckins();
        onRefresh?.();
      } else {
        toast.error('Não foi possível confirmar este check-in');
      }
    } catch (error: any) {
      console.error('Erro ao confirmar check-in:', error);
      toast.error('Erro ao confirmar check-in. Tente novamente.');
    }
  };

  const viewPhotos = (photos: string[]) => {
    setSelectedPhotos(photos);
    setShowPhotosModal(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Check-ins do Frete
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Carregando check-ins...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Check-ins do Frete ({checkins.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {checkins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum check-in registrado ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {checkins.map((checkin) => (
                <div key={checkin.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{getCheckinTypeLabel(checkin.checkin_type)}</h4>
                        {getStatusBadge(checkin)}
                      </div>
                      
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {checkin.metadata?.user_name || 'Usuário'} ({checkin.metadata?.user_role || 'N/A'})
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(checkin.created_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </div>
                        
                        {checkin.location_address && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {checkin.location_address}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {checkin.observations && (
                    <div className="bg-muted rounded p-2">
                      <p className="text-sm">{checkin.observations}</p>
                    </div>
                  )}

                  {checkin.photos && checkin.photos.length > 0 && (
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewPhotos(checkin.photos!)}
                        className="flex items-center gap-1"
                      >
                        <Camera className="h-4 w-4" />
                        Ver Fotos ({checkin.photos.length})
                      </Button>
                    </div>
                  )}

                  {canConfirmCheckin(checkin) && (
                    <div className="border-t pt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium">Confirmação Necessária</span>
                      </div>
                      
                      {confirmingCheckinId === checkin.id ? (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Observações adicionais (opcional)"
                            value={confirmationObservations}
                            onChange={(e) => setConfirmationObservations(e.target.value)}
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleConfirmCheckin(checkin.id)}
                            >
                              Confirmar Check-in
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setConfirmingCheckinId(null);
                                setConfirmationObservations('');
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmingCheckinId(checkin.id)}
                        >
                          Confirmar Check-in
                        </Button>
                      )}
                    </div>
                  )}

                  {checkin.counterpart_confirmed_at && (
                    <div className="border-t pt-2 text-sm text-green-600">
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Confirmado em {new Date(checkin.counterpart_confirmed_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Fotos */}
      <Dialog open={showPhotosModal} onOpenChange={setShowPhotosModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fotos do Check-in</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedPhotos.map((photo, index) => (
              <div key={index} className="space-y-2">
                <img
                  src={photo}
                  alt={`Foto ${index + 1}`}
                  className="w-full h-64 object-cover rounded border"
                />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FreightCheckinsViewer;
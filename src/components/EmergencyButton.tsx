import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  AlertTriangle, 
  Phone, 
  MapPin, 
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface EmergencyEvent {
  id: string;
  event_type: string;
  location_lat?: number;
  location_lng?: number;
  description?: string;
  status: string;
  created_at: string;
  resolved_at?: string;
}

interface EmergencyButtonProps {
  freightId?: string;
  className?: string;
}

export const EmergencyButton: React.FC<EmergencyButtonProps> = ({ 
  freightId, 
  className = "" 
}) => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [eventType, setEventType] = useState('SOS');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [emergencyHistory, setEmergencyHistory] = useState<EmergencyEvent[]>([]);

  useEffect(() => {
    if (profile) {
      fetchEmergencyHistory();
    }
  }, [profile]);

  const fetchEmergencyHistory = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('emergency_events')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setEmergencyHistory(data || []);
    } catch (error) {
      console.error('Erro ao buscar histórico de emergências:', error);
    }
  };

  const getCurrentLocation = async () => {
    const { getCurrentPositionSafe } = await import('@/utils/location');
    return getCurrentPositionSafe();
  };

  const handleEmergency = async () => {
    if (!profile) {
      toast.error('Usuário não autenticado');
      return;
    }

    setLoading(true);

    try {
      // Obter localização atual
      let location = null;
      try {
        const position = await getCurrentLocation();
        location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setCurrentLocation(location);
      } catch (locationError) {
        console.error('Erro ao obter localização:', locationError);
        toast.error('Não foi possível obter sua localização');
      }

      // Criar evento de emergência
      const emergencyData = {
        user_id: profile.id,
        freight_id: freightId || null,
        event_type: eventType,
        location_lat: location?.lat || null,
        location_lng: location?.lng || null,
        description: description.trim() || null,
        status: 'ACTIVE'
      };

      const { data: emergencyEvent, error } = await supabase
        .from('emergency_events')
        .insert(emergencyData)
        .select()
        .single();

      if (error) throw error;

      // Enviar notificação para admins
      const { error: notificationError } = await supabase.rpc('send_notification', {
        p_user_id: profile.id, // Para o próprio usuário também
        p_title: `🚨 EMERGÊNCIA - ${eventType}`,
        p_message: `${profile.full_name} acionou emergência: ${description || eventType}. ${location ? `Localização: ${location.lat}, ${location.lng}` : 'Localização não disponível'}`,
        p_type: 'emergency',
        p_data: {
          emergency_event_id: emergencyEvent.id,
          location: location,
          freight_id: freightId
        }
      });

      if (notificationError) {
        console.error('Erro ao enviar notificação:', notificationError);
      }

      // Aqui você pode adicionar integração com serviços de emergência
      // Por exemplo, enviar SMS, chamar API de emergência, etc.

      toast.success('Emergência registrada! Ajuda está a caminho.');
      
      setIsOpen(false);
      setDescription('');
      setEventType('SOS');
      fetchEmergencyHistory();

    } catch (error) {
      console.error('Erro ao registrar emergência:', error);
      toast.error('Erro ao registrar emergência');
    } finally {
      setLoading(false);
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'SOS': return 'SOS Geral';
      case 'EMERGENCY': return 'Emergência Médica';
      case 'BREAKDOWN': return 'Pane no Veículo';
      case 'ACCIDENT': return 'Acidente';
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLabels: Record<string, string> = {
      'ACTIVE': 'Ativo',
      'RESOLVED': 'Resolvido',
      'CANCELLED': 'Cancelado',
      'PENDING': 'Pendente'
    };
    const label = statusLabels[status] || status;
    
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="destructive" className="animate-pulse"><AlertTriangle className="w-3 h-3 mr-1" />{label}</Badge>;
      case 'RESOLVED':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />{label}</Badge>;
      case 'CANCELLED':
        return <Badge variant="outline"><XCircle className="w-3 h-3 mr-1" />{label}</Badge>;
      default:
        return <Badge variant="outline">{label}</Badge>;
    }
  };

  if (!profile) return null;

  return (
    <div className={className}>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="destructive" 
            size="lg"
            className="bg-red-600 hover:bg-red-700 animate-pulse shadow-lg"
          >
            <AlertTriangle className="w-5 h-5 mr-2" />
            EMERGÊNCIA / SOS
          </Button>
        </DialogTrigger>
        
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Acionar Emergência
            </DialogTitle>
            <DialogDescription>
              Use apenas em situações reais de emergência. Sua localização será enviada automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="event-type">Tipo de Emergência</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOS">🆘 SOS Geral</SelectItem>
                  <SelectItem value="EMERGENCY">🚑 Emergência Médica</SelectItem>
                  <SelectItem value="BREAKDOWN">🔧 Pane no Veículo</SelectItem>
                  <SelectItem value="ACCIDENT">🚗 Acidente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Descrição da Situação</Label>
              <Textarea
                id="description"
                placeholder="Descreva brevemente a situação de emergência..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800">Importante:</p>
                  <ul className="text-yellow-700 mt-1 space-y-1">
                    <li>• Sua localização será enviada automaticamente</li>
                    <li>• Os administradores serão notificados imediatamente</li>
                    <li>• Use apenas para emergências reais</li>
                    <li>• Em caso de risco de vida, ligue 192 (SAMU)</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleEmergency}
                disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {loading ? 'Enviando...' : 'Acionar Emergência'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Histórico de Emergências */}
      {emergencyHistory.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">Últimas Emergências</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {emergencyHistory.slice(0, 3).map((event) => (
              <div key={event.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span>{getEventTypeLabel(event.event_type)}</span>
                  <span className="text-muted-foreground">
                    {new Date(event.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                {getStatusBadge(event.status)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
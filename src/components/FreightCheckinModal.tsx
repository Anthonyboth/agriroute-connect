import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { supabaseWithErrorMonitoring } from '@/lib/supabaseErrorWrapper';
import { toast } from 'sonner';
import { Camera, Upload, MapPin, CheckCircle } from 'lucide-react';

interface FreightCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  freightId: string;
  currentUserProfile: any;
  onCheckinCreated?: () => void;
  initialType?: string;
}

const FreightCheckinModal: React.FC<FreightCheckinModalProps> = ({
  isOpen,
  onClose,
  freightId,
  currentUserProfile,
  onCheckinCreated,
  initialType
}) => {
  const [checkinType, setCheckinType] = useState<string>('');
  const [observations, setObservations] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);

  // Preseleciona o tipo de check-in quando aberto por atalho
  useEffect(() => {
    if (isOpen && initialType) {
      setCheckinType(initialType);
    }
  }, [isOpen, initialType]);

  const checkinTypes = [
    { value: 'LOADING', label: 'A caminho da coleta', requiresCounterpart: true },
    { value: 'UNLOADING', label: 'Descarregamento', requiresCounterpart: true },
    { value: 'IN_TRANSIT', label: 'Durante o Trajeto', requiresCounterpart: false },
    { value: 'DELAY', label: 'Atraso/Problema', requiresCounterpart: false },
    { value: 'REST_STOP', label: 'Parada de Descanso', requiresCounterpart: false },
  ];

  const getCurrentLocation = async () => {
    try {
      const { getCurrentPositionSafe } = await import('@/utils/location');
      const position = await getCurrentPositionSafe();
      const { latitude, longitude } = position.coords;
      
      try {
        const response = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`
        );
        const data = await response.json();
        
        setLocation({
          lat: latitude,
          lng: longitude,
          address: data.locality || data.city || `${latitude}, ${longitude}`
        });
        
        toast.success('Localização capturada com sucesso');
      } catch (error) {
        setLocation({
          lat: latitude,
          lng: longitude,
          address: `${latitude}, ${longitude}`
        });
        toast.success('Localização capturada');
      }
    } catch (error) {
      toast.error('Erro ao obter localização. Verifique as permissões.');
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length !== files.length) {
      toast.error('Apenas arquivos de imagem são permitidos');
    }
    
    setPhotos(prev => [...prev, ...validFiles].slice(0, 5)); // Máximo 5 fotos
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (checkinId: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const photo of photos) {
      const fileName = `${checkinId}_${Date.now()}_${photo.name}`;
      const { data, error } = await supabase.storage
        .from('freight-checkins')
        .upload(fileName, photo);
      
      if (error) throw error;
      
      const { data: signedData, error: signError } = await supabase.storage
        .from('freight-checkins')
        .createSignedUrl(fileName, 86400); // 24h
      
      if (signError || !signedData?.signedUrl) {
        console.error('[Checkin] Erro ao gerar signed URL:', signError?.message);
        throw signError || new Error('Falha ao gerar URL assinada');
      }
      
      uploadedUrls.push(signedData.signedUrl);
    }
    
    return uploadedUrls;
  };

  const handleSubmit = async () => {
    if (!checkinType) {
      toast.error('Selecione o tipo de check-in');
      return;
    }

    setLoading(true);
    
    try {
      const selectedType = checkinTypes.find(t => t.value === checkinType);
      
      // Criar o check-in
      const checkinData = {
        freight_id: freightId,
        user_id: currentUserProfile.id,
        checkin_type: checkinType,
        observations,
        location_lat: location?.lat,
        location_lng: location?.lng,
        location_address: location?.address,
        requires_counterpart_confirmation: selectedType?.requiresCounterpart || false,
        status: selectedType?.requiresCounterpart ? 'PENDING' : 'CONFIRMED',
        metadata: {
          user_role: currentUserProfile.active_mode || currentUserProfile.role || 'UNKNOWN',
          user_name: currentUserProfile.full_name
        }
      };

      const { data: checkin, error: checkinError } = await supabaseWithErrorMonitoring(
        () => supabase
          .from('freight_checkins' as any)
          .insert(checkinData)
          .select()
          .single() as any,
        {
          module: 'FreightCheckinModal',
          functionName: 'handleSubmit',
          operation: 'INSERT freight_checkins',
          additionalInfo: { checkin_type: checkinType }
        }
      ) as { data: any; error: any };

      if (checkinError) throw checkinError;

      // Upload das fotos se houver
      let photoUrls: string[] = [];
      if (photos.length > 0 && checkin?.id) {
        photoUrls = await uploadPhotos(checkin.id);
        
        // Atualizar check-in com URLs das fotos
        const { error: updateError } = await supabase
          .from('freight_checkins' as any)
          .update({ photos: photoUrls })
          .eq('id', checkin.id);
        
        if (updateError) throw updateError;
      }

      toast.success(
        selectedType?.requiresCounterpart 
          ? 'Check-in criado! Aguardando confirmação da outra parte.'
          : 'Check-in registrado com sucesso!'
      );
      
      onCheckinCreated?.();
      onClose();
      
      // Reset form
      setCheckinType('');
      setObservations('');
      setPhotos([]);
      setLocation(null);
      
    } catch (error: any) {
      console.error('Erro ao criar check-in:', error);
      toast.error('Erro ao registrar check-in. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Registrar Check-in
          </DialogTitle>
          <DialogDescription className="sr-only">
            Registre o status da carga e envie fotos durante o transporte
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="checkin-type">Tipo de Check-in</Label>
            <Select value={checkinType} onValueChange={setCheckinType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de check-in" />
              </SelectTrigger>
              <SelectContent>
                {checkinTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                    {type.requiresCounterpart && (
                      <span className="text-xs text-muted-foreground ml-2">
                        (Requer confirmação)
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Localização</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={getCurrentLocation}
                className="flex items-center gap-1"
              >
                <MapPin className="h-4 w-4" />
                Capturar Localização
              </Button>
              {location && (
                <span className="text-xs text-muted-foreground truncate">
                  {location.address}
                </span>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Descreva o status da carga, condições, ou qualquer observação importante..."
              rows={3}
            />
          </div>

          <div>
            <Label>Fotos (Opcional)</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoChange}
                  className="hidden"
                  id="photo-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('photo-upload')?.click()}
                  className="flex items-center gap-1"
                >
                  <Upload className="h-4 w-4" />
                  Adicionar Fotos
                </Button>
                <span className="text-xs text-muted-foreground">
                  Máximo 5 fotos
                </span>
              </div>
              
              {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {photos.map((photo, index) => (
                    <div key={`checkin-photo-${index}-${photo.name}`} className="relative">
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-20 object-cover rounded border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0"
                        onClick={() => removePhoto(index)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="flex-1">
              {loading ? 'Registrando...' : 'Registrar Check-in'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FreightCheckinModal;
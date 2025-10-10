import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CitySelector } from './CitySelector';
import { RadiusSelector } from './RadiusSelector';
import { MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface LocationValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationConfigured: () => void;
  requiredForAction?: string;
}

export const LocationValidationModal: React.FC<LocationValidationModalProps> = ({
  isOpen,
  onClose,
  onLocationConfigured,
  requiredForAction = "continuar"
}) => {
  const [city, setCity] = useState({ city: '', state: '' });
  const [radius, setRadius] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();

  // Verificar se usuário já tem localização configurada
  useEffect(() => {
    const checkExistingLocation = async () => {
      if (!user || !isOpen) return;

      setIsLoading(true);
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('base_city_name, base_state, service_radius_km')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;

        if (profile.base_city_name && profile.base_state) {
          setCity({
            city: profile.base_city_name,
            state: profile.base_state
          });
          setRadius(profile.service_radius_km || 50);
        }
      } catch (error) {
        console.error('Erro ao verificar localização existente:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingLocation();
  }, [user, isOpen]);

  const handleSaveLocation = async () => {
    if (!city.city || !city.state) {
      toast.error('Por favor, selecione uma cidade válida');
      return;
    }

    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    setIsSaving(true);
    try {
      // Atualizar perfil do usuário
      const { error } = await supabase
        .from('profiles')
        .update({
          base_city_name: city.city,
          base_state: city.state,
          service_radius_km: radius,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Localização configurada com sucesso!');
      onLocationConfigured();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar localização:', error);
      toast.error('Erro ao salvar localização. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-md">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Configuração de Localização Obrigatória
          </DialogTitle>
          <DialogDescription>
            Para {requiredForAction}, você precisa configurar sua cidade e raio de atendimento.
            Isso garante que você veja apenas solicitações relevantes para sua região.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Sistema de Localização Inteligente:</strong> Apenas usuários dentro do 
              raio configurado poderão ver suas solicitações, garantindo eficiência e 
              relevância geográfica.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <CitySelector
              value={city}
              onChange={setCity}
              label="Sua Cidade Base"
              placeholder="Digite sua cidade..."
              required
            />

            <RadiusSelector
              value={radius}
              onChange={setRadius}
              label="Raio de Atendimento"
              min={10}
              max={500}
              step={10}
            />
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-medium">Como funciona:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Você verá apenas solicitações dentro do seu raio configurado</li>
                  <li>• Outros usuários só verão suas solicitações se estiverem na região</li>
                  <li>• Sistema preciso baseado em coordenadas geográficas reais</li>
                  <li>• Você pode alterar essas configurações a qualquer momento</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveLocation}
              className="flex-1"
              disabled={!city.city || !city.state || isSaving}
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Salvando...
                </div>
              ) : (
                'Salvar e Continuar'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
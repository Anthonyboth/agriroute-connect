import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AddressLocationInput } from './AddressLocationInput';
import { RadiusSelector } from './RadiusSelector';
import { LocationValidationModal } from './LocationValidationModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MapPin, Settings, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SmartLocationManagerProps {
  onLocationUpdated?: () => void;
  showValidationModal?: boolean;
  requiredAction?: string;
}

export const SmartLocationManager: React.FC<SmartLocationManagerProps> = ({
  onLocationUpdated,
  showValidationModal = false,
  requiredAction = "usar o sistema"
}) => {
  const [city, setCity] = useState({ city: '', state: '' });
  const [radius, setRadius] = useState(50);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [showModal, setShowModal] = useState(showValidationModal);
  const { user } = useAuth();

  // Carregar configuração atual
  useEffect(() => {
    const loadCurrentConfig = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('base_city_name, base_state, service_radius_km, base_lat, base_lng')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;

        const hasValidLocation = !!(profile.base_city_name && profile.base_state);
        
        if (hasValidLocation) {
          setCity({
            city: profile.base_city_name,
            state: profile.base_state
          });
          setRadius(profile.service_radius_km || 50);
          setHasLocation(true);
        } else {
          setHasLocation(false);
          // Se não tem localização e é obrigatório, mostrar modal
          if (showValidationModal) {
            setShowModal(true);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar configuração de localização:', error);
        setHasLocation(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadCurrentConfig();
  }, [user, showValidationModal]);

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

      setHasLocation(true);
      toast.success('Localização atualizada com sucesso!');
      onLocationUpdated?.();
    } catch (error) {
      console.error('Erro ao salvar localização:', error);
      toast.error('Erro ao salvar localização. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLocationConfigured = () => {
    setHasLocation(true);
    onLocationUpdated?.();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Configuração de Localização Inteligente
          </CardTitle>
          <CardDescription>
            Configure sua cidade base e raio de atendimento para ver apenas solicitações 
            relevantes para sua região.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {!hasLocation && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Configuração obrigatória:</strong> Você precisa definir sua localização 
                para usar o sistema de forma eficiente.
              </AlertDescription>
            </Alert>
          )}

          {hasLocation && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Localização configurada:</strong> Você está vendo apenas solicitações 
                dentro do seu raio de atendimento.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <AddressLocationInput
                value={city}
                onChange={(data) => setCity({ city: data.city, state: data.state })}
                label="Sua Cidade Base"
                placeholder="Digite CEP ou nome da cidade"
                required
              />
            </div>

            <div className="space-y-4">
              <RadiusSelector
                value={radius}
                onChange={setRadius}
                label="Raio de Atendimento"
                min={10}
                max={500}
                step={10}
              />
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-medium">Benefícios do Sistema Inteligente:</p>
                <ul className="space-y-1 text-muted-foreground grid gap-1">
                  <li>• <strong>Filtragem precisa:</strong> Veja apenas solicitações na sua região</li>
                  <li>• <strong>Economia de tempo:</strong> Sem perder tempo com fretes distantes</li>
                  <li>• <strong>Redução de custos:</strong> Menos combustível e desgaste</li>
                  <li>• <strong>Maior eficiência:</strong> Atenda mais clientes por dia</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSaveLocation}
              disabled={!city.city || !city.state || isSaving}
              className="flex-1"
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Salvando...
                </div>
              ) : (
                <>
                  <Settings className="h-4 w-4 mr-2" />
                  {hasLocation ? 'Atualizar Localização' : 'Configurar Localização'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <LocationValidationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onLocationConfigured={handleLocationConfigured}
        requiredForAction={requiredAction}
      />
    </>
  );
};
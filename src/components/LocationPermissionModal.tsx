import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin, AlertTriangle, Navigation, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface LocationPermissionModalProps {
  isOpen: boolean;
  onClose: (granted: boolean) => void;
  mandatory?: boolean;
}

export const LocationPermissionModal: React.FC<LocationPermissionModalProps> = ({
  isOpen,
  onClose,
  mandatory = true
}) => {
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkLocationStatus();
    }
  }, [isOpen]);

  const checkLocationStatus = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {
          // Já tem permissão
          onClose(true);
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            // Permissão negada - mostrar modal
            console.log('Location permission required');
          }
        },
        { timeout: 5000 }
      );
    }
  };

  const requestLocation = async () => {
    setRequesting(true);
    
    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('Location granted:', position.coords);
            toast.success('Localização ativada com sucesso!');
            onClose(true);
          },
          (error) => {
            console.error('Location error:', error);
            let message = 'Erro ao acessar localização';
            
            switch (error.code) {
              case error.PERMISSION_DENIED:
                message = mandatory 
                  ? 'Localização é obrigatória para usar o AgroRoute' 
                  : 'Permissão de localização negada';
                break;
              case error.POSITION_UNAVAILABLE:
                message = 'Localização não disponível';
                break;
              case error.TIMEOUT:
                message = 'Timeout ao solicitar localização';
                break;
            }
            
            toast.error(message);
            
            if (!mandatory) {
              onClose(false);
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutos
          }
        );
      } else {
        toast.error('Geolocalização não suportada neste dispositivo');
        if (!mandatory) {
          onClose(false);
        }
      }
    } catch (error) {
      console.error('Error requesting location:', error);
      toast.error('Erro ao solicitar localização');
      if (!mandatory) {
        onClose(false);
      }
    } finally {
      setRequesting(false);
    }
  };

  const openSettings = () => {
    toast.info('Ative a localização nas configurações do seu navegador e atualize a página', {
      duration: 5000
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => !mandatory && onClose(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Navigation className="h-5 w-5" />
            Localização Obrigatória
          </DialogTitle>
          <DialogDescription className="space-y-4">
            <div className="text-center">
              <MapPin className="h-12 w-12 text-primary mx-auto mb-3" />
              <p className="text-foreground font-medium">
                O AgroRoute precisa acessar sua localização para funcionar corretamente
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Por que precisamos da sua localização?
                </p>
                <ul className="text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Encontrar fretes próximos a você</li>
                  <li>• Rastreamento em tempo real durante transportes</li>
                  <li>• Calcular distâncias e rotas precisas</li>
                  <li>• Serviços de emergência e guincho</li>
                  <li>• Melhorar a segurança das operações</li>
                </ul>
              </div>
            </div>
          </div>

          {mandatory && (
            <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                  A localização é obrigatória para continuar
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Button 
              onClick={requestLocation} 
              disabled={requesting}
              className="w-full gradient-primary"
              size="lg"
            >
              {requesting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Solicitando permissão...
                </>
              ) : (
                <>
                  <MapPin className="mr-2 h-4 w-4" />
                  Permitir Localização
                </>
              )}
            </Button>

            <Button 
              onClick={openSettings} 
              variant="outline"
              className="w-full"
            >
              <Shield className="mr-2 h-4 w-4" />
              Configurações do Navegador
            </Button>

            {!mandatory && (
              <Button 
                onClick={() => onClose(false)} 
                variant="ghost"
                className="w-full text-muted-foreground"
              >
                Pular por enquanto
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Suas informações de localização são protegidas e usadas apenas para melhorar sua experiência no AgroRoute.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
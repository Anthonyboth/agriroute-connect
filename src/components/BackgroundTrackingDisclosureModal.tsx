import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shield, MapPin, Bell } from 'lucide-react';

interface BackgroundTrackingDisclosureModalProps {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

/**
 * Modal de disclosure obrigatório (Google Play compliance).
 * Exibido ANTES de solicitar permissões de localização.
 * Explica ao usuário por que e como a localização será usada.
 */
export const BackgroundTrackingDisclosureModal = ({
  open,
  onAccept,
  onCancel,
}: BackgroundTrackingDisclosureModalProps) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Rastreio durante a viagem
          </DialogTitle>
          <DialogDescription className="sr-only">
            Explicação sobre o uso de localização em segundo plano
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-foreground">
            O AgriRoute usa sua localização <strong>durante uma viagem ativa</strong> para segurança da carga,
            acompanhamento da rota e registro logístico.
          </p>

          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground">
              Enquanto o rastreio estiver ativo, uma <strong>notificação persistente</strong>{' '}
              será exibida.
            </p>
          </div>

          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">
              O rastreio é encerrado quando a viagem for finalizada.
              Nenhum dado é coletado fora do período da viagem.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={onAccept} className="w-full sm:w-auto">
            <Shield className="h-4 w-4 mr-2" />
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

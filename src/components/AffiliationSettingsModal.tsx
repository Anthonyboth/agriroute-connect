import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Truck, Settings, AlertTriangle } from 'lucide-react';

interface AffiliationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: any;
  onSave: (settings: {
    can_accept_freights: boolean;
    can_manage_vehicles: boolean;
  }) => Promise<void>;
}

export const AffiliationSettingsModal: React.FC<AffiliationSettingsModalProps> = ({
  isOpen,
  onClose,
  driver,
  onSave
}) => {
  const [canAcceptFreights, setCanAcceptFreights] = useState(true);
  const [canManageVehicles, setCanManageVehicles] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        can_accept_freights: canAcceptFreights,
        can_manage_vehicles: canManageVehicles
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurar Permissões do Motorista
          </DialogTitle>
          <DialogDescription>
            Defina as permissões para {driver?.full_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Permissão: Aceitar Fretes */}
          <div className="flex items-start justify-between space-x-4">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <Label htmlFor="accept-freights" className="text-base font-semibold">
                  Permitir aceitar fretes diretamente
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                O motorista poderá aceitar fretes em nome da transportadora sem aprovação prévia
              </p>
            </div>
            <Switch
              id="accept-freights"
              checked={canAcceptFreights}
              onCheckedChange={setCanAcceptFreights}
            />
          </div>

          {/* Permissão: Gerenciar Veículos */}
          <div className="flex items-start justify-between space-x-4">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <Label htmlFor="manage-vehicles" className="text-base font-semibold">
                  Permitir gerenciar veículos
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                O motorista poderá adicionar e gerenciar veículos da frota
              </p>
            </div>
            <Switch
              id="manage-vehicles"
              checked={canManageVehicles}
              onCheckedChange={setCanManageVehicles}
            />
          </div>

          {/* Aviso se ambas estiverem desativadas */}
          {!canAcceptFreights && !canManageVehicles && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Atenção:</strong> O motorista só poderá enviar fretes via chat para análise da transportadora.
                Ele não terá permissões para gerenciar fretes ou veículos diretamente.
              </AlertDescription>
            </Alert>
          )}

          {/* Aviso se só aceitar fretes estiver desativada */}
          {!canAcceptFreights && canManageVehicles && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                O motorista poderá gerenciar veículos, mas precisará enviar fretes via chat para sua aprovação.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Aprovar e Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

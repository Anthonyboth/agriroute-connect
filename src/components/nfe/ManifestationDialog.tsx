import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useNfe } from '@/hooks/useNfe';
import { Loader2, CheckCircle2, HelpCircle, XCircle, Ban } from 'lucide-react';
import { ManifestationType } from '@/types/nfe';

interface ManifestationDialogProps {
  open: boolean;
  onClose: () => void;
  nfeAccessKey: string;
  freightId?: string;
  onSuccess?: () => void;
}

const manifestationOptions = [
  {
    value: 'operation_confirmed' as ManifestationType,
    label: 'Confirmar Operação',
    description: 'Confirma o recebimento da mercadoria/serviço',
    icon: CheckCircle2,
    color: 'text-green-600',
  },
  {
    value: 'operation_unknown' as ManifestationType,
    label: 'Operação Desconhecida',
    description: 'Declara desconhecimento da operação',
    icon: HelpCircle,
    color: 'text-yellow-600',
  },
  {
    value: 'rejection' as ManifestationType,
    label: 'Rejeitar',
    description: 'Rejeita a NF-e com justificativa',
    icon: XCircle,
    color: 'text-red-600',
  },
  {
    value: 'cancellation' as ManifestationType,
    label: 'Cancelar',
    description: 'Solicita cancelamento da NF-e',
    icon: Ban,
    color: 'text-gray-600',
  },
];

export function ManifestationDialog({ 
  open, 
  onClose, 
  nfeAccessKey, 
  freightId,
  onSuccess 
}: ManifestationDialogProps) {
  const [manifestationType, setManifestationType] = useState<ManifestationType>('operation_confirmed');
  const [justification, setJustification] = useState('');
  const { loading, manifestNfe } = useNfe();

  const handleManifest = async () => {
    if ((manifestationType === 'rejection' || manifestationType === 'cancellation') && !justification.trim()) {
      return;
    }

    const success = await manifestNfe({
      access_key: nfeAccessKey,
      manifestation_type: manifestationType,
      justification: justification || undefined,
      freight_id: freightId,
    });

    if (success) {
      if (onSuccess) {
        onSuccess();
      }
      setJustification('');
      onClose();
    }
  };

  const handleClose = () => {
    setJustification('');
    onClose();
  };

  const requiresJustification = manifestationType === 'rejection' || manifestationType === 'cancellation';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Manifestar NF-e</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Chave: {nfeAccessKey.slice(0, 8)}...{nfeAccessKey.slice(-8)}
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Tipo de Manifestação</Label>
            <RadioGroup value={manifestationType} onValueChange={(v) => setManifestationType(v as ManifestationType)}>
              {manifestationOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <div key={option.value} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${option.color}`} />
                        <span className="font-medium">{option.label}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {requiresJustification && (
            <div className="space-y-2">
              <Label htmlFor="justification">
                Justificativa <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="justification"
                placeholder="Digite a justificativa para a manifestação..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={4}
                disabled={loading}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleManifest} 
            disabled={loading || (requiresJustification && !justification.trim())}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Manifestação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

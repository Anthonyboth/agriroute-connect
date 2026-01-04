import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNfe } from '@/hooks/useNfe';
import { Loader2, Eye, CheckCircle2, HelpCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { ManifestationType, MANIFESTATION_OPTIONS } from '@/types/nfe';
import { cn } from '@/lib/utils';

interface ManifestationDialogProps {
  open: boolean;
  onClose: () => void;
  nfeAccessKey: string;
  freightId?: string;
  onSuccess?: () => void;
}

const iconMap = {
  'eye': Eye,
  'check-circle': CheckCircle2,
  'help-circle': HelpCircle,
  'x-circle': XCircle,
};

export function ManifestationDialog({ 
  open, 
  onClose, 
  nfeAccessKey, 
  freightId,
  onSuccess 
}: ManifestationDialogProps) {
  const [manifestationType, setManifestationType] = useState<ManifestationType>('ciencia');
  const [justification, setJustification] = useState('');
  const { loading, manifestNfe } = useNfe();

  const selectedOption = MANIFESTATION_OPTIONS.find(opt => opt.value === manifestationType);
  const requiresJustification = selectedOption?.requiresJustification ?? false;

  const handleManifest = async () => {
    if (requiresJustification && justification.trim().length < 15) {
      return;
    }

    const success = await manifestNfe({
      access_key: nfeAccessKey,
      manifestation_type: manifestationType,
      justification: justification.trim() || undefined,
      freight_id: freightId,
    });

    if (success) {
      if (onSuccess) {
        onSuccess();
      }
      setJustification('');
      setManifestationType('ciencia');
      onClose();
    }
  };

  const handleClose = () => {
    setJustification('');
    setManifestationType('ciencia');
    onClose();
  };

  const formatAccessKey = (key: string) => {
    // Formatar em grupos de 4 para melhor legibilidade
    return key.replace(/(.{4})/g, '$1 ').trim();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Manifestar NF-e
          </DialogTitle>
        </DialogHeader>

        {/* Chave de Acesso */}
        <div className="bg-muted/50 rounded-lg p-3 border">
          <Label className="text-xs text-muted-foreground">Chave de Acesso</Label>
          <p className="font-mono text-sm break-all mt-1">
            {formatAccessKey(nfeAccessKey)}
          </p>
        </div>

        {/* Aviso importante */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            A manifestação tem efeitos fiscais legais. A <strong>Confirmação</strong> não pode ser desfeita.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-3">
            <Label>Tipo de Manifestação</Label>
            <RadioGroup 
              value={manifestationType} 
              onValueChange={(v) => setManifestationType(v as ManifestationType)}
              className="space-y-2"
            >
              {MANIFESTATION_OPTIONS.map((option) => {
                const Icon = iconMap[option.icon as keyof typeof iconMap] || Eye;
                const isSelected = manifestationType === option.value;
                
                return (
                  <div 
                    key={option.value} 
                    className={cn(
                      "flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors",
                      isSelected 
                        ? "border-primary bg-primary/5" 
                        : "hover:bg-accent"
                    )}
                  >
                    <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                    <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Icon className={cn('h-5 w-5', option.color)} />
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {option.sefazCode}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {option.description}
                      </p>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Campo de justificativa */}
          {requiresJustification && (
            <div className="space-y-2">
              <Label htmlFor="justification">
                Justificativa <span className="text-destructive">*</span>
                <span className="text-xs text-muted-foreground ml-2">
                  (mínimo 15 caracteres)
                </span>
              </Label>
              <Textarea
                id="justification"
                placeholder="Descreva o motivo da manifestação..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={4}
                disabled={loading}
                className={cn(
                  justification.length > 0 && justification.length < 15 && "border-warning"
                )}
              />
              <p className="text-xs text-muted-foreground text-right">
                {justification.length}/15 caracteres mínimos
              </p>
            </div>
          )}

          {/* Aviso para confirmação */}
          {manifestationType === 'confirmacao' && (
            <Alert variant="default" className="border-warning bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-sm">
                <strong>Atenção:</strong> A confirmação da operação é definitiva e não pode ser revertida.
                Certifique-se de que a mercadoria/serviço foi recebido corretamente.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleManifest} 
            disabled={loading || (requiresJustification && justification.trim().length < 15)}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar Manifestação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

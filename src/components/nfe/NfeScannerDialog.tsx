import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNfe } from '@/hooks/useNfe';
import { Loader2, FileText } from 'lucide-react';
import { NFeDocument } from '@/types/nfe';

interface NfeScannerDialogProps {
  open: boolean;
  onClose: () => void;
  freightId?: string;
  onSuccess?: (nfe: NFeDocument) => void;
}

export function NfeScannerDialog({ open, onClose, freightId, onSuccess }: NfeScannerDialogProps) {
  const [accessKey, setAccessKey] = useState('');
  const { loading, scanNfe } = useNfe();

  const handleScan = async () => {
    if (!accessKey.trim()) {
      return;
    }

    const nfe = await scanNfe(accessKey, freightId);
    
    if (nfe) {
      if (onSuccess) {
        onSuccess(nfe);
      }
      setAccessKey('');
      onClose();
    }
  };

  const handleClose = () => {
    setAccessKey('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Escanear NF-e
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="access-key">Chave de Acesso</Label>
            <Input
              id="access-key"
              placeholder="Digite a chave de acesso (44 caracteres)"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              maxLength={44}
              disabled={loading}
            />
            <p className="text-sm text-muted-foreground">
              A chave deve ter exatamente 44 caracteres
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleScan} disabled={loading || accessKey.length !== 44}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Escanear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

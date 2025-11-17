import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Users, AlertTriangle } from 'lucide-react';

interface ShareTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateTitle: string;
  isCurrentlyShared: boolean;
  onConfirm: (share: boolean) => Promise<void>;
}

export const ShareTemplateDialog: React.FC<ShareTemplateDialogProps> = ({
  open,
  onOpenChange,
  templateTitle,
  isCurrentlyShared,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(!isCurrentlyShared);
      onOpenChange(false);
    } catch (error) {
      // Error handling in parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {isCurrentlyShared ? 'Revogar Compartilhamento' : 'Compartilhar Modelo'}
          </DialogTitle>
          <DialogDescription>
            Modelo: <strong>{templateTitle}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isCurrentlyShared ? (
            <>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Ao revogar o compartilhamento, outros membros da empresa não poderão mais
                  visualizar ou usar este modelo.
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground">
                Este modelo está atualmente compartilhado com todos os produtores da sua empresa.
              </p>
            </>
          ) : (
            <>
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  Todos os produtores da sua empresa poderão visualizar e usar este modelo
                  para criar novos fretes.
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground">
                Você continuará sendo o único que pode editar ou excluir este modelo.
                Outros membros poderão apenas visualizar e duplicar.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            variant={isCurrentlyShared ? 'destructive' : 'default'}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isCurrentlyShared ? 'Revogar Compartilhamento' : 'Compartilhar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

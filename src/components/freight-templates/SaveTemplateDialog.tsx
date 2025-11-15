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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string) => Promise<void>;
}

export const SaveTemplateDialog: React.FC<SaveTemplateDialogProps> = ({
  open,
  onOpenChange,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    
    setSaving(true);
    try {
      await onSave(title.trim());
      setTitle('');
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar como Modelo</DialogTitle>
          <DialogDescription>
            Dê um nome para este modelo de frete para reutilizá-lo depois
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Nome do Modelo</Label>
            <Input
              id="template-name"
              placeholder="Ex: Grãos São Paulo - Curitiba"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title.trim()) {
                  handleSave();
                }
              }}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setTitle('');
              onOpenChange(false);
            }}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Modelo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

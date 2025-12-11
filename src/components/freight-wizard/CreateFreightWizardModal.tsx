import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { CreateFreightWizard } from './CreateFreightWizard';

interface CreateFreightWizardModalProps {
  onFreightCreated: () => void;
  userProfile: any;
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateFreightWizardModal({ 
  onFreightCreated, 
  userProfile,
  trigger,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange
}: CreateFreightWizardModalProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  
  const setOpen = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  const handleSuccess = () => {
    onFreightCreated();
    setOpen(false);
  };

  const handleClose = () => {
    setOpen(false);
  };

  // Sync internal state with defaultOpen on mount
  useEffect(() => {
    if (defaultOpen && !isControlled) {
      setInternalOpen(true);
    }
  }, [defaultOpen, isControlled]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger || (
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Frete
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Criar Novo Frete</DialogTitle>
        </DialogHeader>
        <CreateFreightWizard
          userProfile={userProfile}
          onFreightCreated={handleSuccess}
          onClose={handleClose}
          isOpen={open}
        />
      </DialogContent>
    </Dialog>
  );
}

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { HeroActionButton } from '@/components/ui/hero-action-button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Package } from 'lucide-react';
import { CreateFreightWizard } from './CreateFreightWizard';

interface CreateFreightWizardModalProps {
  onFreightCreated: () => void;
  userProfile: any;
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  guestMode?: boolean;
}

export function CreateFreightWizardModal({ 
  onFreightCreated, 
  userProfile,
  trigger,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  guestMode = false
}: CreateFreightWizardModalProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  
  // CORREÇÃO BUG MOTO: Se o perfil for PRODUTOR, NUNCA usar guestMode
  const isProducer = userProfile?.role === 'PRODUTOR' || userProfile?.active_mode === 'PRODUTOR';
  const effectiveGuestMode = isProducer ? false : guestMode;
  
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
            <HeroActionButton icon={<Package className="h-4 w-4" />}>
              Criar Frete
            </HeroActionButton>
          )}
        </DialogTrigger>
      )}
      <DialogContent 
        className="max-w-4xl h-[90vh] max-h-[90vh] overflow-hidden flex flex-col p-0"
        onClick={(e) => e.stopPropagation()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Criar Novo Frete</DialogTitle>
        </DialogHeader>
        <CreateFreightWizard
          userProfile={userProfile}
          onFreightCreated={handleSuccess}
          onClose={handleClose}
          isOpen={open}
          guestMode={effectiveGuestMode}
        />
      </DialogContent>
    </Dialog>
  );
}

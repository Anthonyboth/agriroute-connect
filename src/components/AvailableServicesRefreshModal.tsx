import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Loader2, RefreshCw } from 'lucide-react';

interface AvailableServicesRefreshModalProps {
  open: boolean;
}

export const AvailableServicesRefreshModal: React.FC<AvailableServicesRefreshModalProps> = ({ open }) => {
  return (
    <Dialog open={open}>
      <DialogContent 
        className="max-w-xs sm:max-w-sm p-6 gap-4 border-primary/20 shadow-xl bg-gradient-to-br from-background to-primary/5"
        hideCloseButton
      >
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="relative">
            <RefreshCw className="h-12 w-12 text-primary animate-spin" />
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              Atualizando serviços
            </h3>
            <p className="text-sm text-muted-foreground">
              Buscando novos serviços disponíveis...
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

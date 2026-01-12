import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { FreightChat } from '@/components/FreightChat';
import { MessageCircle } from 'lucide-react';

interface PaymentChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  freightId: string | null;
  driverName?: string;
  currentUserProfile: any;
}

export const PaymentChatModal: React.FC<PaymentChatModalProps> = ({
  isOpen,
  onClose,
  freightId,
  driverName,
  currentUserProfile
}) => {
  if (!freightId || !currentUserProfile) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Chat com {driverName || 'Motorista'}
          </DialogTitle>
          <DialogDescription>
            Converse com o motorista sobre este pagamento e o frete
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <FreightChat
            freightId={freightId}
            currentUserProfile={currentUserProfile}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

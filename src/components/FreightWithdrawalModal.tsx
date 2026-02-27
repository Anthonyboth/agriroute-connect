import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';

interface FreightWithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  freightInfo?: {
    cargo_type: string;
    origin_address: string;
    destination_address: string;
    price: number;
  };
}

export const FreightWithdrawalModal: React.FC<FreightWithdrawalModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  freightInfo
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <AlertDialogTitle className="text-lg">
              Confirmar Desistência do Frete
            </AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        
        <AlertDialogDescription asChild>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p className="text-sm">
              Ao desistir do frete, ele ficará novamente disponível para outros motoristas aceitarem.
            </p>
            <div className="bg-muted p-3 rounded-lg space-y-2">
              <p className="text-sm"><strong>Tipo de Carga:</strong> {freightInfo?.cargo_type}</p>
              <p className="text-sm"><strong>Origem:</strong> {freightInfo?.origin_address}</p>
              <p className="text-sm"><strong>Destino:</strong> {freightInfo?.destination_address}</p>
              <p className="text-sm"><strong>Valor:</strong> R$ {freightInfo?.price?.toLocaleString('pt-BR')}</p>
            </div>
            
            <div className="flex items-start space-x-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <Clock className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Ação Irreversível</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Esta ação não pode ser desfeita. Você perderá este frete definitivamente.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Disponibilidade</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  O frete ficará imediatamente disponível para outros motoristas.
                </p>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-muted/30 rounded-lg">
              <p className="text-sm text-center text-muted-foreground">
                <strong>Tem certeza que deseja desistir do frete?</strong>
              </p>
            </div>
          </div>
        </AlertDialogDescription>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel 
            onClick={onClose}
            className="flex-1"
          >
            Manter Frete
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 bg-destructive hover:bg-destructive/90"
          >
            Desistir do Frete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default FreightWithdrawalModal;
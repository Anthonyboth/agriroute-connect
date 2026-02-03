/**
 * ProfileDangerZone.tsx
 * 
 * Zona de perigo com opção de exclusão de conta.
 * Inclui confirmação em duas etapas para segurança.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileDangerZoneProps {
  onDeleteAccount: () => Promise<void>;
  isDeleting?: boolean;
  className?: string;
}

export const ProfileDangerZone: React.FC<ProfileDangerZoneProps> = ({
  onDeleteAccount,
  isDeleting = false,
  className
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [secondConfirmOpen, setSecondConfirmOpen] = useState(false);

  const handleFirstConfirm = () => {
    if (deleteConfirmation.toUpperCase() !== 'EXCLUIR') {
      return;
    }
    setSecondConfirmOpen(true);
  };

  const handleFinalConfirm = async () => {
    await onDeleteAccount();
    setDeleteDialogOpen(false);
    setSecondConfirmOpen(false);
    setDeleteConfirmation('');
  };

  const handleCancel = () => {
    setDeleteDialogOpen(false);
    setSecondConfirmOpen(false);
    setDeleteConfirmation('');
  };

  return (
    <Card className={cn("border-destructive/50", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Zona de Perigo
        </CardTitle>
        <CardDescription>
          Ações irreversíveis para sua conta
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            A exclusão da sua conta é permanente e não pode ser desfeita. 
            Todos os seus dados serão removidos.
          </p>
          
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2">
                <Trash2 className="h-4 w-4" />
                Excluir Conta
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Tem certeza absoluta?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    Esta ação não pode ser desfeita. Isso irá excluir permanentemente 
                    sua conta e remover todos os seus dados dos nossos servidores.
                  </p>
                  <p className="font-medium">
                    Para confirmar, digite <strong>EXCLUIR</strong> no campo abaixo:
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              
              <Input
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Digite EXCLUIR"
                className="uppercase"
              />
              
              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleCancel}>
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleFirstConfirm}
                  disabled={deleteConfirmation.toUpperCase() !== 'EXCLUIR'}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Continuar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          {/* Segunda confirmação */}
          <AlertDialog open={secondConfirmOpen} onOpenChange={setSecondConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Última confirmação
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    Você tem certeza que deseja excluir sua conta permanentemente?
                  </p>
                  <p className="font-semibold text-destructive">
                    Esta é sua última chance de cancelar.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              
              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleCancel}>
                  Não, manter minha conta
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleFinalConfirm}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Excluindo...
                    </>
                  ) : (
                    'Sim, excluir permanentemente'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};

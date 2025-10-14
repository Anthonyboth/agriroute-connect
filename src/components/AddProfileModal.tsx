import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Truck, Leaf, Plus, Loader2 } from 'lucide-react';

interface AddProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: 'MOTORISTA' | 'MOTORISTA_AFILIADO' | 'PRODUTOR';
  onProfileAdded: () => void;
}

export const AddProfileModal: React.FC<AddProfileModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  onProfileAdded
}) => {
  const [loading, setLoading] = useState(false);

  const targetRole = (currentRole === 'MOTORISTA' || currentRole === 'MOTORISTA_AFILIADO') ? 'PRODUTOR' : 'MOTORISTA';

  const handleCreateProfile = async () => {
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Usuário não encontrado');
        return;
      }

      // Chamar a função do Supabase para criar perfil adicional
      const { data, error } = await supabase.rpc('create_additional_profile', {
        p_user_id: user.id,
        p_role: targetRole
      });

      if (error) {
        console.error('Error creating additional profile:', error);
        toast.error(`Erro ao criar perfil de ${targetRole === 'MOTORISTA' ? 'motorista' : 'produtor'}`);
        return;
      }

      toast.success(`Perfil de ${targetRole === 'MOTORISTA' ? 'motorista' : 'produtor'} criado com sucesso! Complete os dados no perfil.`);
      
      onProfileAdded();
      onClose();
      
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error('Erro ao criar novo perfil');
    } finally {
      setLoading(false);
    }
  };

  const getRoleInfo = (role: string) => {
    if (role === 'MOTORISTA') {
      return {
        icon: <Truck className="w-8 h-8" />,
        title: 'Conta de Motorista',
        description: 'Aceite fretes e ganhe dinheiro transportando cargas',
        benefits: [
          'Receba propostas de frete',
          'Gerencie seus veículos',
          'Histórico de entregas',
          'Sistema de avaliações'
        ],
        color: 'bg-accent'
      };
    } else {
      return {
        icon: <Leaf className="w-8 h-8" />,
        title: 'Conta de Produtor',
        description: 'Encontre motoristas para transportar sua produção',
        benefits: [
          'Publique suas cargas',
          'Compare propostas',
          'Acompanhe entregas',
          'Avalie motoristas'
        ],
        color: 'bg-success'
      };
    }
  };

  const targetRoleInfo = getRoleInfo(targetRole);
  const currentRoleInfo = getRoleInfo(currentRole);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Adicionar Perfil Adicional
          </DialogTitle>
          <DialogDescription>
            Crie uma conta adicional para ter acesso completo à plataforma
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Perfil atual */}
          <Card className="border-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Seu Perfil Atual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full text-primary-foreground ${currentRoleInfo.color}`}>
                  {currentRoleInfo.icon}
                </div>
                <div>
                  <h3 className="font-medium">{currentRoleInfo.title}</h3>
                  <p className="text-sm text-muted-foreground">{currentRoleInfo.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Novo perfil a ser criado */}
          <Card className="border-2 border-dashed border-muted-foreground/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Criar {targetRoleInfo.title}
              </CardTitle>
              <CardDescription>
                {targetRoleInfo.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className={`p-2 rounded-full text-primary-foreground ${targetRoleInfo.color}`}>
                    {targetRoleInfo.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">Benefícios</h4>
                    <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                    {targetRoleInfo.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-center gap-1">
                          <span className="w-1 h-1 bg-current rounded-full" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <div className="w-4 h-4 bg-amber-500 rounded-full flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Importante
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        Após criar o perfil, você precisará completar os dados específicos do {targetRole === 'MOTORISTA' ? 'motorista' : 'produtor'} e aguardar aprovação.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botões */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleCreateProfile} className="flex-1" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar {targetRoleInfo.title}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
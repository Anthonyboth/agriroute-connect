import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Truck, User } from 'lucide-react';
import { useTransportCompany } from '@/hooks/useTransportCompany';

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface CompanyModeToggleProps {
  currentMode?: 'MOTORISTA' | 'TRANSPORTADORA';
  onModeChange?: (mode: 'MOTORISTA' | 'TRANSPORTADORA') => void;
}

export const CompanyModeToggle: React.FC<CompanyModeToggleProps> = ({
  currentMode = 'MOTORISTA',
  onModeChange
}) => {
  const { isTransportCompany } = useTransportCompany();
  const [isChangingMode, setIsChangingMode] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const navigate = useNavigate();

  // Verificar o role do usuário
  React.useEffect(() => {
    const checkUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          setUserRole(profile.role);
        }
      } catch (error) {
        console.error('Erro ao verificar role:', error);
      }
    };

    checkUserRole();
  }, []);

  const handleToggleMode = async (checked: boolean) => {
    const newMode = checked ? 'TRANSPORTADORA' : 'MOTORISTA';
    
    setIsChangingMode(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não encontrado');

      // Buscar o perfil do usuário
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'MOTORISTA')
        .single();

      if (profileError) throw profileError;

      // Atualizar o modo ativo
      const { error } = await supabase
        .from('profiles')
        .update({ active_mode: newMode })
        .eq('id', profile.id);

      if (error) throw error;

      // Salvar no localStorage
      localStorage.setItem('active_mode', newMode);

      toast.success(`Modo alterado para ${newMode === 'TRANSPORTADORA' ? 'Transportadora' : 'Motorista'}`);
      
      if (onModeChange) {
        onModeChange(newMode);
      }

      // Navegar para o dashboard correto
      if (newMode === 'TRANSPORTADORA') {
        navigate('/dashboard/company');
      } else {
        navigate('/dashboard/driver');
      }

      // Recarregar a página para aplicar as mudanças
      window.location.reload();
    } catch (error) {
      console.error('Erro ao alternar modo:', error);
      toast.error('Erro ao alternar modo');
    } finally {
      setIsChangingMode(false);
    }
  };

  // Este toggle só deve aparecer para MOTORISTAS que são DONOS de transportadora
  // Não deve aparecer para:
  // - TRANSPORTADORA (role) - são empresas, não pessoas
  // - MOTORISTA_AFILIADO - são empregados, não donos
  // - PRODUTOR ou PRESTADOR_SERVICOS
  if (userRole !== 'MOTORISTA') {
    return null;
  }

  // Se não é transportadora, mostrar botão para virar transportadora
  if (!isTransportCompany) {
    return (
      <Button
        onClick={() => navigate('/cadastro-transportadora')}
        variant="outline"
        className="w-full justify-start"
        size="sm"
      >
        <Truck className="mr-2 h-4 w-4" />
        Cadastrar Transportadora
      </Button>
    );
  }

  // Se é transportadora, mostrar toggle para alternar entre modos
  const isTransportMode = currentMode === 'TRANSPORTADORA';

  return (
    <div className="flex items-center justify-between w-full px-2 py-1">
      <div className="flex items-center gap-2">
        <User className={`h-4 w-4 ${!isTransportMode ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className={`text-sm ${!isTransportMode ? 'font-medium' : 'text-muted-foreground'}`}>
          Motorista
        </span>
      </div>
      
      <Switch
        checked={isTransportMode}
        onCheckedChange={handleToggleMode}
        disabled={isChangingMode}
      />
      
      <div className="flex items-center gap-2">
        <Truck className={`h-4 w-4 ${isTransportMode ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className={`text-sm ${isTransportMode ? 'font-medium' : 'text-muted-foreground'}`}>
          Transportadora
        </span>
      </div>
    </div>
  );
};
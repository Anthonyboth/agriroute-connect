import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Truck, User, UserCheck } from 'lucide-react';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { AffiliationRequestModal } from './AffiliationRequestModal';

interface CompanyModeToggleProps {
  currentMode?: 'MOTORISTA' | 'TRANSPORTADORA';
  currentProfile?: any;
  onModeChange?: (mode: 'MOTORISTA' | 'TRANSPORTADORA') => void;
}

export const CompanyModeToggle: React.FC<CompanyModeToggleProps> = ({
  currentMode = 'MOTORISTA',
  currentProfile,
  onModeChange
}) => {
  const { isTransportCompany } = useTransportCompany();
  const { hasRole } = useAuth();
  const [isChangingMode, setIsChangingMode] = useState(false);
  const [affiliationModalOpen, setAffiliationModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleToggleMode = async (checked: boolean) => {
    const newMode = checked ? 'TRANSPORTADORA' : 'MOTORISTA';
    
    setIsChangingMode(true);
    try {
      // Navegar para o dashboard correto baseado no modo
      toast.success(`Modo alterado para ${newMode === 'TRANSPORTADORA' ? 'Transportadora' : 'Motorista'}`);
      
      if (onModeChange) {
        onModeChange(newMode);
      }

      if (newMode === 'TRANSPORTADORA') {
        navigate('/dashboard/company');
      } else {
        navigate('/dashboard/driver');
      }
    } catch (error) {
      console.error('Erro ao alternar modo:', error);
      toast.error('Erro ao alternar modo');
    } finally {
      setIsChangingMode(false);
    }
  };

  // Verificar se usuário tem role de driver (usando user_roles ou profiles.role)
  const isDriver = hasRole('driver') || currentProfile?.role === 'MOTORISTA';
  
  if (!currentProfile || !isDriver) {
    return null;
  }

  // Se não é transportadora, mostrar botão para virar transportadora
  if (!isTransportCompany) {
    return (
      <>
        <div className="w-full space-y-2">
          <Button
            onClick={() => navigate('/cadastro-transportadora')}
            variant="outline"
            className="w-full justify-start"
          >
            <Truck className="mr-2 h-4 w-4" />
            Virar Transportadora
          </Button>
          <p className="text-xs text-muted-foreground px-2">
            Cadastre mais veículos, gerencie motoristas e aceite mais fretes.
          </p>
          
          <Button
            onClick={() => setAffiliationModalOpen(true)}
            variant="outline"
            className="w-full justify-start"
          >
            <UserCheck className="mr-2 h-4 w-4" />
            Solicitar Afiliação
          </Button>
          <p className="text-xs text-muted-foreground px-2">
            Faça parte de uma transportadora existente
          </p>
        </div>

        <AffiliationRequestModal
          isOpen={affiliationModalOpen}
          onClose={() => setAffiliationModalOpen(false)}
          currentProfile={currentProfile}
        />
      </>
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
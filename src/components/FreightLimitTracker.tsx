import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyDriver } from '@/hooks/useCompanyDriver';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, Crown, X, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FreightLimitTrackerProps {
  onLimitReached?: () => void;
  hideForAffiliatedDriver?: boolean;
}

const FreightLimitTracker: React.FC<FreightLimitTrackerProps> = ({ onLimitReached, hideForAffiliatedDriver = false }) => {
  const { user } = useAuth();
  const { isAffiliated } = useCompanyDriver();
  const navigate = useNavigate();
  const [freightCount, setFreightCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isClosed, setIsClosed] = useState(() => {
    return localStorage.getItem('testPeriodNoticeClosed') === 'true';
  });

  const FREE_FREIGHT_LIMIT = 3;

  const handleClose = () => {
    setIsClosed(true);
    localStorage.setItem('testPeriodNoticeClosed', 'true');
  };

  const fetchAcceptedFreightCount = useCallback(async () => {
    if (!user) return;

    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'MOTORISTA');

      if (!profiles || profiles.length === 0) return;

      // Count driver's accepted freights (limit applies to accepted, not created)
      const { count, error } = await supabase
        .from('freights')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', profiles[0].id)
        .in('status', ['ACCEPTED', 'LOADING', 'IN_TRANSIT', 'DELIVERED']);

      // Force count to 0 for now
      setFreightCount(0);
      return;

      if (error) throw error;
      setFreightCount(count || 0);
    } catch (error) {
      console.error('Error fetching accepted freight count:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAcceptedFreightCount();
  }, [fetchAcceptedFreightCount]);

  const canCreateFreight = freightCount < FREE_FREIGHT_LIMIT;
  const remainingFreights = Math.max(0, FREE_FREIGHT_LIMIT - freightCount);
  const progressPercentage = (freightCount / FREE_FREIGHT_LIMIT) * 100;

  // Não exibir para motorista afiliado se a prop estiver ativada
  if (hideForAffiliatedDriver && isAffiliated) {
    return null;
  }

  // Se o usuário fechou a mensagem, não mostra mais
  if (isClosed) {
    return null;
  }

  if (loading) {
    return null;
  }

  return (
    <Card className="mb-4 border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            Período de Testes - Plataforma Gratuita
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-muted"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
            A plataforma está disponível <strong>gratuitamente</strong> por um período indeterminado para que você possa testar e verificar seu valor. 
          </p>
          <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed mt-2">
            Quando for o momento certo, implementaremos uma cobrança mensal ou percentual pelo uso da plataforma.
          </p>
          <p className="text-sm text-blue-800 dark:text-blue-200 mt-3 font-medium">
            ✨ Aproveite o período de testes e conheça todos os recursos!
          </p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-600 dark:border-amber-800 rounded-lg p-3">
          <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed font-medium">
            ⚠️ <strong>Importante:</strong> Durante o período de testes, transações financeiras não estão habilitadas dentro da plataforma. Os acordos de pagamento devem ser feitos externamente. O seguro de frete, caso seja necessário, também deve ser contratado por fora da plataforma por enquanto.
          </p>
        </div>

        {/* Código de contagem de fretes mantido para futura ativação */}
        {/* 
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {freightCount} de {FREE_FREIGHT_LIMIT} fretes utilizados
            </span>
            <span className="font-medium">
              {Math.round(progressPercentage)}%
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {remainingFreights === 0 && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-4 w-4 text-amber-600" />
              <h4 className="font-medium text-amber-800 dark:text-amber-200">
                Limite Atingido
              </h4>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
              Você utilizou seus 3 fretes gratuitos do cadastro. Faça upgrade para continuar aceitando fretes.
            </p>
            <Button
              size="sm"
              onClick={() => navigate('/subscription')}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Ver Planos Premium
            </Button>
          </div>
        )}

        {remainingFreights > 0 && (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-sm text-green-800 dark:text-green-200">
              Você ainda pode aceitar <strong>{remainingFreights}</strong> fretes gratuitos do seu cadastro!
            </p>
          </div>
        )}
        */}
      </CardContent>
    </Card>
  );
};

export default FreightLimitTracker;
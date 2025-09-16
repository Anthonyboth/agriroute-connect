import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FreightLimitTrackerProps {
  onLimitReached?: () => void;
}

const FreightLimitTracker: React.FC<FreightLimitTrackerProps> = ({ onLimitReached }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [freightCount, setFreightCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const FREE_FREIGHT_LIMIT = 3;

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
        .in('status', ['ACCEPTED', 'IN_TRANSIT', 'DELIVERED']);

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

  if (loading) {
    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-2 bg-muted rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4 border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Fretes Aceitos Gratuitos
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {remainingFreights} restantes
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
              Você utilizou todos os seus fretes gratuitos. Faça upgrade para continuar aceitando fretes.
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
              🎉 Você ainda pode aceitar <strong>{remainingFreights}</strong> fretes gratuitos!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FreightLimitTracker;
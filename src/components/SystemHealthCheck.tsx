import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SystemStatus {
  database: boolean;
  auth: boolean;
  stats: boolean;
  lastCheck: Date;
}

export const SystemHealthCheck: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus>({
    database: false,
    auth: false,
    stats: false,
    lastCheck: new Date()
  });
  const [isChecking, setIsChecking] = useState(false);

  const checkSystemHealth = async () => {
    setIsChecking(true);
    
    const newStatus: SystemStatus = {
      database: false,
      auth: false,
      stats: false,
      lastCheck: new Date()
    };

    try {
      // Teste de conexão com banco
      const { error: dbError } = await supabase.from('profiles').select('count').limit(1);
      newStatus.database = !dbError;
    } catch {
      newStatus.database = false;
    }

    try {
      // Teste de autenticação
      await supabase.auth.getSession();
      newStatus.auth = true;
    } catch {
      newStatus.auth = false;
    }

    try {
      // Teste de estatísticas
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      newStatus.stats = typeof count === 'number';
    } catch {
      newStatus.stats = false;
    }

    setStatus(newStatus);
    setIsChecking(false);
  };

  useEffect(() => {
    checkSystemHealth();
  }, []);

  const getStatusIcon = (isHealthy: boolean) => {
    return isHealthy ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (isHealthy: boolean) => {
    return isHealthy ? (
      <Badge variant="default" className="bg-green-500">Online</Badge>
    ) : (
      <Badge variant="destructive">Offline</Badge>
    );
  };

  const healthyCount = Object.values(status).filter(val => typeof val === 'boolean' && val).length;
  const totalChecks = 3;

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Status do Sistema</h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={checkSystemHealth}
            disabled={isChecking}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
            Verificar
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(status.database)}
              <span>Banco de Dados</span>
            </div>
            {getStatusBadge(status.database)}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(status.auth)}
              <span>Autenticação</span>
            </div>
            {getStatusBadge(status.auth)}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(status.stats)}
              <span>Estatísticas</span>
            </div>
            {getStatusBadge(status.stats)}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Última verificação: {status.lastCheck.toLocaleTimeString()}
            </span>
            <span className={`font-medium ${healthyCount === totalChecks ? 'text-green-600' : 'text-red-600'}`}>
              {healthyCount}/{totalChecks} sistemas online
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface ErrorLogDB {
  id: string;
  created_at: string;
  error_type: string;
  error_category: string;
  error_message: string;
  error_stack?: string;
  error_code?: string;
  module?: string;
  function_name?: string;
  route?: string;
  user_id?: string;
  user_email?: string;
  auto_correction_attempted: boolean;
  auto_correction_action?: string;
  auto_correction_success?: boolean;
  status: string;
  telegram_notified: boolean;
  telegram_sent_at?: string;
  metadata?: any;
}

export const ErrorLogsPanel = () => {
  const [errorLogs, setErrorLogs] = useState<ErrorLogDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const { toast } = useToast();

  const fetchErrorLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterType !== 'ALL') {
        query = query.eq('error_type', filterType);
      }

      if (filterCategory !== 'ALL') {
        query = query.eq('error_category', filterCategory);
      }

      const { data, error } = await query;

      if (error) throw error;

      setErrorLogs(data || []);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      toast({
        title: 'Erro ao carregar logs',
        description: 'Não foi possível carregar os logs de erro',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrorLogs();
  }, [filterType, filterCategory]);

  const handleMarkResolved = async (id: string) => {
    try {
      const { error } = await supabase
        .from('error_logs')
        .update({ status: 'RESOLVED' })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Erro marcado como resolvido',
        description: 'O erro foi marcado como resolvido com sucesso'
      });

      fetchErrorLogs();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível marcar o erro como resolvido',
        variant: 'destructive'
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'AUTO_FIXED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'PERSISTENT':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'NOTIFIED':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'RESOLVED':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getCategoryBadge = (category: string) => {
    return (
      <Badge variant={category === 'CRITICAL' ? 'destructive' : 'secondary'}>
        {category}
      </Badge>
    );
  };

  const stats = {
    total: errorLogs.length,
    critical: errorLogs.filter(e => e.error_category === 'CRITICAL').length,
    autoFixed: errorLogs.filter(e => e.status === 'AUTO_FIXED').length,
    persistent: errorLogs.filter(e => e.status === 'PERSISTENT').length
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Monitoramento de Erros</CardTitle>
            <Button onClick={fetchErrorLogs} size="sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
              <div className="text-sm text-muted-foreground">Críticos</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.autoFixed}</div>
              <div className="text-sm text-muted-foreground">Corrigidos</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{stats.persistent}</div>
              <div className="text-sm text-muted-foreground">Persistentes</div>
            </div>
          </div>

          <div className="flex gap-4 mb-4">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="FRONTEND">Frontend</SelectItem>
                <SelectItem value="BACKEND">Backend</SelectItem>
                <SelectItem value="DATABASE">Database</SelectItem>
                <SelectItem value="NETWORK">Network</SelectItem>
                <SelectItem value="PAYMENT">Payment</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas</SelectItem>
                <SelectItem value="CRITICAL">Críticos</SelectItem>
                <SelectItem value="SIMPLE">Simples</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {errorLogs.map((log) => (
                <Card key={log.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(log.status)}
                            <h4 className="font-semibold text-sm">{log.error_message.substring(0, 80)}</h4>
                          </div>
                          <div className="flex gap-2">
                            {getCategoryBadge(log.error_category)}
                            <Badge variant="outline">{log.error_type}</Badge>
                            <Badge variant="outline">{log.status}</Badge>
                          </div>
                        </div>
                        {log.status !== 'RESOLVED' && (
                          <Button size="sm" variant="outline" onClick={() => handleMarkResolved(log.id)}>
                            Resolver
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Módulo:</span>{' '}
                          <span className="font-medium">{log.module || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Função:</span>{' '}
                          <span className="font-medium">{log.function_name || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Rota:</span>{' '}
                          <span className="font-medium">{log.route || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Data:</span>{' '}
                          <span className="font-medium">
                            {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                          </span>
                        </div>
                      </div>

                      {log.auto_correction_attempted && (
                        <div className="bg-muted p-3 rounded-lg text-xs">
                          <div className="flex items-center gap-2">
                            {log.auto_correction_success ? (
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            ) : (
                              <XCircle className="h-3 w-3 text-red-600" />
                            )}
                            <span className="font-medium">Autocorreção:</span>
                            <span>{log.auto_correction_action}</span>
                          </div>
                        </div>
                      )}

                      {log.telegram_notified && (
                        <div className="text-xs text-muted-foreground">
                          📱 Notificado {log.telegram_sent_at && format(new Date(log.telegram_sent_at), 'dd/MM HH:mm')}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {errorLogs.length === 0 && !loading && (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum erro encontrado</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

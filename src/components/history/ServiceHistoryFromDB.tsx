/**
 * ServiceHistoryFromDB.tsx
 * 
 * Componente que exibe histórico de serviços a partir da tabela imutável
 * service_request_history.
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { Button } from '@/components/ui/button';
import {
  Wrench, Truck, MapPin, Calendar, DollarSign, Package, CheckCircle, XCircle, RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatBRL } from '@/lib/formatters';
import { normalizeServiceType } from '@/lib/pt-br-validator';
import { useServiceHistory, ServiceHistoryItem } from '@/hooks/useServiceHistory';

interface ServiceHistoryFromDBProps {
  asClient?: boolean;
  includeTransportTypes?: boolean;
}

const TRANSPORT_TYPES = ['TRANSPORTE_PET', 'ENTREGA_PACOTES', 'GUINCHO'];

export const ServiceHistoryFromDB: React.FC<ServiceHistoryFromDBProps> = ({ asClient = false, includeTransportTypes = false }) => {
  const { items, isLoading, refetch } = useServiceHistory({ asClient, includeTransportTypes });

  if (isLoading) {
    return <CenteredSpinner size="lg" />;
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Nenhum serviço no histórico</h3>
          <p className="text-muted-foreground">
            Serviços concluídos ou cancelados aparecerão aqui automaticamente.
          </p>
          <Button variant="outline" onClick={() => refetch()} className="mt-4 gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {includeTransportTypes ? <Truck className="h-5 w-5 text-primary" /> : <Wrench className="h-5 w-5 text-primary" />}
          <h3 className="text-lg font-semibold">
            {includeTransportTypes ? `Fretes Urbanos (${items.length})` : `Histórico de Serviços (${items.length})`}
          </h3>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {items.map((item) => (
        <ServiceHistoryCard key={item.id} item={item} asClient={asClient} />
      ))}
    </div>
  );
};

const ServiceHistoryCard: React.FC<{ item: ServiceHistoryItem; asClient: boolean }> = ({ item, asClient }) => {
  const isCompleted = item.status_final === 'COMPLETED';
  const isCancelled = item.status_final === 'CANCELLED';
  const isTransport = TRANSPORT_TYPES.includes(item.service_type || '');
  const IconComponent = isTransport ? Truck : Wrench;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <IconComponent className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">
                {normalizeServiceType(item.service_type || 'SERVICO')}
              </CardTitle>
              <Badge
                variant={isCompleted ? 'outline' : isCancelled ? 'destructive' : 'secondary'}
                className={isCompleted ? 'bg-green-50 text-green-700 border-green-200' : ''}
              >
                {isCompleted ? <CheckCircle className="h-3 w-3 mr-1" /> : isCancelled ? <XCircle className="h-3 w-3 mr-1" /> : null}
                {isCompleted ? 'Concluído' : isCancelled ? 'Cancelado' : item.status_final}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-primary">
              {formatBRL(item.final_price || item.estimated_price || 0)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {item.city && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3 text-primary" />
              <span className="text-muted-foreground truncate">
                {item.city}{item.state ? `/${item.state}` : ''}
              </span>
            </div>
          )}
          {item.completed_at && (
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                Concluído em {format(new Date(item.completed_at), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>
          )}
          {item.cancelled_at && (
            <div className="flex items-center gap-2">
              <XCircle className="h-3 w-3 text-destructive" />
              <span className="text-muted-foreground">
                Cancelado em {format(new Date(item.cancelled_at), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

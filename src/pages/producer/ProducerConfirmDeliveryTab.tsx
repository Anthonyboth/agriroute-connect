import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { precoPreenchidoDoFrete } from '@/lib/precoPreenchido';
import type { ProducerFreight } from './types';

interface ProducerConfirmDeliveryTabProps {
  freights: ProducerFreight[];
  highlightFreightId?: string;
  onConfirmDelivery: (freight: ProducerFreight) => void;
  onDispute?: (freight: ProducerFreight) => void;
}

export const ProducerConfirmDeliveryTab: React.FC<ProducerConfirmDeliveryTabProps> = ({
  freights,
  highlightFreightId,
  onConfirmDelivery,
  onDispute,
}) => {
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'critical' | 'urgent'>('all');

  const pendingConfirmation = freights.filter(f => f.status === 'DELIVERED_PENDING_CONFIRMATION');
  
  const filteredFreights = pendingConfirmation.filter(f => {
    if (urgencyFilter === 'all') return true;
    const hours = f.deliveryDeadline?.hoursRemaining ?? 72;
    if (urgencyFilter === 'critical') return hours < 6;
    if (urgencyFilter === 'urgent') return hours < 24 && hours >= 6;
    return true;
  }).sort((a, b) => {
    const deadlineA = a.deliveryDeadline?.hoursRemaining ?? 72;
    const deadlineB = b.deliveryDeadline?.hoursRemaining ?? 72;
    return deadlineA - deadlineB;
  });

  const criticalCount = pendingConfirmation.filter(f => (f.deliveryDeadline?.hoursRemaining ?? 72) < 6).length;
  const urgentCount = pendingConfirmation.filter(f => {
    const h = f.deliveryDeadline?.hoursRemaining ?? 72;
    return h < 24 && h >= 6;
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Confirmar Entregas</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={urgencyFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setUrgencyFilter('all');
            }}
          >
            Todos ({pendingConfirmation.length})
          </Button>
          <Button
            variant={urgencyFilter === 'critical' ? 'destructive' : 'outline'}
            size="sm"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setUrgencyFilter('critical');
            }}
          >
            🚨 Críticos ({criticalCount})
          </Button>
          <Button
            variant={urgencyFilter === 'urgent' ? 'default' : 'outline'}
            size="sm"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setUrgencyFilter('urgent');
            }}
            className={urgencyFilter === 'urgent' ? 'bg-orange-600 hover:bg-orange-700' : ''}
          >
            ⚠️ Urgentes ({urgentCount})
          </Button>
        </div>
      </div>
      
      {filteredFreights.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">Nenhuma entrega aguardando confirmação</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {urgencyFilter === 'all' 
                ? 'Não há entregas reportadas pelos motoristas aguardando sua confirmação.'
                : urgencyFilter === 'critical'
                ? 'Não há entregas críticas (< 6h) aguardando confirmação.'
                : 'Não há entregas urgentes (< 24h) aguardando confirmação.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 auto-rows-[1fr]">
            {filteredFreights.map((freight) => (
              <Card 
                key={freight.id} 
                className={`h-full flex flex-col border-amber-200 ${
                  highlightFreightId === freight.id 
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 shadow-xl animate-pulse border-l-yellow-500' 
                    : 'bg-amber-50/50'
                } border-l-4 border-l-amber-500`}
              >
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <h4 className="font-semibold text-lg line-clamp-1">
                        {freight.cargo_type}
                      </h4>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {freight.origin_address} → {freight.destination_address}
                      </p>
                      
                      {freight.deliveryDeadline && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                          freight.deliveryDeadline.isCritical 
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' 
                            : freight.deliveryDeadline.isUrgent 
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' 
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          <Clock className="h-3 w-3" />
                          {freight.deliveryDeadline.displayText}
                        </div>
                      )}
                      
                      <p className="text-xs font-medium text-amber-700 mt-2">
                        ⏰ Entrega reportada - Aguardando confirmação
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-2">
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300 whitespace-nowrap">
                        Aguardando Confirmação
                      </Badge>
                      <p className="text-lg font-bold text-green-600 whitespace-nowrap">
                        {precoPreenchidoDoFrete(freight.id, freight).primaryText}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-4 h-full pt-0">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-xs text-muted-foreground">Motorista:</p>
                      <p className="text-foreground truncate">
                        {freight.profiles?.full_name || 'Aguardando motorista'}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-xs text-muted-foreground">Telefone:</p>
                      <p className="text-foreground truncate">
                        {freight.profiles?.contact_phone || '-'}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-xs text-muted-foreground">Reportado em:</p>
                      <p className="text-foreground text-xs">
                        {new Date(freight.updated_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-xs text-muted-foreground">Prazo confirmação:</p>
                      <p className="text-foreground text-xs">
                        {freight.metadata?.confirmation_deadline 
                          ? new Date(freight.metadata.confirmation_deadline).toLocaleString('pt-BR')
                          : '72h após reportado'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Botões: apenas Confirmar e Contestar */}
                  <div className="mt-auto grid grid-cols-2 gap-3">
                    <Button
                      size="sm"
                      variant="destructive"
                      type="button"
                      className="w-full"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDispute?.(freight);
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-1.5" />
                      Contestar
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onConfirmDelivery(freight);
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-1.5" />
                      Confirmar Entrega
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SafeListWrapper } from '@/components/SafeListWrapper';
import { MyAssignmentCard } from '@/components/MyAssignmentCard';
import { ServiceRequestInProgressCard } from '@/components/ServiceRequestInProgressCard';
import { Package, Truck, Wrench, Play, CheckCircle } from 'lucide-react';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import type { Freight } from './types';

interface DriverOngoingTabProps {
  activeAssignments: any[];
  visibleOngoing: Freight[];
  acceptedServiceRequests: any[];
  freightCheckins: Record<string, number>;
  onAssignmentAction: (freightId: string) => void;
  onMarkServiceOnTheWay: (requestId: string) => void;
  onFinishService: (requestId: string) => void;
  onCheckin: (freightId: string) => void;
  onViewDetails: (freightId: string) => void;
  onGoToAvailable: () => void;
}

export const DriverOngoingTab: React.FC<DriverOngoingTabProps> = ({
  activeAssignments,
  visibleOngoing,
  acceptedServiceRequests,
  freightCheckins,
  onAssignmentAction,
  onMarkServiceOnTheWay,
  onFinishService,
  onCheckin,
  onViewDetails,
  onGoToAvailable,
}) => {
  const totalCount = activeAssignments.length + visibleOngoing.length + acceptedServiceRequests.length;

  return (
    <SafeListWrapper>
      <div className="flex flex-col space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-semibold">Em Andamento</h3>
          <Badge variant="secondary" className="text-xs">
            {totalCount}
          </Badge>
        </div>
      </div>
      
      {/* Service Requests Aceitos (Guincho/Mudança) */}
      {acceptedServiceRequests && acceptedServiceRequests.length > 0 && (
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-orange-600" />
            <h4 className="text-sm font-semibold text-orange-600">Serviços em Andamento</h4>
            <Badge variant="outline" className="text-xs border-orange-300">{acceptedServiceRequests.length}</Badge>
          </div>
          <SafeListWrapper fallback={<div className="p-4 text-sm text-muted-foreground">Atualizando lista...</div>}>
            {acceptedServiceRequests.map((request) => (
              <ServiceRequestInProgressCard
                key={request.id}
                request={request}
                onMarkOnTheWay={onMarkServiceOnTheWay}
                onFinishService={onFinishService}
              />
            ))}
          </SafeListWrapper>
        </div>
      )}
      
      {/* Assignments (Fretes com valores individualizados) */}
      {activeAssignments && activeAssignments.length > 0 && (
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-green-600" />
            <h4 className="text-sm font-semibold text-green-600">Seus Contratos Ativos</h4>
            <Badge variant="outline" className="text-xs">{activeAssignments.length}</Badge>
          </div>
          <SafeListWrapper fallback={<div className="p-4 text-sm text-muted-foreground">Atualizando lista...</div>}>
            {activeAssignments.map((assignment) => {
              if (!assignment?.id) return null;
              
              return (
                <MyAssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  onAction={() => onAssignmentAction(assignment.freight_id)}
                />
              );
            })}
          </SafeListWrapper>
        </div>
      )}
      
      {visibleOngoing.length > 0 ? (
        <SafeListWrapper>
          <div className="space-y-4">
            {visibleOngoing.map((freight) => (
              <Card key={freight.id} className="shadow-sm border border-border/50 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  {/* Header com tipo de carga e status */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Package className="h-4 w-4 text-primary" />
                      <h3 className="font-medium text-foreground text-sm">
                        {getCargoTypeLabel(freight.cargo_type)}
                      </h3>
                    </div>
                    <Badge variant="default" className="text-xs bg-primary text-primary-foreground px-2 py-1">
                      {freight.status === 'ACCEPTED' ? 'Aceito' : 'Ativo'}
                    </Badge>
                  </div>

                  {/* Origem e Destino simplificados - apenas cidades */}
                  <div className="space-y-2 text-sm mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">De:</span>
                      <span className="font-medium truncate max-w-[200px]">
                        {freight.origin_address.split(',').slice(-2).join(',').trim()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Para:</span>
                      <span className="font-medium truncate max-w-[200px]">
                        {freight.destination_address.split(',').slice(-2).join(',').trim()}
                      </span>
                    </div>
                  </div>

                  {/* Valor em destaque */}
                  <div className="bg-gradient-to-r from-primary/5 to-accent/5 p-3 rounded-lg border border-border/20 mb-3">
                    <div className="text-center">
                      <span className="text-lg font-bold text-primary">
                        R$ {freight.price?.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Botões de ação simplificados */}
                  <div className="flex gap-2">
                    {!freight.is_service_request && (freight.status === 'ACCEPTED' || freight.status === 'LOADING' || freight.status === 'IN_TRANSIT') && (
                      <Button 
                        size="sm" 
                        className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => onCheckin(freight.id)}
                      >
                        Check-in
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="flex-1 h-8 text-xs border-primary/30 hover:bg-primary/5"
                      onClick={() => onViewDetails(freight.id)}
                    >
                      Ver Detalhes
                    </Button>
                  </div>

                  {/* Check-ins counter - apenas contador simples */}
                  {freightCheckins[freight.id] > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <div className="flex items-center justify-center text-xs text-muted-foreground">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {freightCheckins[freight.id]} check-in{freightCheckins[freight.id] !== 1 ? 's' : ''} realizado{freightCheckins[freight.id] !== 1 ? 's' : ''}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </SafeListWrapper>
      ) : (
        (!activeAssignments || activeAssignments.length === 0) && acceptedServiceRequests.length === 0 ? (
          <div className="text-center py-12">
            <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              Nenhum frete em andamento
            </h3>
            <p className="text-muted-foreground mb-4">
              Quando você aceitar um frete ou ele for aceito pelo produtor, aparecerá aqui
            </p>
            <Button 
              onClick={onGoToAvailable}
              className="mt-2"
            >
              Ver Fretes Disponíveis
            </Button>
          </div>
        ) : null
      )}
    </SafeListWrapper>
  );
};

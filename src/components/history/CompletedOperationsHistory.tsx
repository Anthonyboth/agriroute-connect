/**
 * CompletedOperationsHistory.tsx
 * 
 * Componente que exibe histórico de operações concluídas
 * a partir da tabela imutável `operation_history`.
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { 
  CheckCircle, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Truck, 
  Wrench,
  Star,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatBRL } from '@/lib/formatters';
import { useOperationHistory, OperationHistoryItem } from '@/hooks/useOperationHistory';
import { normalizeServiceType } from '@/lib/pt-br-validator';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import { isFreightType } from '@/lib/item-classification';

interface CompletedOperationsHistoryProps {
  entityType?: 'FREIGHT' | 'SERVICE' | null;
  limit?: number;
}

const getTypeLabel = (item: OperationHistoryItem): string => {
  if (!item.service_or_cargo_type) return 'Operação';
  if (item.entity_type === 'FREIGHT') {
    return getCargoTypeLabel(item.service_or_cargo_type);
  }
  return normalizeServiceType(item.service_or_cargo_type);
};

const getEntityIcon = (entityType: string) => {
  return entityType === 'FREIGHT' ? Truck : Wrench;
};

export const CompletedOperationsHistory: React.FC<CompletedOperationsHistoryProps> = ({
  entityType = null,
  limit = 50,
}) => {
  const { items, loading, stats } = useOperationHistory({ entityType, limit });

  if (loading) {
    return <CenteredSpinner size="lg" />;
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Concluídos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{formatBRL(stats.totalRevenue)}</div>
            <div className="text-xs text-muted-foreground">Receita Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{formatBRL(stats.avgPrice)}</div>
            <div className="text-xs text-muted-foreground">Valor Médio</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">
              {stats.ratedCount}/{stats.total}
            </div>
            <div className="text-xs text-muted-foreground">Avaliados</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de operações */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma operação concluída</h3>
            <p className="text-muted-foreground">
              Operações concluídas aparecerão aqui automaticamente.
            </p>
          </CardContent>
        </Card>
      ) : (
        items.map((item) => {
          const EntityIcon = getEntityIcon(item.entity_type);
          const weight = item.snapshot_data?.weight;
          const distanceKm = item.snapshot_data?.distance_km;

          return (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <EntityIcon className="h-4 w-4 text-primary" />
                      <CardTitle className="text-base">
                        {getTypeLabel(item)}
                      </CardTitle>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Concluído
                      </Badge>
                      {item.rating_completed && (
                        <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                          <Star className="h-3 w-3 mr-1" />
                          Avaliado
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs">
                      {item.entity_type === 'FREIGHT' ? 'Frete' : 'Serviço'}
                      {item.truck_count > 1 && ` • ${item.truck_count} carretas`}
                      {weight && ` • ${weight} kg`}
                      {distanceKm && ` • ${distanceKm} km`}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">
                      {formatBRL(item.final_price)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {item.origin_location && item.origin_location !== 'N/A' && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3 text-green-600" />
                      <span className="text-muted-foreground truncate">
                        {item.origin_location}
                      </span>
                    </div>
                  )}
                  {item.destination_location && 
                   item.destination_location !== 'N/A' && 
                   item.destination_location !== item.origin_location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3 text-red-600" />
                      <span className="text-muted-foreground truncate">
                        {item.destination_location}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Concluído em {format(new Date(item.completed_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Criado em {format(new Date(item.operation_created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
};

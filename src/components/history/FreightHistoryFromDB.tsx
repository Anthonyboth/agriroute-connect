/**
 * FreightHistoryFromDB.tsx
 * 
 * Componente que exibe histórico de fretes a partir das tabelas imutáveis
 * freight_history e freight_assignment_history (conforme role do usuário).
 */
import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { Button } from '@/components/ui/button';
import {
  Truck, MapPin, Calendar, DollarSign, Package, CheckCircle, XCircle, RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatBRL, formatKm } from '@/lib/formatters';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import { useFreightHistory, FreightHistoryItem, FreightAssignmentHistoryItem } from '@/hooks/useFreightHistory';
import { getFreightStatusLabel } from '@/lib/freight-status';
import { ReopenFreightModal } from '@/components/ReopenFreightModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FreightHistoryFromDBProps {
  role?: 'PRODUTOR' | 'MOTORISTA' | 'TRANSPORTADORA';
  companyId?: string;
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const isCompleted = ['COMPLETED', 'DELIVERED'].includes(status);
  const isCancelled = status === 'CANCELLED';
  
  return (
    <Badge
      variant={isCompleted ? 'outline' : isCancelled ? 'destructive' : 'secondary'}
      className={isCompleted ? 'bg-green-50 text-green-700 border-green-200' : ''}
    >
      {isCompleted ? <CheckCircle className="h-3 w-3 mr-1" /> : isCancelled ? <XCircle className="h-3 w-3 mr-1" /> : null}
      {getFreightStatusLabel(status as any) || status}
    </Badge>
  );
};

/**
 * Mapeia um item do histórico imutável para o formato esperado pelo ReopenFreightModal
 */
function mapHistoryToFreight(item: FreightHistoryItem): any {
  // Construir endereços a partir de cidade/estado quando origin_address não está disponível no histórico
  const originAddress = item.origin_city 
    ? `${item.origin_city}${item.origin_state ? ', ' + item.origin_state : ''}`
    : '';
  const destinationAddress = item.destination_city
    ? `${item.destination_city}${item.destination_state ? ', ' + item.destination_state : ''}`
    : '';

  return {
    id: item.freight_id,
    status: item.status_final,
    producer_id: item.producer_id,
    cargo_type: item.cargo_type,
    weight: item.weight,
    origin_address: originAddress,
    origin_city: item.origin_city,
    origin_state: item.origin_state,
    destination_address: destinationAddress,
    destination_city: item.destination_city,
    destination_state: item.destination_state,
    distance_km: item.distance_km,
    price: item.price_total,
    required_trucks: item.required_trucks,
    // Campos que podem não existir no histórico — o ReopenFreightModal usa fallbacks
    pickup_date: null,
    delivery_date: null,
    description: '',
    urgency: 'MEDIUM',
    service_type: 'CARGA',
    // Flag para indicar que veio do histórico (dados parciais)
    _from_history: true,
  };
}

export const FreightHistoryFromDB: React.FC<FreightHistoryFromDBProps> = ({ role, companyId }) => {
  const { freightHistory, assignmentHistory, isLoading, refetch } = useFreightHistory({ role, companyId });
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [freightToReopen, setFreightToReopen] = useState<any>(null);

  const handleReopenFreight = useCallback((item: FreightHistoryItem) => {
    setFreightToReopen(mapHistoryToFreight(item));
    setReopenModalOpen(true);
  }, []);

  const handleReopenSuccess = useCallback(() => {
    setReopenModalOpen(false);
    setFreightToReopen(null);
    refetch();
    toast.success('Frete reaberto com sucesso!');
  }, [refetch]);

  if (isLoading) {
    return <CenteredSpinner size="lg" />;
  }

  const isProducer = role === 'PRODUTOR';
  const isDriver = role === 'MOTORISTA' || !role;

  // Para produtor: mostrar freight_history
  // Para motorista/transportadora: mostrar freight_assignment_history
  const items = isProducer ? freightHistory : [];
  const assignments = !isProducer ? assignmentHistory : [];

  const totalItems = items.length + assignments.length;

  if (totalItems === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Nenhum frete no histórico</h3>
          <p className="text-muted-foreground">
            Fretes concluídos ou cancelados aparecerão aqui automaticamente.
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">
            Histórico de Fretes ({totalItems})
          </h3>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Produtor: freight_history */}
      {items.map((item) => (
        <FreightHistoryCard
          key={item.id}
          item={item}
          isProducer
          onReopen={isProducer ? () => handleReopenFreight(item) : undefined}
        />
      ))}

      {/* Motorista/Transportadora: assignment_history */}
      {assignments.map((item) => (
        <AssignmentHistoryCard key={item.id} item={item} />
      ))}

      {/* Modal de Reabrir Frete */}
      {freightToReopen && (
        <ReopenFreightModal
          isOpen={reopenModalOpen}
          onClose={() => {
            setReopenModalOpen(false);
            setFreightToReopen(null);
          }}
          freight={freightToReopen}
          onSuccess={handleReopenSuccess}
        />
      )}
    </div>
  );
};

const FreightHistoryCard: React.FC<{
  item: FreightHistoryItem;
  isProducer?: boolean;
  onReopen?: () => void;
}> = ({ item, isProducer, onReopen }) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Truck className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">
              {getCargoTypeLabel(item.cargo_type || 'FRETE')}
            </CardTitle>
            <StatusBadge status={item.status_final} />
            {item.required_trucks > 1 && (
              <Badge variant="secondary">{item.required_trucks} carretas</Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            {item.distance_km > 0 && `${item.distance_km} km`}
            {item.weight > 0 && ` • ${item.weight} kg`}
          </CardDescription>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-primary">
            {formatBRL(isProducer ? item.price_total : item.price_per_truck)}
          </p>
          {isProducer && item.required_trucks > 1 && (
            <p className="text-xs text-muted-foreground">
              {formatBRL(item.price_per_truck)}/carreta
            </p>
          )}
        </div>
      </div>
    </CardHeader>
    <CardContent className="pt-0">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        {item.origin_city && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3 text-green-600" />
            <span className="text-muted-foreground truncate">
              {item.origin_city}{item.origin_state ? `/${item.origin_state}` : ''}
            </span>
          </div>
        )}
        {item.destination_city && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3 text-red-600" />
            <span className="text-muted-foreground truncate">
              {item.destination_city}{item.destination_state ? `/${item.destination_state}` : ''}
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

      {/* ✅ Botão Reabrir Frete — apenas para produtores */}
      {onReopen && (
        <div className="mt-3 pt-3 border-t">
          <Button
            variant="secondary"
            size="sm"
            onClick={onReopen}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reabrir Frete
          </Button>
        </div>
      )}
    </CardContent>
  </Card>
);

const AssignmentHistoryCard: React.FC<{ item: FreightAssignmentHistoryItem }> = ({ item }) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Truck className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">
              {getCargoTypeLabel(item.cargo_type || 'FRETE')}
            </CardTitle>
            <StatusBadge status={item.status_final} />
          </div>
          <CardDescription className="text-xs">
            {item.distance_km > 0 && `${item.distance_km} km`}
            {item.weight_per_truck > 0 && ` • ${item.weight_per_truck} kg`}
          </CardDescription>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-primary">
            {formatBRL(item.agreed_price)}
          </p>
          <p className="text-xs text-muted-foreground">por viagem</p>
        </div>
      </div>
    </CardHeader>
    <CardContent className="pt-0">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        {item.origin_city && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3 text-green-600" />
            <span className="text-muted-foreground truncate">
              {item.origin_city}{item.origin_state ? `/${item.origin_state}` : ''}
            </span>
          </div>
        )}
        {item.destination_city && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3 text-red-600" />
            <span className="text-muted-foreground truncate">
              {item.destination_city}{item.destination_state ? `/${item.destination_state}` : ''}
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
      </div>
    </CardContent>
  </Card>
);

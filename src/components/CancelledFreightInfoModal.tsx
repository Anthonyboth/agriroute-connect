import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { XCircle, MapPin, Package, Calendar, Clock, RotateCcw, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { useNavigate } from 'react-router-dom';

interface CancelledFreightInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  freightId: string;
  cancellationReason?: string;
  cancelledAt?: string;
}

interface FreightInfo {
  id: string;
  cargo_type: string | null;
  origin_city: string | null;
  origin_state: string | null;
  destination_city: string | null;
  destination_state: string | null;
  price: number | null;
  weight: number | null;
  distance_km: number | null;
  pickup_date: string | null;
  delivery_date: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  updated_at: string | null;
  status: string | null;
  required_trucks: number | null;
  metadata: any;
}

export const CancelledFreightInfoModal: React.FC<CancelledFreightInfoModalProps> = ({
  isOpen,
  onClose,
  freightId,
  cancellationReason,
  cancelledAt,
}) => {
  const [freight, setFreight] = useState<FreightInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && freightId) {
      fetchFreightInfo();
    }
  }, [isOpen, freightId]);

  const fetchFreightInfo = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('freights')
        .select('id, cargo_type, origin_city, origin_state, destination_city, destination_state, price, weight, distance_km, pickup_date, delivery_date, cancellation_reason, cancelled_at, updated_at, status, required_trucks, metadata')
        .eq('id', freightId)
        .single();

      if (error) throw error;
      setFreight(data);
    } catch (err) {
      console.error('[CancelledFreightInfoModal] Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const effectiveReason = freight?.cancellation_reason || cancellationReason || 'Cancelamento automático: prazo expirado sem aceite';
  const effectiveCancelledAt = freight?.cancelled_at || freight?.metadata?.auto_cancelled_at || cancelledAt || freight?.updated_at;

  const handleReopen = () => {
    onClose();
    navigate('/dashboard/producer', {
      state: {
        openTab: 'history',
        highlightFreightId: freightId,
        triggerReopen: true,
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-destructive/10">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-base">Frete Cancelado</DialogTitle>
              <DialogDescription className="text-xs">
                Detalhes do cancelamento automático
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <CenteredSpinner />
        ) : freight ? (
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="text-xs">
                🚫 Cancelado Automaticamente
              </Badge>
            </div>

            {/* Rota */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="font-medium">
                  {freight.origin_city || '?'}/{freight.origin_state || '?'}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">
                  {freight.destination_city || '?'}/{freight.destination_state || '?'}
                </span>
              </div>

              {freight.distance_km && (
                <p className="text-xs text-muted-foreground ml-6">
                  {freight.distance_km} km de distância
                </p>
              )}
            </div>

            {/* Detalhes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Carga</p>
                  <p className="font-medium text-sm">{freight.cargo_type || '—'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="font-medium text-sm">{formatCurrency(freight.price)}</p>
                </div>
              </div>

              {freight.pickup_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Data Coleta</p>
                    <p className="font-medium text-sm">{formatDate(freight.pickup_date)}</p>
                  </div>
                </div>
              )}

              {effectiveCancelledAt && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-xs text-muted-foreground">Cancelado em</p>
                    <p className="font-medium text-sm text-destructive">{formatDate(effectiveCancelledAt)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Motivo */}
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
              <p className="text-xs font-medium text-destructive mb-1">Motivo do cancelamento:</p>
              <p className="text-sm text-foreground">{effectiveReason}</p>
            </div>

            {/* Ações */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Fechar
              </Button>
              <Button onClick={handleReopen} className="flex-1 gap-1.5">
                <RotateCcw className="h-4 w-4" />
                Reabrir Frete
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">Não foi possível carregar os dados do frete.</p>
            <Button variant="outline" size="sm" onClick={onClose} className="mt-3">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

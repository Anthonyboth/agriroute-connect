/**
 * Painel de Pagamentos Externos para Transportadoras
 * 
 * Mostra os pagamentos de motoristas afiliados (external_payments).
 * Sub-abas: A Fazer (pendentes) | Recebidos (confirmados)
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-avatar-image';
import { SafeListWrapper } from '@/components/SafeListWrapper';

import { 
  DollarSign, CheckCircle, Clock, AlertTriangle, 
  Truck, User, RefreshCw, MapPin, Package, Calendar,
  ArrowRight, Hash, History
} from 'lucide-react';
import { useCompanyPayments, type CompanyPayment } from '@/hooks/useCompanyPayments';
import { formatBRL } from '@/lib/formatters';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { TabBadge } from '@/components/ui/TabBadge';

export function CompanyExternalPaymentsPanel() {
  const { 
    payments, 
    loading, 
    error, 
    refetch,
    totalPendingPayments,
    totalAwaitingConfirmation,
    totalConfirmed,
    totalAmount,
  } = useCompanyPayments();

  const [subTab, setSubTab] = useState('a-fazer');

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    proposed: { 
      label: 'Aguardando Produtor Pagar', 
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300',
      icon: <Clock className="h-3.5 w-3.5" />
    },
    paid_by_producer: { 
      label: 'Produtor Pagou — Aguardando Confirmação', 
      color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300',
      icon: <DollarSign className="h-3.5 w-3.5" />
    },
    confirmed: { 
      label: 'Recebimento Confirmado', 
      color: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300',
      icon: <CheckCircle className="h-3.5 w-3.5" />
    },
    disputed: { 
      label: 'Contestado', 
      color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300',
      icon: <AlertTriangle className="h-3.5 w-3.5" />
    },
    cancelled: { 
      label: 'Cancelado', 
      color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/30 dark:text-gray-300',
      icon: <Clock className="h-3.5 w-3.5" />
    },
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const buildRoute = (freight?: CompanyPayment['freight']) => {
    if (!freight) return null;
    const origin = [freight.origin_city, freight.origin_state].filter(Boolean).join('/');
    const dest = [freight.destination_city, freight.destination_state].filter(Boolean).join('/');
    if (!origin && !dest) return null;
    return { origin: origin || '?', dest: dest || '?' };
  };

  // Separar pagamentos por status
  const pendingPayments = payments.filter(p => 
    ['proposed', 'paid_by_producer', 'disputed'].includes(p.status)
  );
  const completedPayments = payments.filter(p => 
    ['confirmed', 'cancelled'].includes(p.status)
  );

  if (loading) {
    return <CenteredSpinner className="p-12 min-h-[200px]" />;
  }

  const renderPaymentCard = (payment: CompanyPayment) => {
    const config = statusConfig[payment.status] || statusConfig.proposed;
    const route = buildRoute(payment.freight);
    const hasAmount = payment.amount != null && payment.amount > 0;
    
    return (
      <Card 
        key={payment.id} 
        className={`border-l-4 ${
          payment.status === 'paid_by_producer' 
            ? 'border-l-blue-500' 
            : payment.status === 'confirmed' 
            ? 'border-l-green-500' 
            : payment.status === 'disputed'
            ? 'border-l-red-500'
            : 'border-l-yellow-500'
        }`}
      >
        <CardContent className="p-4 space-y-3">
          {/* Linha 1: Motorista + Valor */}
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-10 w-10 flex-shrink-0">
                <SignedAvatarImage src={payment.driver?.profile_photo_url} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                  {payment.driver?.full_name?.charAt(0) || 'M'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">
                  {payment.driver?.full_name || 'Motorista'}
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Produtor: {payment.producer?.full_name || '—'}</span>
                </div>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <p className={`text-xl font-bold ${
                payment.status === 'confirmed' 
                  ? 'text-green-600 dark:text-green-400' 
                  : payment.status === 'paid_by_producer' 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-foreground'
              }`}>
                {hasAmount ? `R$ ${formatBRL(payment.amount)}` : 'Valor não definido'}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                {payment.status === 'confirmed' ? 'Recebido' : 'Valor do frete'}
              </p>
            </div>
          </div>

          {/* Linha 2: Detalhes do frete */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            {route ? (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium">{route.origin}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="font-medium">{route.dest}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span>Rota não informada</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {payment.freight?.cargo_type && (
                <span className="flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" />
                  {payment.freight.cargo_type}
                </span>
              )}
              {payment.freight?.distance_km != null && payment.freight.distance_km > 0 && (
                <span className="flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5" />
                  {Math.round(payment.freight.distance_km)} km
                </span>
              )}
              {payment.freight?.pickup_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Coleta: {formatDate(payment.freight.pickup_date)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" />
                {payment.freight_id?.slice(0, 8) || '—'}
              </span>
            </div>
          </div>

          {/* Linha 3: Status + Datas */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="outline" className={`${config.color} gap-1 py-1 px-2`}>
              {config.icon}
              <span>{config.label}</span>
            </Badge>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              {payment.proposed_at && (
                <span>Proposto: {formatDate(payment.proposed_at)}</span>
              )}
              {payment.status === 'paid_by_producer' && payment.updated_at && (
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  Pago em: {formatDate(payment.updated_at)}
                </span>
              )}
              {payment.status === 'confirmed' && payment.confirmed_at && (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  Confirmado: {formatDate(payment.confirmed_at)}
                </span>
              )}
              {!payment.proposed_at && payment.created_at && (
                <span>Criado: {formatDate(payment.created_at)}</span>
              )}
            </div>
          </div>

          {payment.notes && (
            <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2 italic">
              📝 {payment.notes}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 border-l-4 border-l-yellow-500">
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">Aguardando Pgto</span>
          </div>
          <p className="text-2xl font-bold">{totalPendingPayments}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium">Aguardando Confirmação</span>
          </div>
          <p className="text-2xl font-bold">{totalAwaitingConfirmation}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-green-500">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Confirmados</span>
          </div>
          <p className="text-2xl font-bold">{totalConfirmed}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-primary">
          <div className="flex items-center gap-2 text-primary mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium">Total Confirmado</span>
          </div>
          <p className="text-2xl font-bold text-primary">R$ {formatBRL(totalAmount)}</p>
        </Card>
      </div>

      {/* Sub-abas: A Fazer / Recebidos */}
      <Tabs value={subTab} onValueChange={setSubTab} className="w-full">
        <div className="flex justify-between items-center mb-2">
          <TabsList className="grid w-full max-w-md grid-cols-2 h-11 bg-muted/40 p-1 rounded-xl">
            <TabsTrigger 
              value="a-fazer" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <Clock className="h-4 w-4" />
              A Fazer
              <TabBadge count={pendingPayments.length} />
            </TabsTrigger>
            <TabsTrigger 
              value="recebidos" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <CheckCircle className="h-4 w-4" />
              Recebidos
              <TabBadge count={completedPayments.length} />
            </TabsTrigger>
          </TabsList>
          <Button variant="ghost" size="sm" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
        </div>

        {/* A Fazer - Pagamentos pendentes */}
        <TabsContent value="a-fazer" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-5 w-5 text-orange-600" />
                Pagamentos Pendentes
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Pagamentos aguardando ação: produtor pagar, confirmar recebimento ou em contestação.
              </p>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="text-center py-4 text-destructive">
                  <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
                  <p>{error}</p>
                </div>
              )}

              {!error && pendingPayments.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="mx-auto h-12 w-12 text-green-500/50 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">
                    Tudo em dia!
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Não há pagamentos pendentes no momento.
                  </p>
                </div>
              ) : (
                <SafeListWrapper>
                  <div className="space-y-4">
                    {pendingPayments.map(renderPaymentCard)}
                  </div>
                </SafeListWrapper>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recebidos - Pagamentos confirmados */}
        <TabsContent value="recebidos" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-5 w-5 text-green-600" />
                Pagamentos Recebidos / Finalizados
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Pagamentos confirmados pelos motoristas ou cancelados.
              </p>
            </CardHeader>
            <CardContent>
              {completedPayments.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">
                    Nenhum pagamento finalizado
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Quando pagamentos forem confirmados, aparecerão aqui.
                  </p>
                </div>
              ) : (
                <SafeListWrapper>
                  <div className="space-y-4">
                    {completedPayments.map(renderPaymentCard)}
                  </div>
                </SafeListWrapper>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

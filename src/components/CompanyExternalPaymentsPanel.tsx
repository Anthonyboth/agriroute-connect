/**
 * Painel de Pagamentos Externos para Transportadoras
 * 
 * Mostra os pagamentos de motoristas afiliados (external_payments).
 * Utiliza o hook useCompanyPayments para buscar dados.
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-avatar-image';
import { SafeListWrapper } from '@/components/SafeListWrapper';

import { 
  DollarSign, CheckCircle, Clock, AlertTriangle, 
  Truck, User, Building2, RefreshCw 
} from 'lucide-react';
import { useCompanyPayments, type CompanyPayment } from '@/hooks/useCompanyPayments';
import { formatBRL } from '@/lib/formatters';
import { CenteredSpinner } from '@/components/ui/AppSpinner';

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

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    proposed: { 
      label: 'Aguardando Produtor', 
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      icon: <Clock className="h-3 w-3" />
    },
    paid_by_producer: { 
      label: 'Produtor Pagou', 
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: <DollarSign className="h-3 w-3" />
    },
    confirmed: { 
      label: 'Confirmado', 
      color: 'bg-green-100 text-green-800 border-green-300',
      icon: <CheckCircle className="h-3 w-3" />
    },
    disputed: { 
      label: 'Contestado', 
      color: 'bg-red-100 text-red-800 border-red-300',
      icon: <AlertTriangle className="h-3 w-3" />
    },
    cancelled: { 
      label: 'Cancelado', 
      color: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: <Clock className="h-3 w-3" />
    },
  };

  if (loading) {
    return <CenteredSpinner className="p-12 min-h-[200px]" />;
  }

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-yellow-600 mb-1"><Clock className="h-4 w-4" /><span className="text-xs font-medium">Aguardando Pagamento</span></div>
          <p className="text-2xl font-bold">{totalPendingPayments}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1"><DollarSign className="h-4 w-4" /><span className="text-xs font-medium">Aguardando Confirmação</span></div>
          <p className="text-2xl font-bold">{totalAwaitingConfirmation}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1"><CheckCircle className="h-4 w-4" /><span className="text-xs font-medium">Confirmados</span></div>
          <p className="text-2xl font-bold">{totalConfirmed}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-primary mb-1"><DollarSign className="h-4 w-4" /><span className="text-xs font-medium">Total Confirmado</span></div>
          <p className="text-2xl font-bold">R$ {formatBRL(totalAmount)}</p>
        </Card>
      </div>

      {/* Lista de pagamentos */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Truck className="h-5 w-5" />
              Pagamentos dos Motoristas Afiliados
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-center py-4 text-destructive">
              <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
              <p>{error}</p>
            </div>
          )}

          {!error && payments.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Nenhum pagamento encontrado
              </h3>
              <p className="text-muted-foreground text-sm">
                Quando seus motoristas tiverem pagamentos pendentes de fretes, aparecerão aqui.
              </p>
            </div>
          ) : (
            <SafeListWrapper>
              <div className="space-y-3">
                {payments.map((payment) => {
                  const config = statusConfig[payment.status] || statusConfig.proposed;
                  
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
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start gap-4">
                          {/* Info do motorista e frete */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <SignedAvatarImage src={payment.driver?.profile_photo_url} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {payment.driver?.full_name?.charAt(0) || 'M'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {payment.driver?.full_name || 'Motorista'}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {payment.freight?.cargo_type} • {payment.freight?.origin_city}/{payment.freight?.origin_state} → {payment.freight?.destination_city}/{payment.freight?.destination_state}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={config.color}>
                                {config.icon}
                                <span className="ml-1">{config.label}</span>
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {payment.created_at && new Date(payment.created_at).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>

                          {/* Valor */}
                          <div className="text-right flex-shrink-0">
                            <p className={`text-xl font-bold ${
                              payment.status === 'confirmed' 
                                ? 'text-green-600' 
                                : payment.status === 'paid_by_producer' 
                                ? 'text-blue-600' 
                                : 'text-foreground'
                            }`}>
                              R$ {formatBRL(payment.amount)}
                            </p>
                            {payment.producer?.full_name && (
                              <p className="text-xs text-muted-foreground mt-1">
                                <User className="h-3 w-3 inline mr-1" />
                                {payment.producer.full_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </SafeListWrapper>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

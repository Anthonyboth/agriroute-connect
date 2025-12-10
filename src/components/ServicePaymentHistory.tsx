import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, Calendar, ExternalLink, Receipt } from 'lucide-react';
import { useServicePayments } from '@/hooks/useServicePayments';
import { ComponentLoader } from '@/components/LazyComponents';

export const ServicePaymentHistory: React.FC = () => {
  const { payments, loading, error } = useServicePayments();

  if (loading) {
    return <ComponentLoader />;
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-destructive">Erro ao carregar histórico: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (payments.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <CreditCard className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum pagamento de serviço encontrado
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusLabels: Record<string, string> = {
      'COMPLETED': 'Pago',
      'PENDING': 'Pendente',
      'FAILED': 'Falhou',
      'CANCELLED': 'Cancelado',
      'PROCESSING': 'Processando'
    };
    const label = statusLabels[status] || status;
    
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-green-100 text-green-800">{label}</Badge>;
      case 'PENDING':
        return <Badge variant="secondary">{label}</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">{label}</Badge>;
      case 'CANCELLED':
        return <Badge variant="outline">{label}</Badge>;
      default:
        return <Badge variant="secondary">{label}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Histórico de Pagamentos de Serviços
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {payments.map((payment) => (
          <div key={payment.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Serviço ID: {payment.service_request_id.slice(0, 8)}...
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(payment.created_at).toLocaleString('pt-BR')}
                </div>
              </div>
              {getStatusBadge(payment.status)}
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Valor Bruto:</span>
                <p className="font-medium">
                  R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Taxa Plataforma:</span>
                <p className="font-medium">
                  R$ {payment.platform_fee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {payment.stripe_session_id && payment.status === 'COMPLETED' && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <div className="flex items-center gap-2 text-blue-700">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-xs font-medium">Processado via Stripe</span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  ID: {payment.stripe_payment_intent_id?.slice(-8) || 'N/A'}
                </p>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
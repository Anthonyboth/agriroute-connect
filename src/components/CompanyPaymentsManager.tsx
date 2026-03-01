import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, TrendingUp, Clock, CheckCircle, AlertCircle, Download, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { precoPreenchidoDoFrete } from '@/lib/precoPreenchido';

interface Payment {
  id: string;
  freight_id: string;
  amount: number;
  status: string;
  created_at: string;
  driver_name?: string;
  cargo_type?: string;
}

interface FinancialSummary {
  totalReceivable: number;
  totalPayable: number;
  pending: number;
  completed: number;
}

export const CompanyPaymentsManager: React.FC = () => {
  const { company, drivers } = useTransportCompany();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>({
    totalReceivable: 0,
    totalPayable: 0,
    pending: 0,
    completed: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('receivable');

  useEffect(() => {
    if (company?.id) {
      fetchPayments();
    }
  }, [company]);

  const fetchPayments = async () => {
    if (!company?.id) return;

    try {
      // Buscar pagamentos com IDs mascarados (view segura)
      const { data, error } = await supabase
        .from('freight_payments_secure')
        .select(`
          id,
          freight_id,
          amount,
          status,
          created_at,
          freight:freights(
            id,
            cargo_type,
            driver_id,
            price,
            pricing_type,
            price_per_km,
            price_per_ton,
            required_trucks,
            weight,
            distance_km
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Calcular sumário financeiro
      const normalized = (data || []).map((p: any) => ({
        ...p,
        amount: typeof p.amount === 'number' ? p.amount : 0,
      })) as any[];

      const receivable = normalized.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0) || 0;
      const completed = normalized.filter(p => p.status === 'COMPLETED').reduce((sum, p) => sum + p.amount, 0) || 0;
      const pending = normalized.filter(p => p.status === 'PENDING').length || 0;

      setSummary({
        totalReceivable: receivable,
        totalPayable: 0, // Implementar cálculo de repasses aos motoristas
        pending,
        completed: normalized.filter(p => p.status === 'COMPLETED').length || 0
      });

      setPayments(normalized as Payment[]);
    } catch (error) {
      console.error('Erro ao buscar pagamentos:', error);
      toast.error('Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  };

  const renderPaymentCard = (payment: Payment) => {
    return (
      <Card key={payment.id} className="border-l-4 border-l-green-500">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="space-y-1">
              <p className="font-semibold">{payment.cargo_type || 'Frete'}</p>
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(payment.created_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </p>
            </div>
            <Badge variant={payment.status === 'COMPLETED' ? 'default' : 'outline'}>
              {payment.status === 'COMPLETED' ? 'Pago' : 'Pendente'}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="text-2xl font-bold text-green-600">
                {(() => {
                  const f = (payment as any).freight;
                  if (f?.id) {
                    return precoPreenchidoDoFrete(f.id, {
                      price: f.price || 0,
                      pricing_type: f.pricing_type,
                      price_per_km: f.price_per_km,
                      price_per_ton: f.price_per_ton,
                      required_trucks: f.required_trucks,
                      weight: f.weight,
                      distance_km: f.distance_km,
                    }, { unitOnly: true }).primaryText;
                  }
                  return 'Preço indisponível';
                })()}
              </p>
            </div>
            {payment.status === 'PENDING' && (
              <Button size="sm" variant="outline">
                Processar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Carregando dados financeiros...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-xs text-muted-foreground mb-1">A Receber</p>
            <p className="text-2xl font-bold text-green-600">
              R$ {(summary.totalReceivable / 1000).toFixed(1)}k
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-5 w-5 text-red-600" />
              <AlertCircle className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-xs text-muted-foreground mb-1">A Pagar</p>
            <p className="text-2xl font-bold text-red-600">
              R$ {(summary.totalPayable / 1000).toFixed(1)}k
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <p className="text-xs text-muted-foreground mb-1">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-600">
              {summary.pending}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-xs text-muted-foreground mb-1">Concluídos</p>
            <p className="text-2xl font-bold text-green-600">
              {summary.completed}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gestão de Pagamentos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Gestão Financeira
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              Relatório
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="receivable">A Receber</TabsTrigger>
              <TabsTrigger value="payable">A Pagar</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="receivable" className="space-y-4">
              {payments.filter(p => p.status === 'PENDING').length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">
                    Nenhum pagamento pendente
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {payments
                    .filter(p => p.status === 'PENDING')
                    .map(renderPaymentCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="payable" className="space-y-4">
              <div className="text-center py-12">
                <AlertCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  Sistema de repasses aos motoristas em desenvolvimento
                </p>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              {payments.filter(p => p.status === 'COMPLETED').length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">
                    Nenhum pagamento concluído ainda
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {payments
                    .filter(p => p.status === 'COMPLETED')
                    .slice(0, 10)
                    .map(renderPaymentCard)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

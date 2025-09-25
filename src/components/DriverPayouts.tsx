import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DriverPayoutModal } from './DriverPayoutModal';
import { supabase } from '@/integrations/supabase/client';
import { Banknote, TrendingUp, Clock, CheckCircle, AlertTriangle, Plus, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface DriverPayoutsProps {
  driverId: string;
}

interface PayoutRequest {
  id: string;
  amount: number;
  pix_key: string;
  status: string;
  created_at: string;
  processed_at?: string;
  rejection_reason?: string;
}

interface AvailablePayout {
  id: string;
  amount: number;
  freight_id: string;
  status: string;
  created_at: string;
  freight?: {
    cargo_type: string;
    origin_address: string;
    destination_address: string;
  };
}

export function DriverPayouts({ driverId }: DriverPayoutsProps) {
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [availablePayouts, setAvailablePayouts] = useState<AvailablePayout[]>([]);
  const [showPixKeys, setShowPixKeys] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);

  const availableBalance = availablePayouts
    .filter(p => p.status === 'PENDING')
    .reduce((sum, payout) => sum + payout.amount, 0);

  const totalEarned = availablePayouts
    .filter(p => p.status === 'COMPLETED')
    .reduce((sum, payout) => sum + payout.amount, 0);

  const pendingRequests = payoutRequests.filter(r => r.status === 'PENDING').length;

  useEffect(() => {
    fetchPayoutData();
  }, [driverId]);

  const fetchPayoutData = async () => {
    try {
      setLoading(true);

      // Buscar dados usando edge function
      const { data: response, error } = await supabase.functions.invoke('get-driver-payout-requests', {
        body: { driver_id: driverId }
      });

      if (error) throw error;

      setPayoutRequests(response?.requests || []);
      setAvailablePayouts(response?.available_payouts || []);
    } catch (error) {
      console.error('Erro ao carregar dados de pagamentos:', error);
      toast.error('Erro ao carregar informações de pagamentos');
    } finally {
      setLoading(false);
    }
  };

  const togglePixVisibility = (requestId: string) => {
    setShowPixKeys(prev => ({
      ...prev,
      [requestId]: !prev[requestId]
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pendente</Badge>;
      case 'PROCESSING':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Processando</Badge>;
      case 'COMPLETED':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Concluído</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'PROCESSING':
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'REJECTED':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const maskPixKey = (pixKey: string) => {
    if (pixKey.includes('@')) {
      const [user, domain] = pixKey.split('@');
      return `${user.slice(0, 3)}***@${domain}`;
    }
    
    const cleanKey = pixKey.replace(/[^\d]/g, '');
    
    if (cleanKey.length === 11) { // CPF
      return `***.***.***-${cleanKey.slice(-2)}`;
    }
    
    if (cleanKey.length === 14) { // CNPJ
      return `**.***.***/****-${cleanKey.slice(-2)}`;
    }
    
    return `${pixKey.slice(0, 4)}***${pixKey.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Aviso sobre pagamentos pela plataforma */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="font-semibold text-amber-800 dark:text-amber-200">
                Pagamentos pela plataforma ainda não estão disponíveis
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Por enquanto, todos os pagamentos devem ser feitos diretamente aos motoristas. 
                Os valores mostrados aqui são apenas para controle interno e não representam pagamentos automáticos da plataforma.
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Entre em contato diretamente com os produtores para receber seus pagamentos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">Saldo Disponível</p>
                <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                  R$ {availableBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <Banknote className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Recebido</p>
                <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                  R$ {totalEarned.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Saques Pendentes</p>
                <p className="text-2xl font-bold text-amber-800 dark:text-amber-200">{pendingRequests}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botão de Novo Saque */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Gerenciar Saques</h3>
        <Button 
          onClick={() => setShowPayoutModal(true)}
          disabled={availableBalance < 50}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Saque PIX
        </Button>
      </div>

      {/* Solicitações de Saque */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Saques</CardTitle>
        </CardHeader>
        <CardContent>
          {payoutRequests.length === 0 ? (
            <div className="text-center py-8">
              <Banknote className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhuma solicitação de saque ainda.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete fretes para ter valores disponíveis para saque.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {payoutRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(request.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          R$ {request.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        {getStatusBadge(request.status)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-muted-foreground">
                          PIX: {showPixKeys[request.id] ? request.pix_key : maskPixKey(request.pix_key)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePixVisibility(request.id)}
                          className="h-6 w-6 p-0"
                        >
                          {showPixKeys[request.id] ? 
                            <EyeOff className="h-3 w-3" /> : 
                            <Eye className="h-3 w-3" />
                          }
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Solicitado em {new Date(request.created_at).toLocaleDateString('pt-BR')} às {new Date(request.created_at).toLocaleTimeString('pt-BR')}
                      </p>
                      {request.rejection_reason && (
                        <p className="text-xs text-red-600 mt-1">
                          Motivo da rejeição: {request.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Valores Disponíveis para Saque */}
      <Card>
        <CardHeader>
          <CardTitle>Valores Disponíveis</CardTitle>
        </CardHeader>
        <CardContent>
          {availablePayouts.filter(p => p.status === 'PENDING').length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum valor disponível para saque.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete mais fretes para acumular valores para saque.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {availablePayouts
                .filter(p => p.status === 'PENDING')
                .map((payout) => (
                <div key={payout.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        R$ {payout.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Disponível</Badge>
                    </div>
                    {payout.freight && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {payout.freight.cargo_type} - {payout.freight.origin_address} → {payout.freight.destination_address}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Disponível desde {new Date(payout.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Saque */}
      <DriverPayoutModal
        isOpen={showPayoutModal}
        onClose={() => {
          setShowPayoutModal(false);
          fetchPayoutData(); // Recarregar dados após fechar modal
        }}
        availableBalance={availableBalance}
        driverId={driverId}
      />
    </div>
  );
}
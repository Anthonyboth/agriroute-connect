import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Banknote, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Plus, 
  Eye, 
  EyeOff, 
  RefreshCw,
  DollarSign,
  History
} from 'lucide-react';
import { useProviderBalance } from '@/hooks/useProviderBalance';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ServiceProviderPayoutsProps {
  providerId: string;
}

export function ServiceProviderPayouts({ providerId }: ServiceProviderPayoutsProps) {
  const { 
    balance, 
    loading, 
    error, 
    fetchBalance, 
    requestPayout, 
    availableBalance, 
    totalEarned, 
    recentTransactions 
  } = useProviderBalance();
  
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showPixKeys, setShowPixKeys] = useState<{ [key: string]: boolean }>({});
  const [pixKey, setPixKey] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pendingPayouts = recentTransactions.filter(t => 
    t.transaction_type === 'PAYOUT' && t.status === 'PENDING'
  ).length;

  const handleWithdrawalRequest = async () => {
    if (!pixKey || !withdrawalAmount) {
      return;
    }

    const amount = parseFloat(withdrawalAmount);
    
    try {
      setSubmitting(true);
      await requestPayout(amount, pixKey, 'Saque via PIX');
      
      setShowPayoutModal(false);
      setPixKey('');
      setWithdrawalAmount('');
    } catch (error) {
      // Erro já tratado no hook
    } finally {
      setSubmitting(false);
    }
  };

  const togglePixVisibility = (transactionId: string) => {
    setShowPixKeys(prev => ({
      ...prev,
      [transactionId]: !prev[transactionId]
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pendente</Badge>;
      case 'COMPLETED':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Concluído</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Falhou</Badge>;
      case 'CANCELLED':
        return <Badge variant="secondary">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'FAILED':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'CANCELLED':
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTransactionTypeLabel = (transactionType: string) => {
    switch (transactionType) {
      case 'CREDIT':
        return 'Crédito';
      case 'PAYOUT':
        return 'Saque PIX';
      case 'DEBIT':
        return 'Débito';
      default:
        return transactionType;
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

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold text-destructive mb-2">Erro ao carregar saldo</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchBalance} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
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
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Confirmado pela Stripe
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
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Líquido (após comissão)
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
                <p className="text-2xl font-bold text-amber-800 dark:text-amber-200">{pendingPayouts}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Processamento em até 2 dias
                </p>
              </div>
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info sobre sistema integrado com Stripe */}
      <Card className="border-info bg-info/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-info mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-info mb-1">Sistema integrado com Stripe</p>
              <p className="text-muted-foreground">
                Seu saldo é atualizado automaticamente quando os pagamentos são confirmados pela Stripe. 
                Apenas valores efetivamente liberados aparecem como disponíveis para saque.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botões de ação */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Gerenciar Saques</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchBalance}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar Saldo
          </Button>
          <Button 
            onClick={() => setShowPayoutModal(true)}
            disabled={availableBalance < 10}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Saque PIX
          </Button>
        </div>
      </div>

      {/* Histórico de Transações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Transações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhuma transação ainda.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete serviços para receber pagamentos.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(transaction.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {transaction.transaction_type === 'CREDIT' ? '+' : '-'}R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        {getStatusBadge(transaction.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getTransactionTypeLabel(transaction.transaction_type)}
                      </p>
                      
                      {/* Mostrar chave PIX para saques */}
                      {transaction.transaction_type === 'PAYOUT' && transaction.metadata?.pix_key && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            PIX: {showPixKeys[transaction.id] ? transaction.metadata.pix_key : maskPixKey(transaction.metadata.pix_key)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePixVisibility(transaction.id)}
                            className="h-5 w-5 p-0"
                          >
                            {showPixKeys[transaction.id] ? 
                              <EyeOff className="h-3 w-3" /> : 
                              <Eye className="h-3 w-3" />
                            }
                          </Button>
                        </div>
                      )}
                      
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </p>
                      
                      {transaction.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {transaction.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      Saldo: R$ {transaction.balance_after.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Saque */}
      <Dialog open={showPayoutModal} onOpenChange={setShowPayoutModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Saque PIX</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-info/10 border border-info/20 rounded-lg">
              <p className="text-sm text-info">
                <CheckCircle className="h-4 w-4 inline mr-2" />
                Saques são processados em até 2 dias úteis após a confirmação.
              </p>
            </div>
            
            <div>
              <Label htmlFor="pixKey">Chave PIX</Label>
              <Input
                id="pixKey"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Digite sua chave PIX (CPF, e-mail, telefone ou chave aleatória)"
              />
            </div>
            
            <div>
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                placeholder="Mínimo R$ 10,00"
                min="10"
                max={availableBalance}
                step="0.01"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Disponível: R$ {availableBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowPayoutModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleWithdrawalRequest} disabled={submitting}>
                {submitting ? 'Processando...' : 'Solicitar Saque'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
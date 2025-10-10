import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, DollarSign, Banknote, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DriverPayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  driverId: string;
}

export function DriverPayoutModal({ isOpen, onClose, availableBalance, driverId }: DriverPayoutModalProps) {
  const [pixKey, setPixKey] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const requestedAmount = parseFloat(amount) || 0;
  const minAmount = 50; // Valor mínimo para saque

  const handlePixKeyChange = (value: string) => {
    // Remove caracteres especiais para CPF/CNPJ
    const cleanValue = value.replace(/[^\d]/g, '');
    
    if (cleanValue.length <= 11) {
      // CPF: 000.000.000-00
      setPixKey(cleanValue.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'));
    } else if (cleanValue.length <= 14) {
      // CNPJ: 00.000.000/0000-00
      setPixKey(cleanValue.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'));
    } else {
      setPixKey(value); // Para e-mail, telefone ou chave aleatória
    }
  };

  const validatePixKey = (key: string) => {
    const cleanKey = key.replace(/[^\d]/g, '');
    
    // CPF (11 dígitos)
    if (cleanKey.length === 11) return true;
    
    // CNPJ (14 dígitos) 
    if (cleanKey.length === 14) return true;
    
    // E-mail
    if (key.includes('@') && key.includes('.')) return true;
    
    // Telefone (+55...)
    if (key.startsWith('+55') && key.length >= 14) return true;
    
    // Chave aleatória (UUID format)
    if (key.length === 36 && key.includes('-')) return true;
    
    return false;
  };

  const handleRequestPayout = async () => {
    const missingFields: string[] = [];
    
    if (!pixKey?.trim()) {
      missingFields.push('Chave PIX');
    }
    
    const numAmount = Number(amount);
    if (!amount || numAmount <= 0) {
      missingFields.push('Valor (deve ser maior que zero)');
    }

    if (missingFields.length > 0) {
      const fieldList = missingFields.join(', ');
      const message = missingFields.length === 1 
        ? `Por favor, preencha o campo: ${fieldList}`
        : `Por favor, preencha os campos: ${fieldList}`;
      toast.error(message);
      return;
    }

    if (!validatePixKey(pixKey)) {
      toast.error('Chave PIX inválida. Verifique o formato da chave.');
      return;
    }

    if (requestedAmount < minAmount) {
      toast.error(`Valor mínimo para saque é R$ ${minAmount}`);
      return;
    }

    if (requestedAmount > availableBalance) {
      toast.error('Saldo insuficiente para este saque');
      return;
    }

    setIsLoading(true);

    try {
      // Usar edge function para criar solicitação de saque
      const { data, error } = await supabase.functions.invoke('request-driver-payout', {
        body: {
          driver_id: driverId,
          amount: requestedAmount,
          pix_key: pixKey
        }
      });

      if (error) throw error;

      toast.success('Solicitação de saque enviada com sucesso!');
      onClose();
      setPixKey('');
      setAmount('');
    } catch (error) {
      console.error('Erro ao solicitar saque:', error);
      toast.error('Erro ao processar solicitação de saque');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            Solicitar Saque via PIX
          </DialogTitle>
          <DialogDescription className="sr-only">
            Solicite o saque dos seus ganhos acumulados via PIX
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1 space-y-5">
          {/* Saldo Disponível */}
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800 dark:text-green-200">Saldo Disponível</span>
                </div>
                <span className="text-2xl font-bold text-green-700 dark:text-green-300">
                  R$ {availableBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Informações sobre PIX */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="space-y-2">
                <h4 className="font-medium text-blue-800 dark:text-blue-200">Saque via PIX</h4>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• Processamento em até 2 horas úteis</li>
                  <li>• Valor mínimo: R$ {minAmount}</li>
                  <li>• Sem taxa adicional</li>
                  <li>• Disponível 24h por dia</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Formulário */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="pixKey">Chave PIX</Label>
              <Input
                id="pixKey"
                value={pixKey}
                onChange={(e) => handlePixKeyChange(e.target.value)}
                placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória"
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Informe sua chave PIX cadastrada no seu banco
              </p>
            </div>

            <div>
              <Label htmlFor="amount">Valor do Saque</Label>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  min={minAmount}
                  max={availableBalance}
                  step="0.01"
                  className="pl-10"
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Mínimo: R$ {minAmount}</span>
                <span>Máximo: R$ {availableBalance.toLocaleString('pt-BR')}</span>
              </div>
            </div>

            {/* Validações */}
            {requestedAmount > 0 && (
              <div className="space-y-2">
                {requestedAmount < minAmount && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">Valor abaixo do mínimo permitido</span>
                  </div>
                )}
                
                {requestedAmount > availableBalance && (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">Valor acima do saldo disponível</span>
                  </div>
                )}

                {requestedAmount >= minAmount && requestedAmount <= availableBalance && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">Valor válido para saque</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resumo */}
          {requestedAmount > 0 && requestedAmount >= minAmount && requestedAmount <= availableBalance && (
            <Card className="bg-muted/50 border-dashed">
              <CardContent className="p-4">
                <h4 className="font-medium mb-2">Resumo do Saque</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Valor solicitado:</span>
                    <span className="font-medium">R$ {requestedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxas:</span>
                    <span className="font-medium text-green-600">R$ 0,00</span>
                  </div>
                  <div className="border-t pt-1 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Valor a receber:</span>
                      <span>R$ {requestedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="flex-shrink-0 flex gap-4 pt-4 border-t border-slate-200 bg-white dark:bg-card">
          <Button variant="outline" onClick={onClose} className="flex-1 h-12">
            Cancelar
          </Button>
          <Button 
            onClick={handleRequestPayout}
            disabled={
              isLoading || 
              !pixKey || 
              !amount || 
              requestedAmount < minAmount || 
              requestedAmount > availableBalance ||
              !validatePixKey(pixKey)
            }
            className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400"
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Solicitar Saque
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
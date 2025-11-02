import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check, MessageCircle, Truck, MapPin, Package, DollarSign, Calendar, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatWeight } from '@/lib/freight-calculations';

interface CompanyFreightAcceptModalProps {
  isOpen: boolean;
  onClose: () => void;
  freight: any;
  driverId: string;
  driverName: string;
  companyOwnerId: string;
  companyId: string;
}

export const CompanyFreightAcceptModal: React.FC<CompanyFreightAcceptModalProps> = ({
  isOpen,
  onClose,
  freight,
  driverId,
  driverName,
  companyOwnerId,
  companyId
}) => {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'accept' | 'counter'>('accept');
  const [counterPrice, setCounterPrice] = useState(freight?.price || 0);
  const [justification, setJustification] = useState('');

  const handleAccept = async () => {
    setLoading(true);
    try {
      // Verificar se o frete ainda está disponível
      const { data: currentFreight } = await supabase
        .from('freights')
        .select('status, accepted_trucks')
        .eq('id', freight.id)
        .single();

      if (currentFreight?.status !== 'OPEN') {
        toast.error('Este frete não está mais disponível');
        onClose();
        return;
      }

      // 1. Criar/Atualizar freight_assignment
      const { error: assignmentError } = await supabase
        .from('freight_assignments')
        .upsert({
          freight_id: freight.id,
          driver_id: driverId,
          company_id: companyId,
          status: 'ACCEPTED',
          accepted_at: new Date().toISOString(),
          agreed_price: freight.price,
          pricing_type: 'FIXED',
          minimum_antt_price: freight.minimum_antt_price || null
        }, {
          onConflict: 'freight_id,driver_id'
        });

      if (assignmentError) throw assignmentError;

      // 2. Criar proposta em nome do motorista
      const { error: proposalError } = await supabase
        .from('freight_proposals')
        .insert({
          freight_id: freight.id,
          driver_id: driverId,
          proposed_price: freight.price,
          status: 'ACCEPTED',
          notes: `Aceito pela transportadora em nome do motorista ${driverName}`
        });

      if (proposalError) throw proposalError;

      // 3. Atualizar frete com company_id e driver_id
      const { error: freightError } = await supabase
        .from('freights')
        .update({
          status: 'ACCEPTED',
          driver_id: driverId,
          company_id: companyId,
          accepted_trucks: (currentFreight.accepted_trucks || 0) + 1
        })
        .eq('id', freight.id);

      if (freightError) throw freightError;

      // 4. Criar chat automaticamente
      await supabase.from('company_driver_chats').insert({
        company_id: companyId,
        driver_profile_id: driverId,
        sender_type: 'COMPANY',
        message: `🚚 Frete aceito! Olá ${driverName}, este chat foi criado automaticamente para acompanharmos a entrega de: ${freight.cargo_type}. Qualquer dúvida estou à disposição.`,
        created_at: new Date().toISOString()
      });

      // 5. Notificar motorista
      await supabase.from('notifications').insert({
        user_id: driverId,
        title: 'Frete Aceito!',
        message: `A transportadora aceitou o frete para ${freight.destination_city || freight.destination_address}`,
        type: 'freight_accepted',
        data: {
          freight_id: freight.id
        }
      });

      toast.success('✅ Frete em andamento! Visualize na aba "Em Andamento"', {
        duration: 5000
      });
      
      // 6. Disparar evento para trocar para aba "active"
      window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: 'active' }));
      
      onClose();
    } catch (error: any) {
      console.error('Erro ao aceitar frete:', error);
      toast.error('Erro ao aceitar frete');
    } finally {
      setLoading(false);
    }
  };

  const handleCounterPropose = async () => {
    if (!justification.trim()) {
      toast.error('Digite uma justificativa para a contraproposta');
      return;
    }

    if (counterPrice <= 0) {
      toast.error('Digite um valor válido');
      return;
    }

    setLoading(true);
    try {
      // Enviar mensagem de contraproposta no chat
      const { error } = await supabase
        .from('freight_messages')
        .insert({
          freight_id: freight.id,
          sender_id: companyOwnerId,
          message: `💰 **Contraproposta da Transportadora**\n\n**Valor Original:** R$ ${freight.price.toFixed(2)}\n**Novo Valor:** R$ ${counterPrice.toFixed(2)}\n\n**Justificativa:** ${justification}`,
          message_type: 'COUNTER_PROPOSAL',
          metadata: {
            original_price: freight.price,
            counter_price: counterPrice,
            proposed_by_company: true,
            driver_id: driverId
          }
        });

      if (error) throw error;

      // Notificar motorista
      await supabase.from('notifications').insert({
        user_id: driverId,
        title: 'Contraproposta Recebida',
        message: `A transportadora enviou uma contraproposta de R$ ${counterPrice.toFixed(2)} para o frete`,
        type: 'counter_proposal',
        data: {
          freight_id: freight.id,
          counter_price: counterPrice
        }
      });

      toast.success('Contraproposta enviada!');
      onClose();
    } catch (error: any) {
      console.error('Erro ao enviar contraproposta:', error);
      toast.error('Erro ao enviar contraproposta');
    } finally {
      setLoading(false);
    }
  };

  if (!freight) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Frete Compartilhado por {driverName}
          </DialogTitle>
          <DialogDescription>
            Analise o frete e decida se deseja aceitar ou fazer uma contraproposta
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status do Frete */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {freight.status === 'OPEN' ? (
                <span className="text-green-600 font-medium">✓ Frete disponível para aceitação</span>
              ) : (
                <span className="text-red-600 font-medium">✗ Frete não está mais disponível</span>
              )}
            </AlertDescription>
          </Alert>

          {/* Informações do Frete */}
          <div className="grid gap-4">
            <div className="flex items-start gap-3">
              <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Tipo de Carga</p>
                <p className="text-sm text-muted-foreground">{freight.cargo_type}</p>
                <p className="text-xs text-muted-foreground mt-1">Peso: {formatWeight(freight.weight)}</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Origem</p>
                <p className="text-sm text-muted-foreground">
                  {freight.origin_city && freight.origin_state 
                    ? `${freight.origin_city} - ${freight.origin_state}`
                    : freight.origin_address
                  }
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Destino</p>
                <p className="text-sm text-muted-foreground">
                  {freight.destination_city && freight.destination_state 
                    ? `${freight.destination_city} - ${freight.destination_state}`
                    : freight.destination_address
                  }
                </p>
                {freight.distance_km && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Distância: {freight.distance_km} km
                  </p>
                )}
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium">Valor do Frete</p>
                <p className="text-2xl font-bold text-primary">
                  R$ {freight.price?.toFixed(2)}
                </p>
              </div>
            </div>

            {freight.pickup_date && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Data de Coleta</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(freight.pickup_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Seletor de Modo */}
          <div className="flex gap-2 pt-4">
            <Button
              variant={mode === 'accept' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setMode('accept')}
            >
              <Check className="mr-2 h-4 w-4" />
              Aceitar Frete
            </Button>
            <Button
              variant={mode === 'counter' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setMode('counter')}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Contra-propor
            </Button>
          </div>

          {/* Formulário de Contraproposta */}
          {mode === 'counter' && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="counter-price">Novo Valor (R$)</Label>
                <Input
                  id="counter-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(parseFloat(e.target.value) || 0)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="justification">Justificativa</Label>
                <Textarea
                  id="justification"
                  placeholder="Explique o motivo da contraproposta..."
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  disabled={loading}
                  rows={4}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          {mode === 'accept' ? (
            <Button 
              onClick={handleAccept} 
              disabled={loading || freight.status !== 'OPEN'}
            >
              {loading ? 'Aceitando...' : 'Aceitar pelo Motorista'}
            </Button>
          ) : (
            <Button onClick={handleCounterPropose} disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar Contraproposta'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

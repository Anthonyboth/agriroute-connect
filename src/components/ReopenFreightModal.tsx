import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, RefreshCw, AlertTriangle, RotateCcw, Copy } from 'lucide-react';
import { format, startOfToday, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ReopenFreightModalProps {
  isOpen: boolean;
  onClose: () => void;
  freight: any;
  onSuccess: () => void;
}

export const ReopenFreightModal: React.FC<ReopenFreightModalProps> = ({
  isOpen,
  onClose,
  freight,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  // ✅ Modo de reabertura: 'reactivate' (reativar mesmo frete) ou 'duplicate' (criar cópia)
  const [reopenMode, setReopenMode] = useState<'reactivate' | 'duplicate'>('reactivate');
  const [formData, setFormData] = useState({
    pickup_date: addDays(startOfToday(), 1),
    delivery_date: addDays(startOfToday(), 3),
    price: '',
    description: ''
  });

  // Verificar se o frete pode ser reativado (apenas CANCELLED)
  const canReactivate = freight?.status === 'CANCELLED';

  // Inicializar com dados do frete original
  useEffect(() => {
    if (freight && isOpen) {
      const today = startOfToday();
      const originalPickup = freight.pickup_date ? new Date(freight.pickup_date) : null;
      const originalDelivery = freight.delivery_date ? new Date(freight.delivery_date) : null;
      
      // Se data original for no passado, usar amanhã como default
      const newPickup = originalPickup && originalPickup >= today 
        ? originalPickup 
        : addDays(today, 1);
      
      const newDelivery = originalDelivery && originalDelivery > newPickup
        ? originalDelivery
        : addDays(newPickup, 2);
      
      setFormData({
        pickup_date: newPickup,
        delivery_date: newDelivery,
        price: freight.price?.toString() || '',
        description: freight.description || ''
      });
    }
  }, [freight, isOpen]);

  const handleClose = () => {
    setFormData({
      pickup_date: addDays(startOfToday(), 1),
      delivery_date: addDays(startOfToday(), 3),
      price: '',
      description: ''
    });
    setReopenMode(canReactivate ? 'reactivate' : 'duplicate');
    onClose();
  };

  // ✅ Handler para REATIVAR o mesmo frete (via Edge Function)
  const handleReactivate = async () => {
    if (!freight?.id) {
      toast.error('Erro: frete não encontrado');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('producer-reopen-freight', {
        body: { freight_id: freight.id },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || data?.message || 'Erro ao reabrir frete');

      toast.success('Frete reaberto com sucesso! Agora está disponível para novos motoristas.');
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Erro ao reativar frete:', error);
      toast.error(error.message || 'Erro ao reabrir frete');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handler para DUPLICAR frete (criar novo baseado no antigo)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!freight?.id) {
      toast.error('Erro: frete não encontrado');
      return;
    }

    // Validações
    const today = startOfToday();
    if (formData.pickup_date < today) {
      toast.error('A data de coleta não pode ser no passado');
      return;
    }

    if (formData.delivery_date <= formData.pickup_date) {
      toast.error('A data de entrega deve ser posterior à data de coleta');
      return;
    }

    setLoading(true);

    try {
      // Chamar RPC para reabrir frete com novas datas
      // Usar type assertion porque a RPC pode não existir ainda
      const { data, error } = await (supabase.rpc as any)('reopen_freight_v2', { 
        p_freight_id: freight.id,
        p_pickup_date: formData.pickup_date.toISOString().split('T')[0],
        p_delivery_date: formData.delivery_date.toISOString().split('T')[0],
        p_updates: JSON.stringify({
          price: formData.price ? Number(formData.price) : freight.price,
          description: formData.description || freight.description
        })
      });
      
      if (error) throw error;
      
      toast.success('Frete reaberto com sucesso! O frete está disponível para motoristas.');
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Erro ao reabrir frete:', error);
      
      // Fallback: tentar RPC antiga
      if (error.message?.includes('reopen_freight_v2') || error.code === '42883') {
        try {
          // RPC v2 não existe ainda, usar insert direto
          const { data: newFreight, error: insertError } = await supabase
            .from('freights')
            .insert({
              producer_id: freight.producer_id,
              cargo_type: freight.cargo_type,
              weight: freight.weight,
              origin_address: freight.origin_address,
              origin_city: freight.origin_city,
              origin_state: freight.origin_state,
              origin_lat: freight.origin_lat,
              origin_lng: freight.origin_lng,
              destination_address: freight.destination_address,
              destination_city: freight.destination_city,
              destination_state: freight.destination_state,
              destination_lat: freight.destination_lat,
              destination_lng: freight.destination_lng,
              distance_km: freight.distance_km,
              price: formData.price ? Number(formData.price) : freight.price,
              pickup_date: formData.pickup_date.toISOString().split('T')[0],
              delivery_date: formData.delivery_date.toISOString().split('T')[0],
              description: formData.description || freight.description,
              urgency: freight.urgency,
              required_trucks: freight.required_trucks || 1,
              accepted_trucks: 0,
              status: 'OPEN',
              vehicle_type_required: freight.vehicle_type_required,
              vehicle_axles_required: freight.vehicle_axles_required,
              minimum_antt_price: freight.minimum_antt_price,
              service_type: freight.service_type,
              metadata: {
                reopened_from: freight.id,
                reopened_at: new Date().toISOString()
              }
            })
            .select()
            .single();

          if (insertError) throw insertError;

          toast.success('Frete reaberto com sucesso!');
          onSuccess();
          handleClose();
        } catch (fallbackError: any) {
          console.error('Erro no fallback:', fallbackError);
          toast.error(fallbackError.message || 'Erro ao reabrir frete');
        }
      } else {
        toast.error(error.message || 'Erro ao reabrir frete');
      }
    } finally {
      setLoading(false);
    }
  };

  const today = startOfToday();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Reabrir Frete
          </DialogTitle>
          <DialogDescription>
            Escolha como deseja reabrir o frete
          </DialogDescription>
        </DialogHeader>

        {/* ✅ Seleção de modo (apenas se o frete pode ser reativado) */}
        {canReactivate && (
          <div className="space-y-3 py-2">
            <Label className="text-sm font-medium">Como deseja reabrir?</Label>
            <RadioGroup
              value={reopenMode}
              onValueChange={(value) => setReopenMode(value as 'reactivate' | 'duplicate')}
              className="space-y-2"
            >
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="reactivate" id="reactivate" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="reactivate" className="font-medium cursor-pointer flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-green-600" />
                    Reativar mesmo frete
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    O frete volta a ficar disponível com os mesmos dados. Ideal se foi cancelado por engano.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="duplicate" id="duplicate" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="duplicate" className="font-medium cursor-pointer flex items-center gap-2">
                    <Copy className="h-4 w-4 text-blue-600" />
                    Criar cópia com novas datas
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cria um novo frete baseado no original. O antigo permanece no histórico.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* ✅ Modo REATIVAR: botão simples */}
        {reopenMode === 'reactivate' && canReactivate && (
          <div className="space-y-4 pt-2">
            <Alert variant="default" className="bg-green-50 border-green-200">
              <RotateCcw className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 text-sm">
                O frete será reativado com status <strong>ABERTO</strong> e ficará disponível para motoristas imediatamente.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                Cancelar
              </Button>
              <Button 
                onClick={handleReactivate} 
                disabled={loading} 
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Reativando...
                  </>
                ) : (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reativar Frete
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ✅ Modo DUPLICAR: formulário com datas */}
        {(reopenMode === 'duplicate' || !canReactivate) && (
          <>
            <Alert variant="default" className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                Um novo frete será criado com base no original. O frete anterior permanecerá no histórico.
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Coleta *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(formData.pickup_date, "dd/MM/yyyy", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.pickup_date}
                        onSelect={(date) => date && setFormData(prev => ({ 
                          ...prev, 
                          pickup_date: date,
                          delivery_date: prev.delivery_date <= date ? addDays(date, 2) : prev.delivery_date
                        }))}
                        disabled={(date) => date < today}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Data de Entrega *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(formData.delivery_date, "dd/MM/yyyy", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.delivery_date}
                        onSelect={(date) => date && setFormData(prev => ({ ...prev, delivery_date: date }))}
                        disabled={(date) => date <= formData.pickup_date}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Valor (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder={freight?.price?.toString() || '0.00'}
                />
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para manter o valor original
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Observações</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Informações adicionais sobre o frete..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Criar Cópia
                    </>
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
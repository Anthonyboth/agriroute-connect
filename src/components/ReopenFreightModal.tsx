import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, RefreshCw, AlertTriangle } from 'lucide-react';
import { format, startOfToday, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const [formData, setFormData] = useState({
    pickup_date: addDays(startOfToday(), 1),
    delivery_date: addDays(startOfToday(), 3),
    price: '',
    description: ''
  });

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
    onClose();
  };

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Reabrir Frete
          </DialogTitle>
          <DialogDescription>
            Atualize as datas e informações para republicar o frete
          </DialogDescription>
        </DialogHeader>

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
                      // Ajustar delivery se necessário
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
                  Reabrindo...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reabrir Frete
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

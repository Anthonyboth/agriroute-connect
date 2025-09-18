import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CARGO_TYPES } from '@/lib/cargo-types';

interface EditFreightModalProps {
  isOpen: boolean;
  onClose: () => void;
  freight: any;
  onSuccess: () => void;
}

export const EditFreightModal: React.FC<EditFreightModalProps> = ({
  isOpen,
  onClose,
  freight,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    cargo_type: freight?.cargo_type || '',
    weight: freight?.weight ? (freight.weight / 1000).toString() : '', // Convert kg from DB to tonnes for display
    origin_address: freight?.origin_address || '',
    destination_address: freight?.destination_address || '',
    pickup_date: freight?.pickup_date ? new Date(freight.pickup_date) : new Date(),
    delivery_date: freight?.delivery_date ? new Date(freight.delivery_date) : new Date(),
    price: freight?.price || '',
    description: freight?.description || '',
    urgency: freight?.urgency || 'MEDIUM',
    required_trucks: freight?.required_trucks || 1
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('freights')
        .update({
          cargo_type: formData.cargo_type,
          weight: Number(formData.weight) * 1000, // Convert tonnes to kg for database
          origin_address: formData.origin_address,
          destination_address: formData.destination_address,
          pickup_date: formData.pickup_date.toISOString().split('T')[0],
          delivery_date: formData.delivery_date.toISOString().split('T')[0],
          price: Number(formData.price),
          description: formData.description,
          urgency: formData.urgency,
          required_trucks: Number(formData.required_trucks),
          updated_at: new Date().toISOString()
        })
        .eq('id', freight.id);

      if (error) throw error;

      toast.success('Frete atualizado com sucesso!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating freight:', error);
      toast.error('Erro ao atualizar frete');
    } finally {
      setLoading(false);
    }
  };

  const cargoTypes = CARGO_TYPES;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Frete</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cargo_type">Tipo de Carga</Label>
              <Select
                value={formData.cargo_type}
                onValueChange={(value) => setFormData({ ...formData, cargo_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de carga" />
                </SelectTrigger>
                <SelectContent>
                  {cargoTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="weight">Peso (Toneladas)</Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                placeholder="1.5"
                required
              />
              <p className="text-xs text-muted-foreground">
                Peso em toneladas (ex: 1.5 para 1.5t)
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="origin_address">Endereço de Origem</Label>
            <Input
              id="origin_address"
              value={formData.origin_address}
              onChange={(e) => setFormData({ ...formData, origin_address: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="destination_address">Endereço de Destino</Label>
            <Input
              id="destination_address"
              value={formData.destination_address}
              onChange={(e) => setFormData({ ...formData, destination_address: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data de Coleta</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.pickup_date, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.pickup_date}
                    onSelect={(date) => date && setFormData({ ...formData, pickup_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Data de Entrega</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.delivery_date, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.delivery_date}
                    onSelect={(date) => date && setFormData({ ...formData, delivery_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">Valor (R$)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="urgency">Urgência</Label>
              <Select
                value={formData.urgency}
                onValueChange={(value) => setFormData({ ...formData, urgency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baixa</SelectItem>
                  <SelectItem value="MEDIUM">Normal</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="required_trucks">Número de Carretas</Label>
            <Input
              id="required_trucks"
              type="number"
              min="1"
              value={formData.required_trucks}
              onChange={(e) => setFormData({ ...formData, required_trucks: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Observações</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
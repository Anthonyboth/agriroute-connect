import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useDriverExpenses, ExpenseInput } from '@/hooks/useDriverExpenses';
import { Fuel, Wrench, Car, CircleDollarSign, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

interface DriverExpenseManagerProps {
  driverId: string;
}

const EXPENSE_TYPES = [
  { value: 'FUEL', label: 'Abastecimento', icon: Fuel, color: 'text-amber-500' },
  { value: 'MAINTENANCE', label: 'Manutenção', icon: Wrench, color: 'text-blue-500' },
  { value: 'TOLL', label: 'Pedágio', icon: Car, color: 'text-green-500' },
  { value: 'TIRE', label: 'Pneu', icon: Car, color: 'text-purple-500' },
  { value: 'OTHER', label: 'Outro', icon: CircleDollarSign, color: 'text-gray-500' },
] as const;

export const DriverExpenseManager: React.FC<DriverExpenseManagerProps> = ({ driverId }) => {
  const { addExpense } = useDriverExpenses(driverId);
  
  // Buscar veículos diretamente
  const { data: vehicles } = useQuery({
    queryKey: ['driver-vehicles-for-expense', driverId],
    queryFn: async () => {
      if (!driverId) return [];
      const { data } = await supabase
        .from('vehicles')
        .select('id, license_plate, vehicle_type')
        .eq('driver_id', driverId);
      return (data || []).map(v => ({
        id: v.id,
        plate: v.license_plate || 'Sem placa',
        model: v.vehicle_type || 'Veículo',
      }));
    },
    enabled: !!driverId,
  });
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<ExpenseInput>({
    expense_type: 'FUEL',
    amount: 0,
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    liters: undefined,
    price_per_liter: undefined,
    km_reading: undefined,
    vehicle_id: undefined,
  });

  const isFuel = formData.expense_type === 'FUEL';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.amount <= 0) {
      return;
    }

    await addExpense.mutateAsync(formData);
    
    // Reset form
    setFormData({
      expense_type: 'FUEL',
      amount: 0,
      expense_date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      liters: undefined,
      price_per_liter: undefined,
      km_reading: undefined,
      vehicle_id: undefined,
    });
    setIsFormOpen(false);
  };

  // Auto-calcular valor total quando litros e preço são preenchidos
  const handleFuelChange = (field: 'liters' | 'price_per_liter', value: number | undefined) => {
    const newData = { ...formData, [field]: value };
    
    if (newData.liters && newData.price_per_liter) {
      newData.amount = Number((newData.liters * newData.price_per_liter).toFixed(2));
    }
    
    setFormData(newData);
  };

  if (!isFormOpen) {
    return (
      <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
        <CardContent className="pt-6">
          <Button 
            variant="ghost" 
            className="w-full h-20 flex flex-col gap-2"
            onClick={() => setIsFormOpen(true)}
          >
            <Plus className="h-8 w-8 text-primary" />
            <span className="text-lg font-medium">Registrar Nova Despesa</span>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Nova Despesa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de Despesa */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {EXPENSE_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = formData.expense_type === type.value;
              return (
                <Button
                  key={type.value}
                  type="button"
                  variant={isSelected ? 'default' : 'outline'}
                  className={`flex flex-col gap-1 h-auto py-3 ${isSelected ? '' : type.color}`}
                  onClick={() => setFormData({ ...formData, expense_type: type.value as ExpenseInput['expense_type'] })}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{type.label}</span>
                </Button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Data */}
            <div className="space-y-2">
              <Label htmlFor="expense_date">Data *</Label>
              <Input
                id="expense_date"
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                required
              />
            </div>

            {/* Veículo */}
            {vehicles && vehicles.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="vehicle">Veículo</Label>
                <Select
                  value={formData.vehicle_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, vehicle_id: value || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.plate} - {v.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Campos específicos para combustível */}
          {isFuel && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="space-y-2">
                <Label htmlFor="liters">Litros Abastecidos</Label>
                <Input
                  id="liters"
                  type="number"
                  step="0.001"
                  placeholder="Ex: 45.500"
                  value={formData.liters || ''}
                  onChange={(e) => handleFuelChange('liters', e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_per_liter">Preço por Litro (R$)</Label>
                <Input
                  id="price_per_liter"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 6.49"
                  value={formData.price_per_liter || ''}
                  onChange={(e) => handleFuelChange('price_per_liter', e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="km_reading">Leitura do Odômetro (km)</Label>
                <Input
                  id="km_reading"
                  type="number"
                  step="0.1"
                  placeholder="Ex: 125430.5"
                  value={formData.km_reading || ''}
                  onChange={(e) => setFormData({ ...formData, km_reading: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            </div>
          )}

          {/* Valor Total */}
          <div className="space-y-2">
            <Label htmlFor="amount">Valor Total (R$) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Ex: 295.50"
              value={formData.amount || ''}
              onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
              required
              className="text-lg font-semibold"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Ex: Abastecimento completo no posto Shell"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          {/* Botões */}
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFormOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={addExpense.isPending || formData.amount <= 0}
            >
              {addExpense.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Despesa'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

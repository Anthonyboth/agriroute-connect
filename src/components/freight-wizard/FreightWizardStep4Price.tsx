import { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, DollarSign, Calendar } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface FreightWizardStep4PriceProps {
  formData: any;
  onInputChange: (field: string, value: any) => void;
  onNext: () => void;
  onBack: () => void;
  calculatedAnttPrice?: number | null;
  calculatedDistance?: number;
}

export function FreightWizardStep4Price({ 
  formData, 
  onInputChange, 
  onNext,
  onBack,
  calculatedAnttPrice,
  calculatedDistance
}: FreightWizardStep4PriceProps) {
  const hasPrice = formData.pricing_type === 'FIXED' 
    ? !!formData.price 
    : !!formData.price_per_km;

  // delivery_date é obrigatório no banco (NOT NULL)
  const canProceed = hasPrice && formData.pickup_date && formData.delivery_date;

  // ✅ UX: Auto-preencher data de entrega como pickup_date + 1 dia quando pickup é selecionado
  useEffect(() => {
    if (formData.pickup_date && !formData.delivery_date) {
      const pickup = new Date(formData.pickup_date + 'T00:00:00');
      pickup.setDate(pickup.getDate() + 1);
      const nextDay = pickup.toISOString().split('T')[0];
      onInputChange('delivery_date', nextDay);
    }
  }, [formData.pickup_date]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <DollarSign className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Preço e Datas</h3>
        <p className="text-sm text-muted-foreground">
          Defina o valor do frete e as datas de coleta
        </p>
      </div>

      {/* Info ANTT */}
      {calculatedAnttPrice && calculatedAnttPrice > 0 && (
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
          <AlertDescription className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Preço Mínimo ANTT:</span>
              <Badge variant="secondary" className="text-base font-bold">
                {formatCurrency(calculatedAnttPrice)}
              </Badge>
            </div>
            {calculatedDistance && calculatedDistance > 0 && (
              <p className="text-xs text-muted-foreground">
                Distância estimada: {calculatedDistance.toFixed(0)} km
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Tipo de Precificação */}
      <div className="space-y-2">
        <Label>Tipo de Precificação</Label>
        <Select
          value={formData.pricing_type}
          onValueChange={(value) => onInputChange('pricing_type', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PER_KM">Por Quilômetro (R$/km)</SelectItem>
            <SelectItem value="FIXED">Valor Fixo (R$)</SelectItem>
            <SelectItem value="PER_TON">Por Tonelada (R$/ton)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Campo de Preço */}
      <div className="space-y-2">
        <Label htmlFor="price">
          {formData.pricing_type === 'FIXED' 
            ? 'Valor Total *' 
            : formData.pricing_type === 'PER_KM'
            ? 'Valor por Km *'
            : 'Valor por Tonelada *'}
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            R$
          </span>
          <Input
            id="price"
            type="number"
            step="0.01"
            min="0"
            value={formData.pricing_type === 'FIXED' ? formData.price : formData.price_per_km}
            onChange={(e) => {
              const field = formData.pricing_type === 'FIXED' ? 'price' : 'price_per_km';
              onInputChange(field, e.target.value);
            }}
            className="pl-10"
            placeholder={formData.pricing_type === 'FIXED' ? 'Ex: 5000,00' : 'Ex: 3,50'}
          />
        </div>
      </div>

      {/* Quantidade de Veículos - Entrada livre */}
      <div className="space-y-2">
        <Label htmlFor="required_trucks">Quantidade de Veículos</Label>
        <Input
          id="required_trucks"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={formData.required_trucks}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, '');
            onInputChange('required_trucks', raw);
          }}
          onBlur={() => {
            const val = parseInt(formData.required_trucks, 10);
            if (!val || val < 1) {
              onInputChange('required_trucks', '1');
            }
          }}
          placeholder="Ex: 3"
        />
        <p className="text-xs text-muted-foreground">
          Informe quantos veículos são necessários para este frete
        </p>
      </div>

      {/* Datas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pickup_date" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Data de Coleta *
          </Label>
          <Input
            id="pickup_date"
            type="date"
            value={formData.pickup_date}
            onChange={(e) => onInputChange('pickup_date', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="delivery_date" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Previsão de Entrega *
          </Label>
          <Input
            id="delivery_date"
            type="date"
            value={formData.delivery_date}
            onChange={(e) => onInputChange('delivery_date', e.target.value)}
            min={formData.pickup_date || new Date().toISOString().split('T')[0]}
            required
          />
          {!formData.delivery_date && formData.pickup_date && (
            <p className="text-xs text-destructive">
              Data de entrega é obrigatória
            </p>
          )}
        </div>
      </div>

      {/* Urgência */}
      <div className="space-y-2">
        <Label>Urgência</Label>
        <Select
          value={formData.urgency}
          onValueChange={(value) => onInputChange('urgency', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LOW">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Baixa - Flexível
              </span>
            </SelectItem>
            <SelectItem value="MEDIUM">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                Média - Normal
              </span>
            </SelectItem>
            <SelectItem value="HIGH">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Alta - Urgente
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Revisar
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

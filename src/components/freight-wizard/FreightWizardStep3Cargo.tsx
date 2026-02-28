import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Package, Truck } from 'lucide-react';
import { WeightInput } from '@/components/WeightInput';
import { CARGO_CATEGORIES, getCargoTypesByCategory, cargoRequiresAxles, AXLE_OPTIONS, VEHICLE_TYPES_URBAN } from '@/lib/cargo-types';
import { Checkbox } from '@/components/ui/checkbox';

interface FreightWizardStep3CargoProps {
  formData: any;
  onInputChange: (field: string, value: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export function FreightWizardStep3Cargo({ 
  formData, 
  onInputChange, 
  onNext,
  onBack
}: FreightWizardStep3CargoProps) {
  const showAxlesSelector = formData.cargo_type && cargoRequiresAxles(formData.cargo_type);
  
  const canProceed = formData.cargo_type && formData.weight && 
    (!showAxlesSelector || formData.vehicle_axles_required);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <Package className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Detalhes da Carga</h3>
        <p className="text-sm text-muted-foreground">
          Informe o tipo e o peso total que deseja transportar
        </p>
      </div>

      {/* Tipo de Carga */}
      <div className="space-y-2">
        <Label htmlFor="cargo_type">Tipo de Carga *</Label>
        <Select
          value={formData.cargo_type}
          onValueChange={(value) => onInputChange('cargo_type', value)}
        >
          <SelectTrigger id="cargo_type">
            <SelectValue placeholder="Selecione o tipo de carga" />
          </SelectTrigger>
          <SelectContent>
            {CARGO_CATEGORIES.map((category) => (
              <SelectGroup key={category.value}>
                <SelectLabel>{category.label}</SelectLabel>
                {getCargoTypesByCategory(category.value).map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Peso Total */}
      <div className="space-y-2">
        <Label htmlFor="weight">Peso Total da Carga (toneladas) *</Label>
        <WeightInput
          value={formData.weight}
          onChange={(value, isValid) => onInputChange('weight', value)}
        />
      </div>


      {/* Seletor de Eixos (para cargas que exigem) */}
      {showAxlesSelector && (
        <div className="space-y-4 p-4 border rounded-lg bg-amber-50/50 dark:bg-amber-950/20">
          <Label className="text-base font-semibold">Configuração do Veículo</Label>
          
          <div className="space-y-2">
            <Label htmlFor="vehicle_axles">Número de Eixos *</Label>
            <Select
              value={formData.vehicle_axles_required}
              onValueChange={(value) => onInputChange('vehicle_axles_required', value)}
            >
              <SelectTrigger id="vehicle_axles">
                <SelectValue placeholder="Selecione o número de eixos" />
              </SelectTrigger>
              <SelectContent>
                {AXLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label} - {option.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="high_performance"
              checked={formData.high_performance}
              onCheckedChange={(checked) => onInputChange('high_performance', checked)}
            />
            <Label htmlFor="high_performance" className="text-sm">
              Veículo de alta performance (tabela C/D ANTT)
            </Label>
          </div>
        </div>
      )}

      {/* Tipo de Veículo (para fretes urbanos/pequenos) */}
      {!showAxlesSelector && (
        <div className="space-y-2">
          <Label htmlFor="vehicle_type">Tipo de Veículo (opcional)</Label>
          <Select
            value={formData.vehicle_type_required || '__any__'}
            onValueChange={(value) => onInputChange('vehicle_type_required', value === '__any__' ? '' : value)}
          >
            <SelectTrigger id="vehicle_type">
              <SelectValue placeholder="Qualquer veículo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Qualquer veículo</SelectItem>
              {VEHICLE_TYPES_URBAN.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Descrição */}
      <div className="space-y-2">
        <Label htmlFor="description">Observações (opcional)</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => onInputChange('description', e.target.value)}
          placeholder="Ex: Soja ensacada, precisa de lona. Carregar às 7h da manhã. Contato na fazenda: José (66) 99999-0000"
          rows={3}
        />
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Continuar
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

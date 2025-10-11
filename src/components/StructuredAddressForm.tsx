import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Address, BRAZILIAN_STATES, formatCEP, validateCEP } from '@/lib/address-utils';

interface StructuredAddressFormProps {
  value: Address;
  onChange: (address: Address) => void;
  disabled?: boolean;
}

export const StructuredAddressForm: React.FC<StructuredAddressFormProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const handleFieldChange = (field: keyof Address, fieldValue: string) => {
    onChange({
      ...value,
      [field]: fieldValue
    });
  };

  const handleCEPChange = (cep: string) => {
    const cleaned = cep.replace(/\D/g, '');
    if (cleaned.length <= 8) {
      const formatted = cleaned.length === 8 ? formatCEP(cleaned) : cleaned;
      handleFieldChange('zip', formatted);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="street">Rua/Avenida/BR/MT *</Label>
          <Input
            id="street"
            value={value.street || ''}
            onChange={(e) => handleFieldChange('street', e.target.value)}
            placeholder="Ex: Rua das Flores, BR-163, MT-010"
            disabled={disabled}
            required
          />
        </div>
        <div>
          <Label htmlFor="number">Número *</Label>
          <Input
            id="number"
            value={value.number || ''}
            onChange={(e) => handleFieldChange('number', e.target.value)}
            placeholder="Ex: 123, KM 45"
            disabled={disabled}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="complement">Complemento</Label>
        <Input
          id="complement"
          value={value.complement || ''}
          onChange={(e) => handleFieldChange('complement', e.target.value)}
          placeholder="Ex: Apto 101, Bloco B, Fazenda Santa Rita"
          disabled={disabled}
        />
      </div>

      <div>
        <Label htmlFor="neighborhood">Bairro/Fazenda *</Label>
        <Input
          id="neighborhood"
          value={value.neighborhood || ''}
          onChange={(e) => handleFieldChange('neighborhood', e.target.value)}
          placeholder="Ex: Centro, Fazenda Esperança"
          disabled={disabled}
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="city">Cidade *</Label>
          <Input
            id="city"
            value={value.city || ''}
            onChange={(e) => handleFieldChange('city', e.target.value)}
            placeholder="Ex: São Paulo"
            disabled={disabled}
            required
          />
        </div>
        <div>
          <Label htmlFor="state">Estado *</Label>
          <Select
            value={value.state || ''}
            onValueChange={(val) => handleFieldChange('state', val)}
            disabled={disabled}
          >
            <SelectTrigger id="state">
              <SelectValue placeholder="Selecione o estado" />
            </SelectTrigger>
            <SelectContent>
              {BRAZILIAN_STATES.map((state) => (
                <SelectItem key={state.value} value={state.value}>
                  {state.label} ({state.value})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="md:w-1/2">
        <Label htmlFor="zip">CEP</Label>
        <Input
          id="zip"
          value={value.zip || ''}
          onChange={(e) => handleCEPChange(e.target.value)}
          placeholder="00000-000"
          maxLength={9}
          disabled={disabled}
        />
        {value.zip && !validateCEP(value.zip) && (
          <p className="text-sm text-destructive mt-1">CEP inválido</p>
        )}
      </div>
    </div>
  );
};
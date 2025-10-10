import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface StructuredAddressInputProps {
  label: string;
  value?: string;
  onChange: (fullAddress: string) => void;
  required?: boolean;
  className?: string;
}

export const StructuredAddressInput: React.FC<StructuredAddressInputProps> = ({
  label,
  value = '',
  onChange,
  required = false,
  className
}) => {
  const [neighborhood, setNeighborhood] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');

  // Build full address string whenever parts change
  useEffect(() => {
    const parts = [street, number ? `Nº ${number}` : '', neighborhood, complement]
      .filter(Boolean)
      .join(', ');
    onChange(parts);
  }, [street, number, neighborhood, complement, onChange]);

  return (
    <div className={cn('space-y-3', className)}>
      <Label className="block text-sm font-medium">{label}{required && <span className="text-destructive ml-1">*</span>}</Label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-sm">Bairro / Fazenda</Label>
          <Input
            placeholder="Ex: Centro, Fazenda Santa Maria"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            required={required}
            className="h-11 text-base"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">Rua / BR / MT</Label>
          <Input
            placeholder="Ex: Av. Cuiabá, BR-163, MT-010"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            required={required}
            className="h-11 text-base"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">Número</Label>
          <Input
            placeholder="Ex: 1000 ou S/N"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            required={required}
            className="h-11 text-base"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">Complemento / Referência (opcional)</Label>
          <Input
            placeholder="Ex: Próximo ao posto, Galpão 2"
            value={complement}
            onChange={(e) => setComplement(e.target.value)}
            className="h-11 text-base"
          />
        </div>
      </div>
    </div>
  );
};

export default StructuredAddressInput;

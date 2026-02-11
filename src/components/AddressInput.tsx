import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, AlertCircle } from 'lucide-react';

interface AddressInputProps {
  address: string;
  onAddressChange: (address: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
}

export const AddressInput: React.FC<AddressInputProps> = ({
  address,
  onAddressChange,
  label = "Endereço Completo",
  required = false,
  placeholder = "Rua, número, bairro/fazenda/nome local, cidade, estado, CEP"
}) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="address" className="flex items-center gap-2">
        <MapPin className="h-4 w-4" />
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      
      <Input
        id="address"
        value={address}
        onChange={(e) => onAddressChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full"
      />
      
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Importante:</p>
              <p>Este endereço deve ser o mesmo do comprovante de endereço que você enviará. Preencha com todos os detalhes: rua, número, complemento, bairro/fazenda/nome local, cidade, estado e CEP.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddressInput;
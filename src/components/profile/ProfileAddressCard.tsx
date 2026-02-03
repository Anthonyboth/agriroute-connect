/**
 * ProfileAddressCard.tsx
 * 
 * Card de endereço estruturado com suporte a edição.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddressData {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
}

interface ProfileAddressCardProps {
  address: AddressData;
  isEditing: boolean;
  onChange: (field: keyof AddressData, value: string) => void;
  className?: string;
}

const formatAddress = (address: AddressData): string => {
  const parts = [];
  
  if (address.street) {
    let street = address.street;
    if (address.number) street += `, ${address.number}`;
    if (address.complement) street += ` - ${address.complement}`;
    parts.push(street);
  }
  
  if (address.neighborhood) parts.push(address.neighborhood);
  
  if (address.city || address.state) {
    const location = [address.city, address.state].filter(Boolean).join(' - ');
    parts.push(location);
  }
  
  if (address.zip) parts.push(`CEP: ${address.zip}`);
  
  return parts.join('\n') || 'Endereço não cadastrado';
};

export const ProfileAddressCard: React.FC<ProfileAddressCardProps> = ({
  address,
  isEditing,
  onChange,
  className
}) => {
  return (
    <Card className={cn("transition-all duration-200", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <MapPin className="h-4 w-4 text-primary" />
          Endereço
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* CEP */}
            <div className="space-y-1.5">
              <Label htmlFor="address-zip" className="text-sm text-muted-foreground">
                CEP
              </Label>
              <Input
                id="address-zip"
                value={address.zip}
                onChange={(e) => onChange('zip', e.target.value)}
                placeholder="00000-000"
                className="transition-all duration-200"
              />
            </div>

            {/* Rua */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address-street" className="text-sm text-muted-foreground">
                Rua/Logradouro
              </Label>
              <Input
                id="address-street"
                value={address.street}
                onChange={(e) => onChange('street', e.target.value)}
                placeholder="Nome da rua"
                className="transition-all duration-200"
              />
            </div>

            {/* Número */}
            <div className="space-y-1.5">
              <Label htmlFor="address-number" className="text-sm text-muted-foreground">
                Número
              </Label>
              <Input
                id="address-number"
                value={address.number}
                onChange={(e) => onChange('number', e.target.value)}
                placeholder="Nº"
                className="transition-all duration-200"
              />
            </div>

            {/* Complemento */}
            <div className="space-y-1.5">
              <Label htmlFor="address-complement" className="text-sm text-muted-foreground">
                Complemento
              </Label>
              <Input
                id="address-complement"
                value={address.complement}
                onChange={(e) => onChange('complement', e.target.value)}
                placeholder="Apto, sala, etc."
                className="transition-all duration-200"
              />
            </div>

            {/* Bairro */}
            <div className="space-y-1.5">
              <Label htmlFor="address-neighborhood" className="text-sm text-muted-foreground">
                Bairro
              </Label>
              <Input
                id="address-neighborhood"
                value={address.neighborhood}
                onChange={(e) => onChange('neighborhood', e.target.value)}
                placeholder="Bairro"
                className="transition-all duration-200"
              />
            </div>

            {/* Cidade */}
            <div className="space-y-1.5">
              <Label htmlFor="address-city" className="text-sm text-muted-foreground">
                Cidade
              </Label>
              <Input
                id="address-city"
                value={address.city}
                onChange={(e) => onChange('city', e.target.value)}
                placeholder="Cidade"
                className="transition-all duration-200"
              />
            </div>

            {/* Estado */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address-state" className="text-sm text-muted-foreground">
                Estado
              </Label>
              <Input
                id="address-state"
                value={address.state}
                onChange={(e) => onChange('state', e.target.value)}
                placeholder="UF"
                maxLength={2}
                className="transition-all duration-200 uppercase"
              />
            </div>
          </div>
        ) : (
          <div className="py-2 px-3 rounded-md bg-muted/30 min-h-[80px]">
            <p className={cn(
              "text-sm whitespace-pre-line",
              !address.street && "text-muted-foreground italic"
            )}>
              {formatAddress(address)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

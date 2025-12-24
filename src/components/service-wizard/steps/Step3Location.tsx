import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ServiceFormData, ServiceType, AddressData } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Home, Building } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CitySelector } from '@/components/CitySelector';

interface Step3Props {
  formData: ServiceFormData;
  onUpdate: (field: string, value: any) => void;
  serviceType: ServiceType;
  requiresDestination: boolean;
}

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

interface AddressFormProps {
  prefix: 'origin' | 'destination';
  title: string;
  icon: React.ReactNode;
  address: AddressData;
  onUpdate: (field: string, value: any) => void;
  showFloorElevator?: boolean;
}

const AddressForm: React.FC<AddressFormProps> = ({ 
  prefix, 
  title, 
  icon, 
  address, 
  onUpdate,
  showFloorElevator = false 
}) => {
  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-cep`} className="text-xs">CEP</Label>
            <Input
              id={`${prefix}-cep`}
              value={address.cep}
              onChange={(e) => onUpdate(`${prefix}.cep`, formatCEP(e.target.value))}
              placeholder="00000-000"
              maxLength={9}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-state`} className="text-xs">Estado *</Label>
            <Select 
              value={address.state} 
              onValueChange={(value) => onUpdate(`${prefix}.state`, value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                {BRAZILIAN_STATES.map((state) => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`${prefix}-city`} className="text-xs">Cidade *</Label>
          <CitySelector
            selectedCityId={address.city_id}
            onCityChange={(cityId, cityName, state, lat, lng) => {
              onUpdate(`${prefix}.city_id`, cityId);
              onUpdate(`${prefix}.city`, cityName);
              onUpdate(`${prefix}.state`, state);
              onUpdate(`${prefix}.lat`, lat);
              onUpdate(`${prefix}.lng`, lng);
            }}
            placeholder="Digite a cidade"
            defaultState={address.state}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`${prefix}-street`} className="text-xs">Rua/Avenida *</Label>
          <Input
            id={`${prefix}-street`}
            value={address.street}
            onChange={(e) => onUpdate(`${prefix}.street`, e.target.value)}
            placeholder="Nome da rua"
            className="h-9"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-number`} className="text-xs">Número *</Label>
            <Input
              id={`${prefix}-number`}
              value={address.number}
              onChange={(e) => onUpdate(`${prefix}.number`, e.target.value)}
              placeholder="Nº"
              className="h-9"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor={`${prefix}-neighborhood`} className="text-xs">Bairro *</Label>
            <Input
              id={`${prefix}-neighborhood`}
              value={address.neighborhood}
              onChange={(e) => onUpdate(`${prefix}.neighborhood`, e.target.value)}
              placeholder="Bairro"
              className="h-9"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`${prefix}-complement`} className="text-xs">Complemento</Label>
          <Input
            id={`${prefix}-complement`}
            value={address.complement}
            onChange={(e) => onUpdate(`${prefix}.complement`, e.target.value)}
            placeholder="Apto, bloco, etc."
            className="h-9"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`${prefix}-reference`} className="text-xs">Ponto de Referência</Label>
          <Input
            id={`${prefix}-reference`}
            value={address.reference || ''}
            onChange={(e) => onUpdate(`${prefix}.reference`, e.target.value)}
            placeholder="Próximo a..."
            className="h-9"
          />
        </div>

        {showFloorElevator && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div className="space-y-1">
              <Label htmlFor={`${prefix}-floor`} className="text-xs">Andar</Label>
              <Input
                id={`${prefix}-floor`}
                value={address.floor || ''}
                onChange={(e) => onUpdate(`${prefix}.floor`, e.target.value)}
                placeholder="Ex: 3º"
                className="h-9"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Checkbox
                id={`${prefix}-elevator`}
                checked={address.hasElevator || false}
                onCheckedChange={(checked) => onUpdate(`${prefix}.hasElevator`, checked)}
              />
              <Label htmlFor={`${prefix}-elevator`} className="text-xs">Tem elevador</Label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const Step3Location: React.FC<Step3Props> = ({ 
  formData, 
  onUpdate, 
  serviceType,
  requiresDestination 
}) => {
  const isMudanca = serviceType === 'MUDANCA_RESIDENCIAL' || serviceType === 'MUDANCA_COMERCIAL';
  const isAgricultural = serviceType === 'SERVICO_AGRICOLA';

  return (
    <div className="space-y-4">
      {isAgricultural && (
        <div className="space-y-2">
          <Label htmlFor="farm-name">Nome da Fazenda/Propriedade</Label>
          <Input
            id="farm-name"
            value={formData.agricultural?.farmName || ''}
            onChange={(e) => onUpdate('agricultural.farmName', e.target.value)}
            placeholder="Ex: Fazenda Santa Maria"
          />
        </div>
      )}

      <AddressForm
        prefix="origin"
        title={requiresDestination ? (isMudanca ? 'Endereço de Origem' : 'Endereço de Coleta') : 'Endereço do Atendimento'}
        icon={<Home className="h-4 w-4" />}
        address={formData.origin}
        onUpdate={onUpdate}
        showFloorElevator={isMudanca}
      />

      {requiresDestination && (
        <AddressForm
          prefix="destination"
          title={isMudanca ? 'Endereço de Destino' : 'Endereço de Entrega'}
          icon={<Building className="h-4 w-4" />}
          address={formData.destination!}
          onUpdate={onUpdate}
          showFloorElevator={isMudanca}
        />
      )}

      {isAgricultural && (
        <div className="space-y-2">
          <Label htmlFor="access-instructions">Instruções de Acesso</Label>
          <Input
            id="access-instructions"
            value={formData.agricultural?.accessInstructions || ''}
            onChange={(e) => onUpdate('agricultural.accessInstructions', e.target.value)}
            placeholder="Ex: Rodovia BR-101, KM 45, entrada à direita..."
          />
        </div>
      )}
    </div>
  );
};

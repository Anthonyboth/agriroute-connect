import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ServiceFormData, ServiceType, AddressData } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Home, Building, Copy } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { AddressLocationInput } from '@/components/AddressLocationInput';
import { LocationFillButton } from '@/components/LocationFillButton';

interface Step3Props {
  formData: ServiceFormData;
  onUpdate: (field: string, value: any) => void;
  serviceType: ServiceType;
  requiresDestination: boolean;
}


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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Cidade/CEP - campo unificado */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div /> {/* spacer */}
            <LocationFillButton
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onLocationFilled={(address, lat, lng, locationData) => {
                if (locationData?.city) {
                  onUpdate(`${prefix}.city`, locationData.city);
                }
                if (locationData?.state) {
                  onUpdate(`${prefix}.state`, locationData.state);
                }
                if (lat && lng) {
                  onUpdate(`${prefix}.lat`, lat);
                  onUpdate(`${prefix}.lng`, lng);
                }
                if (locationData?.street) {
                  onUpdate(`${prefix}.street`, locationData.street);
                }
                if (locationData?.neighborhood) {
                  onUpdate(`${prefix}.neighborhood`, locationData.neighborhood);
                }
                if (locationData?.cep) {
                  onUpdate(`${prefix}.cep`, locationData.cep);
                }
              }}
            />
          </div>
          <AddressLocationInput
            value={address.city ? { city: address.city, state: address.state, id: address.city_id, lat: address.lat, lng: address.lng } : undefined}
            onChange={(data) => {
              onUpdate(`${prefix}.city_id`, data.id);
              onUpdate(`${prefix}.city`, data.city);
              onUpdate(`${prefix}.state`, data.state);
              onUpdate(`${prefix}.lat`, data.lat);
              onUpdate(`${prefix}.lng`, data.lng);
              if (data.neighborhood) {
                onUpdate(`${prefix}.neighborhood`, data.neighborhood);
              }
              if (data.cep) {
                onUpdate(`${prefix}.cep`, data.cep);
              }
            }}
            placeholder="Digite CEP ou nome da cidade"
            label="Cidade / CEP *"
            className="[&_input]:h-9"
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
            <Label htmlFor={`${prefix}-neighborhood`} className="text-xs">Bairro / Fazenda / Nome Local *</Label>
            <Input
              id={`${prefix}-neighborhood`}
              value={address.neighborhood}
              onChange={(e) => onUpdate(`${prefix}.neighborhood`, e.target.value)}
              placeholder="Ex: Centro, Fazenda Santa Maria"
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
        <>
          {/* Botão para copiar endereço de origem */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full flex items-center gap-2 text-sm border-dashed border-primary/50 text-primary hover:bg-primary/5"
            onClick={() => {
              // Copia apenas cidade/estado da origem para o destino
              onUpdate('destination.city_id', formData.origin.city_id);
              onUpdate('destination.city', formData.origin.city);
              onUpdate('destination.state', formData.origin.state);
            }}
          >
            <Copy className="h-4 w-4" />
            Mesma cidade de {isMudanca ? 'origem' : 'coleta'}
          </Button>

          <AddressForm
            prefix="destination"
            title={isMudanca ? 'Endereço de Destino' : 'Endereço de Entrega'}
            icon={<Building className="h-4 w-4" />}
            address={formData.destination!}
            onUpdate={onUpdate}
            showFloorElevator={isMudanca}
          />
        </>
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

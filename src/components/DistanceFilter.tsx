import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Info } from 'lucide-react';

interface DistanceFilterProps {
  maxDistance: string;
  onDistanceChange: (distance: string) => void;
  currentLocation?: { lat: number; lng: number };
}

export const DistanceFilter: React.FC<DistanceFilterProps> = ({
  maxDistance,
  onDistanceChange,
  currentLocation
}) => {
  const distanceOptions = [
    { value: '', label: 'Qualquer distância' },
    { value: '50', label: 'Até 50 km' },
    { value: '100', label: 'Até 100 km' },
    { value: '200', label: 'Até 200 km' },
    { value: '500', label: 'Até 500 km' },
    { value: '1000', label: 'Até 1.000 km' },
    { value: '2000', label: 'Até 2.000 km' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5 text-primary" />
          Filtro por Distância
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="distance-filter">
            Mostrar fretes até quantos KM de distância
          </Label>
          <Select value={maxDistance} onValueChange={onDistanceChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a distância máxima" />
            </SelectTrigger>
            <SelectContent>
              {distanceOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!currentLocation && (
          <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <Info className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-orange-800">
              <p className="font-medium">Localização necessária</p>
              <p>Para usar este filtro, ative a localização no seu perfil.</p>
            </div>
          </div>
        )}

        {currentLocation && (
          <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-800">
              <p className="font-medium">Localização ativa</p>
              <p>Os fretes serão filtrados com base na sua localização atual.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DistanceFilter;
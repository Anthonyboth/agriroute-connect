import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { GPSOriginButton } from './GPSOriginButton';
import { UnifiedLocationInput, type LocationData } from '@/components/UnifiedLocationInput';
import { Button } from '@/components/ui/button';
import { ArrowRight, MapPin, AlertCircle, User, Phone, FileText, Route } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouteCorridors } from '@/hooks/useRouteCorridors';
interface FreightWizardStep1Props {
  formData: any;
  onInputChange: (field: string, value: any) => void;
  onNext: () => void;
  guestMode?: boolean;
}

const formatPhone = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

const formatDocument = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 11) {
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
  } else {
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
    if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
    if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`;
  }
};

export function FreightWizardStep1({ 
  formData, 
  onInputChange, 
  onNext,
  guestMode 
}: FreightWizardStep1Props) {
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [selectedCorridor, setSelectedCorridor] = useState<string>('');
  const { corridors, findById } = useRouteCorridors();
  // Validação básica: cidades obrigatórias + campos guest se aplicável
  const baseCanProceed = formData.origin_city && formData.origin_state && 
                     formData.destination_city && formData.destination_state;
  
  const guestFieldsOk = !guestMode || (
    formData.guest_name?.trim()?.length >= 3 &&
    formData.guest_phone?.replace(/\D/g, '')?.length >= 10 &&
    (() => {
      const digits = formData.guest_document?.replace(/\D/g, '') || '';
      return digits.length === 11 || digits.length === 14;
    })()
  );

  const canProceed = baseCanProceed && guestFieldsOk;

  const handleOriginChange = (value: string, locationData?: LocationData) => {
    if (locationData) {
      onInputChange('origin_city', locationData.city);
      onInputChange('origin_state', locationData.state);
      onInputChange('origin_city_id', locationData.cityId);
      onInputChange('origin_lat', locationData.lat);
      onInputChange('origin_lng', locationData.lng);
      if (locationData.neighborhood) {
        onInputChange('origin_neighborhood', locationData.neighborhood);
      }
    }
  };

  const handleDestinationChange = (value: string, locationData?: LocationData) => {
    if (locationData) {
      onInputChange('destination_city', locationData.city);
      onInputChange('destination_state', locationData.state);
      onInputChange('destination_city_id', locationData.cityId);
      onInputChange('destination_lat', locationData.lat);
      onInputChange('destination_lng', locationData.lng);
      if (locationData.neighborhood) {
        onInputChange('destination_neighborhood', locationData.neighborhood);
      }
    }
  };

  const handleGPSOriginFilled = (data: { city: string; state: string; lat: number; lng: number }) => {
    setGpsError(null);
    onInputChange('origin_city', data.city);
    onInputChange('origin_state', data.state);
    onInputChange('origin_lat', data.lat);
    onInputChange('origin_lng', data.lng);
  };

  const handleGPSError = (message: string) => {
    setGpsError(message);
  };

  const handleCorridorSelect = (corridorId: string) => {
    setSelectedCorridor(corridorId);
    const corridor = findById(corridorId);
    if (!corridor) return;
    
    // Auto-fill origin
    onInputChange('origin_city', corridor.origin.name);
    onInputChange('origin_state', corridor.origin.state);
    onInputChange('origin_city_id', corridor.origin.cityId);
    onInputChange('origin_lat', corridor.origin.lat);
    onInputChange('origin_lng', corridor.origin.lng);
    
    // Auto-fill destination
    onInputChange('destination_city', corridor.destination.name);
    onInputChange('destination_state', corridor.destination.state);
    onInputChange('destination_city_id', corridor.destination.cityId);
    onInputChange('destination_lat', corridor.destination.lat);
    onInputChange('destination_lng', corridor.destination.lng);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <MapPin className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Origem e Destino</h3>
        <p className="text-sm text-muted-foreground">
          Informe de onde sairá e para onde irá a carga
        </p>
      </div>

      {/* Corredor Rodoviário */}
      <div className="p-4 border rounded-lg bg-primary/5 border-primary/20">
        <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
          <Route className="h-4 w-4 text-primary" />
          Corredor Rodoviário
        </Label>
        <p className="text-xs text-muted-foreground mb-3">
          Selecione uma rota popular para preencher origem e destino automaticamente
        </p>
        <Select value={selectedCorridor} onValueChange={handleCorridorSelect}>
          <SelectTrigger className="h-10 text-sm bg-background">
            <SelectValue placeholder="Selecione uma rota" />
          </SelectTrigger>
          <SelectContent className="bg-popover max-h-[300px]" position="popper" sideOffset={4}>
            {corridors.map(corridor => (
              <SelectItem key={corridor.id} value={corridor.id} className="text-sm">
                {corridor.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* GPS Error Alert */}
      {gpsError && (
        <Alert variant="destructive" className="animate-in fade-in">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{gpsError}</AlertDescription>
        </Alert>
      )}

      {/* Origem */}
      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-3 flex-wrap">
          <Label className="text-base font-semibold flex items-center gap-2 flex-1">
            <span className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center">A</span>
            Origem
          </Label>
          <GPSOriginButton
            onLocationFilled={handleGPSOriginFilled}
            onError={handleGPSError}
          />
        </div>
        
        <UnifiedLocationInput
          label="Cidade de Origem"
          value={formData.origin_city && formData.origin_state 
            ? `${formData.origin_city}, ${formData.origin_state}` 
            : ''}
          onChange={handleOriginChange}
          required
        />
      </div>

      {/* Destino */}
      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-3 flex-wrap">
          <Label className="text-base font-semibold flex items-center gap-2 flex-1">
            <span className="w-6 h-6 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">B</span>
            Destino
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              if (formData.origin_city && formData.origin_state) {
                onInputChange('destination_city', formData.origin_city);
                onInputChange('destination_state', formData.origin_state);
                onInputChange('destination_city_id', formData.origin_city_id);
                onInputChange('destination_lat', formData.origin_lat);
                onInputChange('destination_lng', formData.origin_lng);
              }
            }}
          >
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Mesma cidade</span>
          </Button>
        </div>
        
        <UnifiedLocationInput
          label="Cidade de Destino"
          value={formData.destination_city && formData.destination_state 
            ? `${formData.destination_city}, ${formData.destination_state}` 
            : ''}
          onChange={handleDestinationChange}
          required
        />
      </div>

      {formData.origin_city && formData.destination_city && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
          <AlertDescription className="text-green-800 dark:text-green-200">
            ✓ Rota: <strong>{formData.origin_city}/{formData.origin_state}</strong> → <strong>{formData.destination_city}/{formData.destination_state}</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Guest Contact Fields ── */}
      {guestMode && (
        <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <Label className="text-base font-semibold flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            Seus Dados de Contato
          </Label>
          <p className="text-xs text-muted-foreground -mt-2">
            Como você não está cadastrado, precisamos dos seus dados para contato.
          </p>

          <div className="space-y-2">
            <Label htmlFor="guest_name" className="flex items-center gap-2 text-sm">
              <User className="h-3.5 w-3.5" />
              Nome Completo *
            </Label>
            <Input
              id="guest_name"
              value={formData.guest_name || ''}
              onChange={(e) => onInputChange('guest_name', e.target.value)}
              placeholder="Seu nome completo"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guest_phone" className="flex items-center gap-2 text-sm">
              <Phone className="h-3.5 w-3.5" />
              WhatsApp / Telefone *
            </Label>
            <Input
              id="guest_phone"
              value={formData.guest_phone || ''}
              onChange={(e) => onInputChange('guest_phone', formatPhone(e.target.value))}
              placeholder="(66) 99999-9999"
              maxLength={15}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guest_document" className="flex items-center gap-2 text-sm">
              <FileText className="h-3.5 w-3.5" />
              CPF ou CNPJ *
            </Label>
            <Input
              id="guest_document"
              value={formData.guest_document || ''}
              onChange={(e) => onInputChange('guest_document', formatDocument(e.target.value))}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              maxLength={18}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <Button 
          type="button" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onNext();
          }} 
          disabled={!canProceed} 
          size="lg"
        >
          Continuar
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

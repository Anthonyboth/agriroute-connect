import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { GPSOriginButton } from './GPSOriginButton';
import { UnifiedLocationInput, type LocationData } from '@/components/UnifiedLocationInput';
import { Button } from '@/components/ui/button';
import { ArrowRight, MapPin, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FreightWizardStep1Props {
  formData: any;
  onInputChange: (field: string, value: any) => void;
  onNext: () => void;
  guestMode?: boolean;
}

export function FreightWizardStep1({ 
  formData, 
  onInputChange, 
  onNext,
  guestMode 
}: FreightWizardStep1Props) {
  const [gpsError, setGpsError] = useState<string | null>(null);
  
  const canProceed = formData.origin_city && formData.origin_state && 
                     formData.destination_city && formData.destination_state;

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
    // ONLY fill city and state - NOT street, number, or neighborhood
    onInputChange('origin_city', data.city);
    onInputChange('origin_state', data.state);
    onInputChange('origin_lat', data.lat);
    onInputChange('origin_lng', data.lng);
  };

  const handleGPSError = (message: string) => {
    setGpsError(message);
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

      {/* GPS Error Alert - only shows when there's an error */}
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
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">B</span>
            Destino
          </Label>
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

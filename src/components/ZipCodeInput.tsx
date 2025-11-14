import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import { useZipCode } from '@/hooks/useZipCode';
import { ZipCodeService } from '@/services/zipCodeService';
import { cn } from '@/lib/utils';

interface ZipCodeInputProps {
  label?: string;
  value: string;
  onChange: (zipCode: string, cityData?: {
    city: string;
    state: string;
    neighborhood?: string;
    cityId?: string;
    lat?: number;
    lng?: number;
  }) => void;
  required?: boolean;
  className?: string;
  showAutoComplete?: boolean;
}

export const ZipCodeInput: React.FC<ZipCodeInputProps> = ({
  label = 'CEP',
  value,
  onChange,
  required = false,
  className,
  showAutoComplete = true
}) => {
  const { loading, data, error, searchZipCode } = useZipCode();
  const [localValue, setLocalValue] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const normalized = localValue.replace(/\D/g, '');
    
    if (normalized.length === 8) {
      // Buscar automaticamente quando completar 8 dígitos
      searchZipCode(normalized).then(result => {
        if (result) {
          onChange(result.zipCode, {
            city: result.city,
            state: result.state,
            neighborhood: result.neighborhood,
            cityId: result.cityId,
            lat: result.lat,
            lng: result.lng
          });
        }
      });
    } else if (normalized.length >= 3 && showAutoComplete) {
      // Autocompletar
      ZipCodeService.autocompleteZipCode(normalized).then(results => {
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      });
    } else {
      setShowSuggestions(false);
    }
  }, [localValue, searchZipCode, onChange, showAutoComplete]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.replace(/\D/g, '');
    if (input.length > 8) input = input.slice(0, 8);
    
    // Formatar: 12345-678
    if (input.length > 5) {
      input = `${input.slice(0, 5)}-${input.slice(5)}`;
    }
    
    setLocalValue(input);
    onChange(input);
  };

  const handleSuggestionClick = (suggestion: any) => {
    setLocalValue(ZipCodeService.formatZipCode(suggestion.zipCode));
    onChange(suggestion.zipCode, {
      city: suggestion.city,
      state: suggestion.state,
      neighborhood: suggestion.neighborhood,
      cityId: suggestion.cityId,
      lat: suggestion.lat,
      lng: suggestion.lng
    });
    setShowSuggestions(false);
  };

  return (
    <div className={cn('space-y-2 relative', className)}>
      <Label htmlFor="zipcode">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      
      <div className="relative">
        <Input
          id="zipcode"
          type="text"
          value={localValue}
          onChange={handleInputChange}
          placeholder="00000-000"
          maxLength={9}
          className={cn(
            'pl-10',
            data && 'border-green-500',
            error && 'border-red-500'
          )}
          required={required}
        />
        
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : data ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : error ? (
            <AlertCircle className="h-4 w-4 text-red-600" />
          ) : (
            <MapPin className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Sugestões de autocompletar */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              type="button"
              className="w-full px-4 py-2 text-left hover:bg-accent flex items-center gap-2"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">
                  {ZipCodeService.formatZipCode(suggestion.zipCode)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {suggestion.city} - {suggestion.state}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Exibir cidade encontrada */}
      {data && (
        <div className="text-sm text-green-600 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            {data.city} - {data.state}
            {data.neighborhood && ` (${data.neighborhood})`}
          </span>
        </div>
      )}

      {/* Exibir erro */}
      {error && !loading && (
        <div className="text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

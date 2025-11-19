import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ZipCodeService } from '@/services/zipCodeService';
import { supabase } from '@/integrations/supabase/client';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LocationData {
  city: string;
  state: string;
  cityId?: string;
  lat?: number;
  lng?: number;
  neighborhood?: string;
  zipCode?: string;
}

interface UnifiedLocationInputProps {
  label?: string;
  value: string;
  onChange: (value: string, locationData?: LocationData) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

type InputType = 'cep' | 'city' | 'empty';

interface CitySuggestion {
  id: string;
  name: string;
  state: string;
  display_name: string;
  lat?: number;
  lng?: number;
}

export const UnifiedLocationInput: React.FC<UnifiedLocationInputProps> = ({
  label = "CEP ou Cidade",
  value,
  onChange,
  required = false,
  placeholder = "Digite 00000-000 ou nome da cidade",
  className
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [inputType, setInputType] = useState<InputType>('empty');
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validLocation, setValidLocation] = useState<boolean | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detectar tipo de input
  const detectInputType = (val: string): InputType => {
    const cleaned = val.replace(/\D/g, '');
    if (cleaned === '') return 'empty';
    if (cleaned.length > 0 && (val === cleaned || val.includes('-'))) {
      return 'cep';
    }
    return 'city';
  };

  // Formatar CEP automaticamente
  const formatCEP = (val: string): string => {
    const numbers = val.replace(/\D/g, '');
    if (numbers.length > 8) return numbers.slice(0, 8);
    
    if (numbers.length > 5) {
      return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
    }
    return numbers;
  };

  // Buscar CEP
  const searchZipCode = async (zipCode: string) => {
    setLoading(true);
    setValidLocation(null);
    try {
      const result = await ZipCodeService.searchZipCode(zipCode);
      if (result) {
        setValidLocation(true);
        setShowSuggestions(false);
        onChange(inputValue, {
          city: result.city,
          state: result.state,
          cityId: result.cityId,
          lat: result.lat,
          lng: result.lng,
          neighborhood: result.neighborhood,
          zipCode: zipCode
        });
      } else {
        setValidLocation(false);
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      setValidLocation(false);
    } finally {
      setLoading(false);
    }
  };

  // Buscar cidades
  const searchCities = async (searchTerm: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('search_cities', {
        search_term: searchTerm,
        limit_count: 10
      });

      if (error) throw error;

      const results = data || [];
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (error) {
      console.error('Erro ao buscar cidades:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  };

  // Handler de mudança de input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const type = detectInputType(rawValue);
    
    setInputType(type);
    setValidLocation(null);
    
    if (type === 'cep') {
      const formatted = formatCEP(rawValue);
      setInputValue(formatted);
      onChange(formatted);
      
      const numbers = formatted.replace(/\D/g, '');
      if (numbers.length === 8) {
        searchZipCode(numbers);
      } else {
        setShowSuggestions(false);
      }
    } else if (type === 'city') {
      setInputValue(rawValue);
      onChange(rawValue);
      
      if (rawValue.length >= 2) {
        searchCities(rawValue);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } else {
      setInputValue('');
      onChange('');
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Handler de clique em sugestão
  const handleSuggestionClick = (suggestion: CitySuggestion) => {
    const displayValue = `${suggestion.name}, ${suggestion.state}`;
    setInputValue(displayValue);
    setValidLocation(true);
    setShowSuggestions(false);
    
    onChange(displayValue, {
      city: suggestion.name,
      state: suggestion.state,
      cityId: suggestion.id,
      lat: suggestion.lat,
      lng: suggestion.lng
    });
  };

  // Fechar sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Atualizar valor quando prop value mudar
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  return (
    <div className={cn('space-y-2 relative', className)}>
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={cn(
            'pl-10 pr-10',
            validLocation === true && 'border-green-500 focus-visible:ring-green-500',
            validLocation === false && 'border-destructive focus-visible:ring-destructive'
          )}
          required={required}
        />
        
        {/* Ícone de status à esquerda */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : validLocation === true ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : validLocation === false ? (
            <MapPin className="h-4 w-4 text-destructive" />
          ) : (
            <MapPin className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        
        {/* Tooltip de ajuda à direita */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger type="button">
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Digite o CEP (00000-000) ou nome da cidade</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      {/* Dropdown de sugestões */}
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              className="w-full px-4 py-2 text-left hover:bg-accent transition-colors"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div>
                <div className="font-medium">{suggestion.name}</div>
                <div className="text-sm text-muted-foreground">
                  {suggestion.state}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {/* Mensagem de localização validada */}
      {validLocation === true && (
        <div className="text-sm text-green-600 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>Localização validada ✓</span>
        </div>
      )}
      
      {/* Mensagem de erro */}
      {validLocation === false && (
        <div className="text-sm text-destructive">
          {inputType === 'cep' 
            ? 'CEP não encontrado. Tente outro ou digite o nome da cidade.'
            : 'Cidade não encontrada. Verifique a digitação.'}
        </div>
      )}
    </div>
  );
};

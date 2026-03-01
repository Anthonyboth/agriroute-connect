import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MapPin, X, CheckCircle2, AlertTriangle, Loader2, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ZipCodeService } from '@/services/zipCodeService';
import { deduplicateCities, formatCityDisplay, formatCityStatusMessage, toUF } from '@/utils/city-deduplication';

interface City {
  id: string;
  name: string;
  state: string;
  display_name: string;
  lat?: number;
  lng?: number;
  ibge_code?: string;
}

interface AddressLocationInputProps {
  value?: {
    city: string;
    state: string;
    id?: string;
    lat?: number;
    lng?: number;
    neighborhood?: string;
  };
  onChange: (data: { 
    city: string; 
    state: string; 
    id: string; 
    lat?: number; 
    lng?: number;
    neighborhood?: string;
    cep?: string;
  }) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
  error?: string;
}

export const AddressLocationInput: React.FC<AddressLocationInputProps> = ({
  value,
  onChange,
  placeholder = "Digite CEP (00000-000) ou nome da cidade",
  label = "Cidade",
  required = false,
  className,
  error
}) => {
  const [searchTerm, setSearchTerm] = useState(value?.city && value?.state ? formatCityDisplay(value.city, value.state) : '');
  
  // Sync searchTerm when value changes externally (e.g. GPS fill)
  const prevValueRef = useRef(value);
  useEffect(() => {
    const prev = prevValueRef.current;
    const changed = value?.city !== prev?.city || value?.state !== prev?.state;
    prevValueRef.current = value;
    if (changed && value?.city && value?.state) {
      setSearchTerm(formatCityDisplay(value.city, value.state));
      setValidationStatus(value.id ? 'valid' : 'none');
    }
  }, [value?.city, value?.state, value?.id]);
  const [cities, setCities] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [inputType, setInputType] = useState<'cep' | 'city' | 'empty'>('empty');
  const [validationStatus, setValidationStatus] = useState<'none' | 'valid' | 'invalid'>('none');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Detectar tipo de input: CEP ou nome de cidade
  const detectInputType = (val: string): 'cep' | 'city' | 'empty' => {
    const trimmed = val.trim();
    if (trimmed === '') return 'empty';
    
    // Se contém APENAS números, hífens ou espaços, é CEP
    if (/^[\d\-\s]+$/.test(trimmed)) {
      return 'cep';
    }
    
    // Se contém letras, é nome de cidade
    return 'city';
  };

  // Formatar CEP automaticamente
  const formatCEP = (val: string): string => {
    const numbers = val.replace(/\D/g, '');
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
  };

  // Buscar por CEP
  const searchByZipCode = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length < 8) {
      setCities([]);
      return;
    }

    setIsLoading(true);
    try {
      const result = await ZipCodeService.searchZipCode(cleanCep);
      
      if (result) {
        // CEP encontrado - preencher automaticamente
        // SEMPRE converter state para UF de 2 letras
        const uf = toUF(result.state) || result.state;
        onChange({
          city: result.city,
          state: uf,
          id: result.cityId || '',
          lat: result.lat,
          lng: result.lng,
          neighborhood: result.neighborhood,
          cep: cleanCep
        });
        setSearchTerm(formatCityDisplay(result.city, uf));
        setValidationStatus('valid');
        setShowDropdown(false);
      } else {
        setValidationStatus('invalid');
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      setValidationStatus('invalid');
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar cidades por nome com deduplicação
  const searchCities = async (term: string) => {
    if (!term || term.length < 2) {
      setCities([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('search_cities', {
        search_term: term,
        limit_count: 20 // Buscar mais para compensar possíveis duplicatas
      });

      if (error) {
        console.error('Erro ao buscar cidades:', error);
        return;
      }

      // Deduplicar e formatar display_name consistente
      const rawCities = (data || []).map((c: any) => ({
        ...c,
        display_name: formatCityDisplay(c.name, c.state)
      }));
      
      const uniqueCities = deduplicateCities(rawCities).slice(0, 10);
      setCities(uniqueCities);
      setShowDropdown(true);
    } catch (error) {
      console.error('Erro na busca de cidades:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce da busca
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const type = detectInputType(searchTerm);
    setInputType(type);

    if (type === 'empty') {
      setCities([]);
      setValidationStatus('none');
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (type === 'cep') {
        const cleanCep = searchTerm.replace(/\D/g, '');
        if (cleanCep.length === 8) {
          searchByZipCode(cleanCep);
        }
      } else if (type === 'city') {
        searchCities(searchTerm);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    const type = detectInputType(inputValue);
    
    // Auto-formatar CEP
    if (type === 'cep') {
      inputValue = formatCEP(inputValue);
    }
    
    setSearchTerm(inputValue);
    setShowDropdown(type === 'city');
    setSelectedIndex(-1);
    setValidationStatus('none');
  };

  const handleCitySelect = (city: City) => {
    // SEMPRE usar UF de 2 letras
    const uf = toUF(city.state) || city.state;
    setSearchTerm(formatCityDisplay(city.name, uf));
    setShowDropdown(false);
    setSelectedIndex(-1);
    setValidationStatus('valid');
    onChange({
      city: city.name,
      state: uf,
      id: city.id,
      lat: city.lat,
      lng: city.lng
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || cities.length === 0) {
      // Se for CEP com Enter, forçar busca
      if (e.key === 'Enter' && inputType === 'cep') {
        e.preventDefault();
        const cleanCep = searchTerm.replace(/\D/g, '');
        if (cleanCep.length >= 5) {
          // Pad com zeros se necessário
          const paddedCep = cleanCep.padEnd(8, '0');
          searchByZipCode(paddedCep);
        }
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < cities.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : cities.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < cities.length) {
          handleCitySelect(cities[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const clearSelection = () => {
    setSearchTerm('');
    onChange({ city: '', state: '', id: '' });
    setShowDropdown(false);
    setValidationStatus('none');
    inputRef.current?.focus();
  };

  const isValidated = validationStatus === 'valid' && value?.id;

  return (
    <TooltipProvider>
      <div className={cn("relative w-full", className)} ref={dropdownRef}>
        {label && (
          <div className="flex items-center gap-2 mb-2">
            <Label htmlFor="address-location-input" className="text-sm font-medium">
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-[200px]">
                  Digite um CEP (ex: 01310-100) para preencher automaticamente, 
                  ou digite o nome da cidade para buscar na lista.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
        
        <div className="relative">
          <Input
            ref={inputRef}
            id="address-location-input"
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => inputType === 'city' && cities.length > 0 && setShowDropdown(true)}
            placeholder={placeholder}
            className={cn(
              "pl-10 pr-20",
              error && "border-destructive",
              isValidated && "border-green-500 focus-visible:ring-green-500",
              validationStatus === 'invalid' && "border-destructive focus-visible:ring-destructive"
            )}
            autoComplete="off"
          />
          
          <MapPin className={cn(
            "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4",
            inputType === 'cep' && searchTerm.replace(/\D/g, '').length >= 5 
              ? "text-yellow-500 animate-pulse" 
              : "text-muted-foreground"
          )} />
          
          {/* Status Icons */}
          <div className="absolute right-10 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
            {!isLoading && isValidated && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Localização validada ✓</p>
                </TooltipContent>
              </Tooltip>
            )}
            {!isLoading && validationStatus === 'invalid' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">CEP não encontrado</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          
          {searchTerm && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
              onClick={clearSelection}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Dropdown de cidades */}
        {showDropdown && inputType === 'city' && (cities.length > 0 || isLoading) && (
          <div className="absolute z-[2000] w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-primary mr-2" />
                <span className="text-sm text-muted-foreground">Buscando cidades...</span>
              </div>
            ) : (
              cities.map((city, index) => (
                <button
                  key={`${city.id}-${city.name}-${city.state}`}
                  type="button"
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-accent hover:text-accent-foreground flex items-center transition-colors",
                    selectedIndex === index && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => handleCitySelect(city)}
                >
                  <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{city.display_name}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
        
        {error && (
          <p className="text-sm text-destructive mt-1">{error}</p>
        )}
        
        {/* Helper text dinâmico */}
        {!error && !searchTerm && (
          <p className="text-xs text-muted-foreground mt-1">
            Digite CEP (00000-000) ou nome da cidade
          </p>
        )}
        
        {/* Indicador de tipo de busca */}
        {!error && searchTerm && inputType === 'cep' && !isValidated && !isLoading && (
          <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
            {searchTerm.replace(/\D/g, '').length < 8 
              ? `Digite ${8 - searchTerm.replace(/\D/g, '').length} dígitos restantes ou pressione Enter`
              : 'Buscando CEP...'
            }
          </p>
        )}
        
        {/* Warning quando digitou cidade mas não selecionou */}
        {!error && searchTerm && inputType === 'city' && value?.city && !value?.id && (
          <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Selecione uma cidade da lista
          </p>
        )}
        
        {/* Success message */}
        {isValidated && value?.city && (
          <p className="text-xs text-green-600 dark:text-green-500 mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {formatCityStatusMessage(value.city, value.state || '', value.neighborhood)}
          </p>
        )}
      </div>
    </TooltipProvider>
  );
};

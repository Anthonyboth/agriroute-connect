import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface City {
  id: string;
  name: string;
  state: string;
  display_name: string;
  lat?: number;
  lng?: number;
}

interface CitySelectorProps {
  value?: {
    city: string;
    state: string;
  };
  onChange: (city: { city: string; state: string; id?: string; lat?: number; lng?: number }) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
  error?: string;
}

export const CitySelector: React.FC<CitySelectorProps> = ({
  value,
  onChange,
  placeholder = "Localize sua Cidade",
  label = "Cidade",
  required = false,
  className,
  error
}) => {
  const [searchTerm, setSearchTerm] = useState(value && value.city && value.state ? `${value.city}, ${value.state}` : '');
  const [cities, setCities] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Buscar cidades no banco de dados
  const searchCities = async (term: string) => {
    if (!term || term.length < 2) {
      setCities([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('search_cities', {
        search_term: term,
        limit_count: 10
      });

      if (error) {
        console.error('Erro ao buscar cidades:', error);
        return;
      }

      setCities(data || []);
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

    searchTimeoutRef.current = setTimeout(() => {
      searchCities(searchTerm);
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
    const inputValue = e.target.value;
    setSearchTerm(inputValue);
    setShowDropdown(true);
    setSelectedIndex(-1);
    
    // Limpar seleção se o usuário digitou algo diferente do valor atual
    if (value && value.city && value.state && inputValue !== `${value.city}, ${value.state}`) {
      // onChange({ city: '', state: '' });
    }
  };

  const handleCitySelect = (city: City) => {
    setSearchTerm(city.display_name);
    setShowDropdown(false);
    setSelectedIndex(-1);
    onChange({
      city: city.name,
      state: city.state,
      id: city.id,
      lat: city.lat,
      lng: city.lng
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || cities.length === 0) return;

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
    onChange({ city: '', state: '' });
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  return (
    <div className={cn("relative w-full", className)}>
      {label && (
        <Label htmlFor="city-selector" className="block text-sm font-medium mb-2">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      
      <div className="relative">
        <div className="relative">
          <Input
            ref={inputRef}
            id="city-selector"
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowDropdown(true)}
            placeholder={placeholder}
            className={cn(
              "pl-10 pr-10",
              error && "border-destructive"
            )}
            autoComplete="off"
          />
          
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          
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
          
          {isLoading && (
            <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}
        </div>

        {/* Dropdown de resultados */}
        {showDropdown && (cities.length > 0 || isLoading) && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                <span className="text-sm text-muted-foreground">Buscando cidades...</span>
              </div>
            ) : (
              cities.map((city, index) => (
                <button
                  key={city.id}
                  type="button"
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-accent hover:text-accent-foreground flex items-center transition-colors",
                    selectedIndex === index && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => handleCitySelect(city)}
                >
                  <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{city.name}</div>
                    <div className="text-sm text-muted-foreground">{city.state}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}
    </div>
  );
};
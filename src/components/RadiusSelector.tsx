import React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { MapPin, Radar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RadiusSelectorProps {
  value: number;
  onChange: (radius: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showInput?: boolean;
  className?: string;
  unit?: string;
}

export const RadiusSelector: React.FC<RadiusSelectorProps> = ({
  value,
  onChange,
  min = 10,
  max = 500,
  step = 10,
  label = "Raio de Atendimento",
  showInput = true,
  className,
  unit = "km"
}) => {
  const handleSliderChange = (values: number[]) => {
    onChange(values[0]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = parseInt(e.target.value) || min;
    const clampedValue = Math.max(min, Math.min(max, inputValue));
    onChange(clampedValue);
  };

  const getRadiusColor = (radius: number): string => {
    if (radius <= 50) return "text-green-600";
    if (radius <= 100) return "text-yellow-600";
    if (radius <= 200) return "text-orange-600";
    return "text-red-600";
  };

  const getRadiusDescription = (radius: number): string => {
    if (radius <= 30) return "Local";
    if (radius <= 80) return "Regional";
    if (radius <= 150) return "Estadual";
    if (radius <= 300) return "Multi-estadual";
    return "Nacional";
  };

  return (
    <div className={cn("space-y-4", className)}>
      {label && (
        <Label className="block text-sm font-medium">
          <div className="flex items-center gap-2">
            <Radar className="h-4 w-4" />
            {label}
          </div>
        </Label>
      )}
      
      <div className="space-y-3">
        {/* Slider */}
        <div className="px-2">
          <Slider
            value={[value]}
            onValueChange={handleSliderChange}
            min={min}
            max={max}
            step={step}
            className="w-full"
          />
        </div>
        
        {/* Valor atual e descrição */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className={cn("h-4 w-4", getRadiusColor(value))} />
            <span className={cn("font-medium", getRadiusColor(value))}>
              {value}{unit}
            </span>
            <span className="text-sm text-muted-foreground">
              ({getRadiusDescription(value)})
            </span>
          </div>
          
          {showInput && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={value}
                onChange={handleInputChange}
                min={min}
                max={max}
                step={step}
                className="w-20 text-center"
              />
              <span className="text-sm text-muted-foreground">{unit}</span>
            </div>
          )}
        </div>
        
        {/* Indicadores de alcance */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{min}{unit}</span>
          <span className="flex items-center gap-1">
            <Radar className="h-3 w-3" />
            Seu alcance de atendimento
          </span>
          <span>{max}{unit}</span>
        </div>
        
        {/* Dica informativa */}
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Dica:</strong> {value <= 50 
              ? "Ideal para atendimento local e urbano. Menor concorrência, entregas rápidas."
              : value <= 100 
              ? "Bom equilíbrio entre alcance e praticidade. Atende cidades próximas."
              : value <= 200
              ? "Alcance estadual. Mais oportunidades, mas considere custos de combustível."
              : "Alcance amplo. Máxima cobertura, ideal para serviços especializados."
            }
          </p>
        </div>
      </div>
    </div>
  );
};
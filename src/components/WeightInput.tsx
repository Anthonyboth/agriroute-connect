import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { validateWeight, type WeightValidationResult } from '@/lib/freight-calculations';

interface WeightInputProps {
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  required?: boolean;
}

export const WeightInput = ({ value, onChange, required = true }: WeightInputProps) => {
  const [validation, setValidation] = useState<WeightValidationResult | null>(null);
  
  useEffect(() => {
    if (value) {
      const result = validateWeight(value);
      setValidation(result);
      onChange(value, result.isValid);
    } else {
      setValidation(null);
      onChange(value, false);
    }
  }, [value]);
  
  return (
    <div className="space-y-2">
      <Input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value, false)}
        placeholder="Ex: 600"
        required={required}
        className={validation && !validation.isValid ? 'border-destructive' : ''}
      />
      
      <p className="text-xs text-muted-foreground">
        💡 Peso <strong>total</strong> em toneladas que deseja transportar. Ex: 600 = 600 toneladas no barracão
      </p>
      
      {/* Preview do peso formatado */}
      {validation && validation.isValid && (
        <div className="text-sm font-medium text-green-600">
          ✅ {validation.formatted}
        </div>
      )}
      
      {/* Erros */}
      {validation?.errors.map((error, i) => (
        <Alert key={i} variant="destructive" className="py-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      ))}
      
      {/* Warnings */}
      {validation?.warnings.map((warning, i) => (
        <Alert key={i} className="py-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertDescription className="text-xs text-yellow-800 dark:text-yellow-200">{warning}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
};

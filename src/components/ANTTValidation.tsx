import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, DollarSign, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ANTTValidationProps {
  proposedPrice: number;
  minimumAnttPrice?: number;
  distance?: number;
  cargoType?: string;
  weight?: number;
}

export const ANTTValidation: React.FC<ANTTValidationProps> = ({
  proposedPrice,
  minimumAnttPrice,
  distance,
  cargoType,
  weight
}) => {
  if (!minimumAnttPrice || minimumAnttPrice === 0) {
    return (
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-blue-800">
          Calculando preço mínimo ANTT...
        </AlertDescription>
      </Alert>
    );
  }

  const isAboveMinimum = proposedPrice >= minimumAnttPrice;
  const difference = proposedPrice - minimumAnttPrice;
  const percentageDiff = ((difference / minimumAnttPrice) * 100);

  if (!isAboveMinimum) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="space-y-3">
          <div className="text-red-800">
            <p className="font-semibold">⚠️ Valor abaixo do mínimo ANTT</p>
            <p>
              Seu valor: <strong>R$ {proposedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            </p>
            <p>
              Mínimo ANTT: <strong>R$ {minimumAnttPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            </p>
            <p>
              Diferença: <strong className="text-red-600">
                R$ {Math.abs(difference).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a menos
              </strong>
            </p>
          </div>
          
          <div className="bg-red-100 p-3 rounded-lg border border-red-200">
            <p className="text-sm text-red-700 font-medium mb-2">
              🚛 Por que cobrar o valor correto?
            </p>
            <ul className="text-xs text-red-600 space-y-1">
              <li>• Sustentabilidade do seu negócio</li>
              <li>• Cobertura de custos operacionais</li>
              <li>• Manutenção e combustível adequados</li>
              <li>• Valorização do seu trabalho</li>
              <li>• Conformidade com regulamentações</li>
            </ul>
          </div>
          
          <p className="text-sm font-medium text-red-800">
            💡 Recomendamos revisar seu valor para garantir uma operação sustentável.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-green-200 bg-green-50">
      <DollarSign className="h-4 w-4 text-green-600" />
      <AlertDescription className="text-green-800">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold">✅ Valor adequado (ANTT)</span>
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            +{percentageDiff.toFixed(1)}% do mínimo
          </Badge>
        </div>
        <div className="text-sm space-y-1">
          <p>Seu valor: R$ {proposedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p>Mínimo ANTT: R$ {minimumAnttPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          {distance && (
            <p>
              Distância: {distance.toLocaleString('pt-BR')} km
              {weight && ` • Peso: ${weight}t`}
              {cargoType && ` • Carga: ${cargoType}`}
            </p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default ANTTValidation;
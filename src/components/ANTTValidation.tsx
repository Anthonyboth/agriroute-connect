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
  axles?: number;
  highPerformance?: boolean;
  anttDetails?: any;
}

export const ANTTValidation: React.FC<ANTTValidationProps> = ({
  proposedPrice,
  minimumAnttPrice,
  distance,
  cargoType,
  weight,
  axles,
  highPerformance,
  anttDetails
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
            <div className="mt-2 space-y-1 text-sm">
              <p>Seu valor: <strong>R$ {proposedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
              <p>Mínimo ANTT: <strong>R$ {minimumAnttPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
              <p className="text-red-600 font-semibold">
                Diferença: R$ {Math.abs(difference).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a menos
              </p>
            </div>
          </div>
          
          {anttDetails && (
            <div className="bg-red-100 p-3 rounded-lg border border-red-200 text-xs">
              <p className="font-semibold mb-1">📋 Cálculo Oficial ANTT:</p>
              <p className="font-mono text-[10px] mb-2">{anttDetails.formula}</p>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                <p>Categoria: {anttDetails.antt_category}</p>
                <p>Eixos: {axles}</p>
                <p>Tabela: {anttDetails.table_type || (highPerformance ? 'C' : 'A')}</p>
                <p>Distância: {distance}km</p>
              </div>
            </div>
          )}
          
          <div className="bg-red-100 p-3 rounded-lg border border-red-200">
            <p className="text-sm text-red-700 font-medium mb-2">
              🚛 Por que respeitar o piso ANTT?
            </p>
            <ul className="text-xs text-red-600 space-y-1">
              <li>• Sustentabilidade do seu negócio</li>
              <li>• Cobertura de custos (combustível, manutenção)</li>
              <li>• Valorização do transportador</li>
              <li>• <strong>Conformidade legal (Lei 13.703/2018)</strong></li>
            </ul>
          </div>
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
          
          {anttDetails && (
            <div className="mt-2 p-2 bg-green-100 rounded text-xs">
              <p className="font-semibold mb-1">📋 Detalhes do Cálculo ANTT:</p>
              <div className="grid grid-cols-2 gap-1">
                <p>Categoria: {anttDetails.antt_category}</p>
                <p>Eixos: {axles}</p>
                <p>Tabela: {anttDetails.table_type || (highPerformance ? 'C' : 'A')}</p>
                <p>Distância: {distance}km</p>
                <p className="col-span-2 mt-1 font-mono text-[10px]">{anttDetails.formula}</p>
              </div>
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default ANTTValidation;
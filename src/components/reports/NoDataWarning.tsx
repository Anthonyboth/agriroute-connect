import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Calendar, RefreshCw, Infinity } from 'lucide-react';

interface NoDataWarningProps {
  periodLabel?: string;
  onExpandPeriod?: () => void;
  onRefresh?: () => void;
  suggestions?: string[];
}

export const NoDataWarning: React.FC<NoDataWarningProps> = ({
  periodLabel = 'este período',
  onExpandPeriod,
  onRefresh,
  suggestions = [],
}) => {
  return (
    <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
      <AlertTriangle className="h-5 w-5 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-200">
        Nenhum dado encontrado
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        <p className="mb-3">
          Não foram encontrados registros para {periodLabel}. Isso pode acontecer porque:
        </p>
        
        <ul className="list-disc list-inside space-y-1 text-sm mb-4">
          <li>Não houve atividade no período selecionado</li>
          <li>Os dados ainda estão sendo processados</li>
          {suggestions.map((suggestion, idx) => (
            <li key={idx}>{suggestion}</li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          {onExpandPeriod && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExpandPeriod}
              className="border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/30"
            >
              <Infinity className="h-4 w-4 mr-2" />
              Ver todo o histórico
            </Button>
          )}
          
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/30"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar dados
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};

// Inline version for smaller spaces
export const NoDataInline: React.FC<{ message?: string }> = ({ 
  message = "Sem dados para este período" 
}) => {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
      <Calendar className="h-4 w-4" />
      <span>{message}</span>
    </div>
  );
};

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataQualityStats {
  totalRecords: number;
  recordsWithoutId: number;
  recordsOutOfRange: number;
  dataCompleteness: number; // 0-100
}

interface DataQualityCardProps {
  stats: DataQualityStats;
  className?: string;
  compact?: boolean;
}

export const DataQualityCard: React.FC<DataQualityCardProps> = ({
  stats,
  className,
  compact = false,
}) => {
  const { totalRecords, recordsWithoutId, recordsOutOfRange, dataCompleteness } = stats;

  const getQualityLevel = (): { label: string; color: string; icon: React.ReactNode } => {
    if (dataCompleteness >= 90) {
      return { label: 'Excelente', color: 'text-green-600', icon: <CheckCircle className="h-4 w-4 text-green-600" /> };
    }
    if (dataCompleteness >= 70) {
      return { label: 'Bom', color: 'text-blue-600', icon: <Info className="h-4 w-4 text-blue-600" /> };
    }
    if (dataCompleteness >= 50) {
      return { label: 'Regular', color: 'text-amber-600', icon: <AlertTriangle className="h-4 w-4 text-amber-600" /> };
    }
    return { label: 'Baixo', color: 'text-red-600', icon: <AlertTriangle className="h-4 w-4 text-red-600" /> };
  };

  const quality = getQualityLevel();

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        {quality.icon}
        <span className={quality.color}>{quality.label}</span>
        <Badge variant="outline" className="text-xs">
          {dataCompleteness.toFixed(0)}%
        </Badge>
      </div>
    );
  }

  return (
    <Card className={cn("border-dashed", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          Qualidade dos Dados
          <Badge variant="outline" className={cn("ml-auto", quality.color)}>
            {quality.icon}
            <span className="ml-1">{quality.label}</span>
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Completude dos dados</span>
            <span>{dataCompleteness.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-500",
                dataCompleteness >= 90 ? "bg-green-500" :
                dataCompleteness >= 70 ? "bg-blue-500" :
                dataCompleteness >= 50 ? "bg-amber-500" : "bg-red-500"
              )}
              style={{ width: `${dataCompleteness}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-semibold">{totalRecords}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20">
            <p className="text-lg font-semibold text-amber-600">{recordsWithoutId}</p>
            <p className="text-xs text-muted-foreground">Sem ID</p>
          </div>
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
            <p className="text-lg font-semibold text-blue-600">{recordsOutOfRange}</p>
            <p className="text-xs text-muted-foreground">Fora do período</p>
          </div>
        </div>

        {/* Help text */}
        {(recordsWithoutId > 0 || recordsOutOfRange > 0) && (
          <p className="text-xs text-muted-foreground">
            {recordsWithoutId > 0 && (
              <span>• {recordsWithoutId} registro(s) sem identificador podem não aparecer nos relatórios. </span>
            )}
            {recordsOutOfRange > 0 && (
              <span>• {recordsOutOfRange} registro(s) estão fora do período selecionado.</span>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// Hook para calcular estatísticas de qualidade
export const useDataQualityStats = (
  data: any[],
  idField: string = 'id',
  dateField: string = 'created_at',
  dateRange?: { from: Date; to: Date }
): DataQualityStats => {
  const totalRecords = data.length;
  
  const recordsWithoutId = data.filter(item => !item[idField]).length;
  
  const recordsOutOfRange = dateRange 
    ? data.filter(item => {
        if (!item[dateField]) return false;
        const date = new Date(item[dateField]);
        return date < dateRange.from || date > dateRange.to;
      }).length
    : 0;
  
  const validRecords = totalRecords - recordsWithoutId - recordsOutOfRange;
  const dataCompleteness = totalRecords > 0 ? (validRecords / totalRecords) * 100 : 100;

  return {
    totalRecords,
    recordsWithoutId,
    recordsOutOfRange,
    dataCompleteness,
  };
};

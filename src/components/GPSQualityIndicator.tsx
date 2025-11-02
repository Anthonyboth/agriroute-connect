import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Satellite } from 'lucide-react';
import type { GPSQuality } from '@/utils/location';

interface GPSQualityIndicatorProps {
  accuracy: number;
  lastUpdate?: string;
  className?: string;
}

export const GPSQualityIndicator = ({ accuracy, lastUpdate, className }: GPSQualityIndicatorProps) => {
  const getQualityConfig = (acc: number): GPSQuality & { color: string; icon: string } => {
    if (acc <= 20) return { accuracy: acc, quality: 'EXCELLENT', isAcceptable: true, color: 'bg-green-500', icon: '🟢' };
    if (acc <= 50) return { accuracy: acc, quality: 'GOOD', isAcceptable: true, color: 'bg-emerald-500', icon: '🟡' };
    if (acc <= 100) return { accuracy: acc, quality: 'ACCEPTABLE', isAcceptable: true, color: 'bg-yellow-500', icon: '🟠' };
    return { accuracy: acc, quality: 'POOR', isAcceptable: false, color: 'bg-red-500', icon: '🔴' };
  };

  const qualityConfig = getQualityConfig(accuracy);

  const getQualityLabel = () => {
    switch (qualityConfig.quality) {
      case 'EXCELLENT': return 'Excelente';
      case 'GOOD': return 'Boa';
      case 'ACCEPTABLE': return 'Aceitável';
      case 'POOR': return 'Ruim';
    }
  };

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Satellite className="h-6 w-6 text-muted-foreground" />
            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${qualityConfig.color} animate-pulse`} />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">Qualidade GPS</span>
              <Badge variant={qualityConfig.isAcceptable ? "default" : "destructive"} className="text-xs">
                {qualityConfig.icon} {getQualityLabel()}
              </Badge>
            </div>
            
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>Precisão: {Math.round(accuracy)}m</div>
              {lastUpdate && (
                <div>Última atualização: {new Date(lastUpdate).toLocaleTimeString('pt-BR')}</div>
              )}
            </div>
          </div>
        </div>

        {!qualityConfig.isAcceptable && (
          <div className="mt-3 text-xs text-destructive">
            ⚠️ GPS com baixa precisão. Tente se mover para área aberta.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

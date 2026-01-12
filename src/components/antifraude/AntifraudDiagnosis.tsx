import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import type { AntifraudData } from '@/hooks/useAntifraudData';

interface AntifraudDiagnosisProps {
  data: AntifraudData;
}

export const AntifraudDiagnosis: React.FC<AntifraudDiagnosisProps> = ({ data }) => {
  const generateDiagnosis = (): { text: string; severity: 'normal' | 'attention' | 'high_risk' } => {
    const { indicators, score, stops, offlineIncidents, routeDeviations } = data;
    
    if (score < 20 && stops.length === 0 && offlineIncidents.length === 0) {
      return {
        text: 'Este frete não apresenta irregularidades detectadas. O trajeto está dentro dos parâmetros normais esperados.',
        severity: 'normal',
      };
    }

    const parts: string[] = [];

    // Paradas
    if (stops.length > 0) {
      const highRiskStops = stops.filter(s => s.risk_level === 'high' || s.risk_level === 'critical').length;
      if (highRiskStops > 0) {
        parts.push(
          `${highRiskStops} parada${highRiskStops > 1 ? 's' : ''} de alto risco fora de pontos logísticos`
        );
      } else if (stops.length > 3) {
        parts.push(`${stops.length} paradas registradas`);
      }
    }

    // Tempo parado
    if (indicators.totalStopTimeMinutes > 30) {
      const hours = Math.floor(indicators.totalStopTimeMinutes / 60);
      const mins = indicators.totalStopTimeMinutes % 60;
      const timeStr = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}min` : ''}` : `${mins} minutos`;
      parts.push(`totalizando ${timeStr} de paradas`);
    }

    // Desvio de rota
    if (indicators.routeDeviationMaxKm > 2) {
      parts.push(`com desvio de ${indicators.routeDeviationMaxKm.toFixed(1)}km da rota prevista`);
    }

    // Offline
    if (offlineIncidents.length > 0) {
      const suspiciousCount = offlineIncidents.filter(o => o.is_suspicious).length;
      if (suspiciousCount > 0) {
        parts.push(`${suspiciousCount} incidente${suspiciousCount > 1 ? 's' : ''} de GPS desligado suspeito${suspiciousCount > 1 ? 's' : ''}`);
      } else if (indicators.offlinePercentage > 5) {
        parts.push(`${indicators.offlinePercentage.toFixed(1)}% do tempo offline`);
      }
    }

    // Route deviations
    if (routeDeviations.length > 0 && !parts.some(p => p.includes('desvio'))) {
      parts.push(`${routeDeviations.length} desvio${routeDeviations.length > 1 ? 's' : ''} de rota detectado${routeDeviations.length > 1 ? 's' : ''}`);
    }

    if (parts.length === 0) {
      return {
        text: 'Este frete apresenta atividade normal. Pequenas variações foram detectadas mas estão dentro dos limites aceitáveis.',
        severity: 'normal',
      };
    }

    const levelText = score >= 70 ? 'ALTO' : score >= 40 ? 'MÉDIO' : 'BAIXO';
    const baseText = `Este frete apresentou ${parts.join(', ')}.`;
    const conclusion = ` Risco classificado como ${levelText} (${score}/100).`;

    return {
      text: baseText + conclusion,
      severity: data.level,
    };
  };

  const diagnosis = generateDiagnosis();

  const getIcon = () => {
    switch (diagnosis.severity) {
      case 'high_risk':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'attention':
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      default:
        return <CheckCircle className="h-5 w-5 text-green-600" />;
    }
  };

  const getBgColor = () => {
    switch (diagnosis.severity) {
      case 'high_risk':
        return 'bg-red-50 border-red-200';
      case 'attention':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-green-50 border-green-200';
    }
  };

  return (
    <Card className={`${getBgColor()} border`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="h-4 w-4" />
          Diagnóstico Automático
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3">
          {getIcon()}
          <p className="text-sm leading-relaxed">{diagnosis.text}</p>
        </div>
      </CardContent>
    </Card>
  );
};

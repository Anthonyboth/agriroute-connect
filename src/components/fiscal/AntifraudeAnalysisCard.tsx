import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useFiscal, AntifraudAnalysis, AntifraudEvent } from '@/hooks/useFiscal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AntifraudeAnalysisCardProps {
  freightId: string;
  empresaId?: string;
  autoRun?: boolean;
}

export function AntifraudeAnalysisCard({ 
  freightId, 
  empresaId,
  autoRun = false 
}: AntifraudeAnalysisCardProps) {
  const { loading, executarAntifraude } = useFiscal();
  const [analise, setAnalise] = useState<AntifraudAnalysis | null>(null);
  const [eventos, setEventos] = useState<AntifraudEvent[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  React.useEffect(() => {
    if (autoRun && !hasRun) {
      runAnalysis();
    }
  }, [autoRun, hasRun]);

  const runAnalysis = async () => {
    const result = await executarAntifraude(freightId, empresaId);
    if (result) {
      setAnalise(result.analise);
      setEventos(result.eventos);
      setHasRun(true);
    }
  };

  const getNivelColor = (nivel?: string) => {
    switch (nivel) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-muted-foreground';
    }
  };

  const getNivelBadge = (nivel?: string) => {
    switch (nivel) {
      case 'critical': return <Badge variant="destructive">Crítico</Badge>;
      case 'high': return <Badge className="bg-orange-500/20 text-orange-700 border-orange-500/30">Alto</Badge>;
      case 'medium': return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">Médio</Badge>;
      case 'low': return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">Baixo</Badge>;
      default: return <Badge variant="secondary">N/A</Badge>;
    }
  };

  const progressColor = analise?.score 
    ? analise.score >= 80 ? 'bg-red-500' 
      : analise.score >= 50 ? 'bg-orange-500' 
        : analise.score >= 20 ? 'bg-yellow-500' 
          : 'bg-green-500'
    : '';

  if (!hasRun && !autoRun) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5" />
            Análise Antifraude
          </CardTitle>
          <CardDescription>
            Execute a análise para verificar possíveis irregularidades
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={runAnalysis} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Executar Análise
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className={`h-5 w-5 ${getNivelColor(analise?.nivel)}`} />
            Análise Antifraude
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={runAnalysis}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !analise ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : analise ? (
          <>
            {/* Score */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Score de Risco</span>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${getNivelColor(analise.nivel)}`}>
                    {analise.score}
                  </span>
                  {getNivelBadge(analise.nivel)}
                </div>
              </div>
              <Progress value={analise.score} className={progressColor} />
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded bg-red-500/10">
                <p className="text-lg font-bold text-red-600">{analise.alertas_criticos}</p>
                <p className="text-xs text-muted-foreground">Críticos</p>
              </div>
              <div className="p-2 rounded bg-orange-500/10">
                <p className="text-lg font-bold text-orange-600">{analise.alertas_altos}</p>
                <p className="text-xs text-muted-foreground">Altos</p>
              </div>
              <div className="p-2 rounded bg-yellow-500/10">
                <p className="text-lg font-bold text-yellow-600">{analise.alertas_medios}</p>
                <p className="text-xs text-muted-foreground">Médios</p>
              </div>
              <div className="p-2 rounded bg-green-500/10">
                <p className="text-lg font-bold text-green-600">{analise.alertas_baixos}</p>
                <p className="text-xs text-muted-foreground">Baixos</p>
              </div>
            </div>

            {/* Status geral */}
            {analise.total_alertas === 0 ? (
              <div className="flex items-center gap-2 text-green-600 bg-green-500/10 p-3 rounded-lg">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">
                  Nenhuma irregularidade detectada
                </span>
              </div>
            ) : (
              <Collapsible open={expanded} onOpenChange={setExpanded}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      {analise.total_alertas} alerta(s) encontrado(s)
                    </span>
                    {expanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {eventos.map((evento) => (
                    <div
                      key={evento.id}
                      className="p-2 rounded border bg-card text-sm"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {evento.codigo_regra}
                        </Badge>
                        {getNivelBadge(evento.severidade)}
                      </div>
                      <p className="text-muted-foreground">{evento.descricao}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(evento.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

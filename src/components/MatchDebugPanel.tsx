import React, { useState, useEffect } from 'react';
import { useMatchDebug, type MatchDebugResult, isMatchDebugEnabled } from '@/hooks/useMatchDebug';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bug, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Painel de debug do match feed.
 * Só renderiza quando matchDebug=1 está ativo na URL ou VITE_MATCH_DEBUG=true.
 */
export function MatchDebugPanel() {
  const { debugEnabled, fetchRecentLogs } = useMatchDebug();
  const [logs, setLogs] = useState<MatchDebugResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  if (!debugEnabled) return null;

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setLoading(true);
      const results = await fetchRecentLogs(10);
      setLogs(results);
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="bg-yellow-100 border-yellow-400 text-yellow-800 hover:bg-yellow-200">
            <Bug className="w-4 h-4 mr-1" />
            Match Debug
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="w-5 h-5" />
              Diagnóstico do Match Feed
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {loading ? (
              <p className="text-sm text-muted-foreground p-4">Carregando logs...</p>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">
                Nenhum log de debug encontrado. Navegue para o feed de fretes ou serviços para gerar logs.
              </p>
            ) : (
              <div className="space-y-4 p-2">
                {logs.map((log, i) => (
                  <DebugLogEntry key={log.requestId + i} log={log} />
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DebugLogEntry({ log }: { log: MatchDebugResult }) {
  const [expanded, setExpanded] = useState(false);
  const stats = log.stats as any;

  return (
    <div className="border rounded-lg p-3 text-sm space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={log.error ? 'destructive' : 'secondary'}>
            {log.feedType}
          </Badge>
          {log.error && <Badge variant="destructive">ERRO</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {new Date(log.startedAt).toLocaleTimeString('pt-BR')}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-4 gap-2">
        <StatBadge label="Candidatos" value={stats.candidates} />
        <StatBadge label="Por tipo" value={stats.filtered_by_type} variant="warn" />
        <StatBadge label="Por cidade" value={stats.filtered_by_city} variant="warn" />
        <StatBadge label="Retornados" value={stats.returned} variant="success" />
      </div>

      {expanded && (
        <div className="space-y-3 pt-2 border-t">
          {/* Filters */}
          <div>
            <h4 className="font-medium text-xs text-muted-foreground mb-1">Filtros aplicados</h4>
            <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
              {JSON.stringify(log.filters, null, 2)}
            </pre>
          </div>

          {/* Full stats */}
          <div>
            <h4 className="font-medium text-xs text-muted-foreground mb-1">Estatísticas completas</h4>
            <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
              {JSON.stringify(log.stats, null, 2)}
            </pre>
          </div>

          {/* Included samples */}
          {log.sample?.included?.length > 0 && (
            <div>
              <h4 className="font-medium text-xs text-green-700 mb-1">
                ✅ Incluídos ({log.sample.included.length})
              </h4>
              <div className="space-y-1">
                {log.sample.included.map((item: any, j: number) => (
                  <div key={j} className="bg-green-50 p-2 rounded text-xs flex items-start gap-2">
                    <Badge variant="outline" className="text-[10px]">{item.item_type}</Badge>
                    <div>
                      <span className="font-mono text-[10px]">{item.item_id?.slice(0, 8)}...</span>
                      <span className="text-muted-foreground ml-2">
                        {item.reason?.distance_km != null && `${item.reason.distance_km}km`}
                        {item.reason?.matched_city_id && ` • city:${String(item.reason.matched_city_id).slice(0, 8)}`}
                        {item.reason?.matched_service_type && ` • tipo:${item.reason.matched_service_type}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Excluded samples */}
          {log.sample?.excluded?.length > 0 && (
            <div>
              <h4 className="font-medium text-xs text-red-700 mb-1">
                ❌ Excluídos ({log.sample.excluded.length})
              </h4>
              <div className="space-y-1">
                {log.sample.excluded.map((item: any, j: number) => (
                  <div key={j} className="bg-red-50 p-2 rounded text-xs flex items-start gap-2">
                    <Badge variant="outline" className="text-[10px]">{item.item_type}</Badge>
                    <div>
                      <span className="font-mono text-[10px]">{item.item_id?.slice(0, 8)}...</span>
                      <span className="text-red-600 ml-2">
                        {item.reason?.excluded_reason || 'motivo não informado'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {log.error && (
            <div>
              <h4 className="font-medium text-xs text-red-700 mb-1">Erro</h4>
              <pre className="bg-red-50 p-2 rounded text-xs text-red-800">{log.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value, variant = 'default' }: { label: string; value: number | undefined; variant?: string }) {
  const colors = {
    default: 'bg-muted text-foreground',
    warn: 'bg-yellow-50 text-yellow-800',
    success: 'bg-green-50 text-green-800',
  };

  return (
    <div className={`rounded p-1.5 text-center ${colors[variant as keyof typeof colors] || colors.default}`}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-bold text-sm">{value ?? '-'}</div>
    </div>
  );
}

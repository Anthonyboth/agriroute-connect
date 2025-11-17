import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type OverdueFreight = {
  id: string;
  cargo_type: string;
  origin_city: string;
  destination_city: string;
  pickup_date: string;
  producer_id: string;
};

export default function AdminMaintenancePanel() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processLog, setProcessLog] = useState<string[]>([]);
  const [processProgress, setProcessProgress] = useState(0);

  // Buscar fretes vencidos
  const { data: overdueFreights, refetch: refetchOverdue } = useQuery({
    queryKey: ["overdue-freights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freights")
        .select("id, cargo_type, origin_city, destination_city, pickup_date, producer_id")
        .in("status", ["OPEN", "ACCEPTED", "IN_NEGOTIATION", "LOADING", "LOADED", "IN_TRANSIT"])
        .lt("pickup_date", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

      if (error) throw error;
      return data as OverdueFreight[];
    },
    enabled: false,
  });

  // Buscar logs recentes de cancelamento automático
  const { data: recentLogs } = useQuery({
    queryKey: ["auto-cancel-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freight_status_history")
        .select("*, freights(cargo_type, origin_city, destination_city)")
        .ilike("notes", "%automático%")
        .eq("status", "CANCELLED")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  // Cancelar fretes vencidos
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("cancel-overdue-now", {
        method: "POST",
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Cancelamento concluído",
        description: `${data.cancelled_count} fretes cancelados com sucesso`,
      });
      refetchOverdue();
    },
    onError: (error: any) => {
      toast({
        title: "Erro no cancelamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearchOverdue = async () => {
    setProcessLog([]);
    setProcessLog((prev) => [...prev, "🔍 Buscando fretes vencidos..."]);
    await refetchOverdue();
    setProcessLog((prev) => [
      ...prev,
      `✅ Encontrados ${overdueFreights?.length || 0} fretes vencidos`,
    ]);
  };

  const handleCancelSelected = async () => {
    if (!overdueFreights || overdueFreights.length === 0) {
      toast({
        title: "Nenhum frete para cancelar",
        description: "Busque fretes vencidos primeiro",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm(
      `Confirma o cancelamento de ${overdueFreights.length} fretes vencidos?\n\nEsta ação não pode ser desfeita.`
    );

    if (!confirmed) return;

    setIsProcessing(true);
    setProcessLog([]);
    setProcessProgress(0);
    setProcessLog((prev) => [...prev, "🚀 Iniciando processo de cancelamento..."]);

    try {
      await cancelMutation.mutateAsync();
      setProcessLog((prev) => [...prev, "✅ Processo concluído com sucesso!"]);
      setProcessProgress(100);
    } catch (error: any) {
      setProcessLog((prev) => [...prev, `❌ Erro: ${error.message}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Painel de Manutenção</h1>
        <p className="text-muted-foreground">Ferramentas administrativas do sistema</p>
      </div>

      <div className="grid gap-6">
        {/* Recálculo de Distâncias (Backfill) */}
        <Card>
          <CardHeader>
            <CardTitle>Recálculo de Distâncias em Lote</CardTitle>
            <CardDescription>
              Executa o backfill de distâncias usando Google Maps API para todos os fretes com distância nula ou zero
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={async () => {
                setProcessLog((prev) => [...prev, "🔄 Iniciando recálculo de distâncias..."]);
                setIsProcessing(true);
                try {
                  const { data, error } = await supabase.functions.invoke('calculate-freight-distances');
                  
                  if (error) {
                    toast({
                      title: "Erro ao recalcular distâncias",
                      description: error.message,
                      variant: "destructive",
                    });
                    setProcessLog((prev) => [...prev, `❌ Erro: ${error.message}`]);
                  } else {
                    const result = data as { calculated_count: number; failed_count: number; skipped_count: number };
                    toast({
                      title: "Recálculo concluído",
                      description: `${result.calculated_count} distâncias calculadas, ${result.failed_count} falharam, ${result.skipped_count} ignorados`,
                    });
                    setProcessLog((prev) => [...prev, `✅ ${result.calculated_count} distâncias recalculadas com sucesso`]);
                  }
                } catch (error: any) {
                  setProcessLog((prev) => [...prev, `❌ Erro: ${error.message}`]);
                } finally {
                  setIsProcessing(false);
                }
              }}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recalculando...
                </>
              ) : (
                "Recalcular Todas as Distâncias"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Cancelamento Manual de Fretes */}
        <Card>
          <CardHeader>
            <CardTitle>Cancelamento Manual de Fretes Vencidos</CardTitle>
            <CardDescription>
              Cancela fretes que não foram coletados em 48h após a data agendada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={handleSearchOverdue} variant="outline">
                Buscar Fretes Vencidos
              </Button>
              <Button
                onClick={handleCancelSelected}
                disabled={!overdueFreights || overdueFreights.length === 0 || isProcessing}
                variant="destructive"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Cancelar Selecionados ({overdueFreights?.length || 0})
                  </>
                )}
              </Button>
            </div>

            {overdueFreights && overdueFreights.length > 0 && (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo de Carga</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead>Data Coleta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overdueFreights.slice(0, 10).map((freight) => (
                      <TableRow key={freight.id}>
                        <TableCell>{freight.cargo_type}</TableCell>
                        <TableCell>{freight.origin_city}</TableCell>
                        <TableCell>{freight.destination_city}</TableCell>
                        <TableCell>
                          {format(new Date(freight.pickup_date), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {overdueFreights.length > 10 && (
                  <div className="p-2 text-center text-sm text-muted-foreground border-t">
                    Mostrando 10 de {overdueFreights.length} fretes
                  </div>
                )}
              </div>
            )}

            {processLog.length > 0 && (
              <div className="space-y-2">
                {isProcessing && <Progress value={processProgress} />}
                <div className="bg-muted rounded-lg p-4 max-h-40 overflow-y-auto font-mono text-xs space-y-1">
                  {processLog.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logs do Sistema */}
        <Card>
          <CardHeader>
            <CardTitle>Logs Recentes de Cancelamento Automático</CardTitle>
            <CardDescription>Últimos 50 cancelamentos automáticos do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {recentLogs && recentLogs.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Frete</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentLogs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell>
                          {log.freights?.cargo_type || "N/A"} <br />
                          <span className="text-xs text-muted-foreground">
                            {log.freights?.origin_city} → {log.freights?.destination_city}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">{log.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum log encontrado
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

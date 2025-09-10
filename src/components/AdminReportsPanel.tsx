import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Download, Calendar, TrendingUp, Users, Truck, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AdminReport {
  id: string;
  report_type: string;
  period_start: string;
  period_end: string;
  total_freights: number;
  total_users: number;
  total_revenue: number;
  commission_earned: number;
  active_drivers: number;
  active_producers: number;
  average_freight_value: number;
  created_at: string;
}

export function AdminReportsPanel() {
  const [reportType, setReportType] = useState("MONTHLY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const generateReport = async () => {
    if (!startDate || !endDate) {
      toast.error("Selecione as datas de início e fim");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generate_admin_report', {
        p_report_type: reportType,
        p_period_start: startDate,
        p_period_end: endDate
      });

      if (error) throw error;

      toast.success("Relatório gerado com sucesso!");
      loadReports();
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error("Erro ao gerar relatório");
    } finally {
      setIsGenerating(false);
    }
  };

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error("Erro ao carregar relatórios");
    } finally {
      setIsLoading(false);
    }
  };

  const exportReport = (report: AdminReport) => {
    const csvContent = `
Relatório AgriRoute - ${report.report_type}
Período: ${format(new Date(report.period_start), 'dd/MM/yyyy', { locale: ptBR })} - ${format(new Date(report.period_end), 'dd/MM/yyyy', { locale: ptBR })}

Estatísticas Gerais:
Total de Fretes: ${report.total_freights}
Total de Usuários: ${report.total_users}
Motoristas Ativos: ${report.active_drivers}
Produtores Ativos: ${report.active_producers}

Financeiro:
Receita Total: R$ ${(report.total_revenue / 100).toFixed(2)}
Comissão Earned: R$ ${(report.commission_earned / 100).toFixed(2)}
Valor Médio por Frete: R$ ${(report.average_freight_value / 100).toFixed(2)}
    `.trim();

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-agriroute-${report.report_type}-${report.period_start}-${report.period_end}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Gerar Relatório Administrativo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reportType">Tipo de Relatório</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Diário</SelectItem>
                  <SelectItem value="WEEKLY">Semanal</SelectItem>
                  <SelectItem value="MONTHLY">Mensal</SelectItem>
                  <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                  <SelectItem value="ANNUAL">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="startDate">Data Início</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endDate">Data Fim</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          
          <Button 
            onClick={generateReport} 
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? "Gerando..." : "Gerar Relatório"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Relatórios Recentes</CardTitle>
          <Button onClick={loadReports} variant="outline" size="sm">
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Carregando relatórios...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              Nenhum relatório encontrado
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div key={report.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{report.report_type}</h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(report.period_start), 'dd/MM/yyyy', { locale: ptBR })} - {format(new Date(report.period_end), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                    <Button 
                      onClick={() => exportReport(report)}
                      variant="outline" 
                      size="sm"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Exportar
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Fretes</p>
                        <p className="font-semibold">{report.total_freights}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Usuários</p>
                        <p className="font-semibold">{report.total_users}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Receita</p>
                        <p className="font-semibold">R$ {(report.total_revenue / 100).toFixed(2)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Comissão</p>
                        <p className="font-semibold">R$ {(report.commission_earned / 100).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
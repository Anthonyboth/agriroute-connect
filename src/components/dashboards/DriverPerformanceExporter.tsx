import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { formatBRL } from '@/lib/formatters';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { CompanyDriverPerformance } from '@/hooks/useCompanyDriverPerformance';

interface DriverPerformanceExporterProps {
  drivers: CompanyDriverPerformance[];
  companyName?: string;
}

export const DriverPerformanceExporter: React.FC<DriverPerformanceExporterProps> = ({
  drivers,
  companyName = 'Transportadora',
}) => {
  const [exporting, setExporting] = useState(false);

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Performance dos Motoristas', pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(companyName, pageWidth / 2, 28, { align: 'center' });
      
      doc.setFontSize(10);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 35, { align: 'center' });

      // Summary stats
      const totalRevenue = drivers.reduce((sum, d) => sum + d.totalRevenue, 0);
      const totalCompleted = drivers.reduce((sum, d) => sum + d.completedFreights, 0);
      const avgRating = drivers.reduce((sum, d) => sum + d.averageRating, 0) / drivers.length;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo Geral', 14, 48);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Total de Motoristas: ${drivers.length}`, 14, 56);
      doc.text(`Receita Total: ${formatBRL(totalRevenue)}`, 14, 62);
      doc.text(`Entregas Completas: ${totalCompleted}`, 14, 68);
      doc.text(`Avaliação Média: ${avgRating.toFixed(1)}/5.0`, 14, 74);

      // Table
      const tableData = drivers.map((driver, index) => [
        (index + 1).toString(),
        driver.driverName,
        driver.driverPhone || '-',
        `${driver.completedFreights}/${driver.totalFreights}`,
        `${driver.onTimeRate.toFixed(0)}%`,
        driver.averageRating.toFixed(1),
        `${driver.acceptanceRate.toFixed(0)}%`,
        formatBRL(driver.totalRevenue),
      ]);

      autoTable(doc, {
        head: [['#', 'Motorista', 'Telefone', 'Entregas', 'No Prazo', 'Avaliação', 'Aceitação', 'Receita']],
        body: tableData,
        startY: 82,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });

      doc.save(`performance_motoristas_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      // Prepare data
      const data = drivers.map((driver, index) => ({
        'Posição': index + 1,
        'Nome': driver.driverName,
        'Email': driver.driverEmail || '-',
        'Telefone': driver.driverPhone || '-',
        'Status': driver.isOnline ? 'Online' : 'Offline',
        'Total Fretes': driver.totalFreights,
        'Completos': driver.completedFreights,
        'Cancelados': driver.cancelledFreights,
        'Ativos': driver.activeFreights,
        'Taxa No Prazo (%)': driver.onTimeRate.toFixed(1),
        'Avaliação': driver.averageRating.toFixed(1),
        'Total Avaliações': driver.totalRatings,
        'Taxa Aceitação (%)': driver.acceptanceRate.toFixed(1),
        'Tempo Resposta (h)': driver.responseTime.toFixed(2),
        'Receita (R$)': driver.totalRevenue.toFixed(2),
        'Distância (km)': driver.totalDistance.toFixed(1),
      }));

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      
      // Add summary sheet
      const summaryData = [
        { 'Métrica': 'Total de Motoristas', 'Valor': drivers.length },
        { 'Métrica': 'Receita Total', 'Valor': formatBRL(drivers.reduce((sum, d) => sum + d.totalRevenue, 0)) },
        { 'Métrica': 'Entregas Completas', 'Valor': drivers.reduce((sum, d) => sum + d.completedFreights, 0) },
        { 'Métrica': 'Avaliação Média', 'Valor': (drivers.reduce((sum, d) => sum + d.averageRating, 0) / drivers.length).toFixed(1) },
        { 'Métrica': 'Taxa Aceitação Média', 'Valor': `${(drivers.reduce((sum, d) => sum + d.acceptanceRate, 0) / drivers.length).toFixed(0)}%` },
        { 'Métrica': 'Data do Relatório', 'Valor': format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR }) },
      ];
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);

      XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumo');
      XLSX.utils.book_append_sheet(wb, ws, 'Motoristas');

      // Auto-width columns
      const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 12) }));
      ws['!cols'] = colWidths;

      XLSX.writeFile(wb, `performance_motoristas_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success('Excel exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast.error('Erro ao exportar Excel');
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={exporting || drivers.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          {exporting ? 'Exportando...' : 'Exportar'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="h-4 w-4 mr-2" />
          Exportar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

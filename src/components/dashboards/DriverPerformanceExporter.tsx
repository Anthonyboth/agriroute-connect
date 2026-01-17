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
import { exportToXlsx } from '@/lib/excel-export';
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
      // Summary sheet data
      const summaryData: (string | number)[][] = [
        ['Métrica', 'Valor'],
        ['Total de Motoristas', drivers.length],
        ['Receita Total', formatBRL(drivers.reduce((sum, d) => sum + d.totalRevenue, 0))],
        ['Entregas Completas', drivers.reduce((sum, d) => sum + d.completedFreights, 0)],
        ['Avaliação Média', (drivers.reduce((sum, d) => sum + d.averageRating, 0) / drivers.length).toFixed(1)],
        ['Taxa Aceitação Média', `${(drivers.reduce((sum, d) => sum + d.acceptanceRate, 0) / drivers.length).toFixed(0)}%`],
        ['Data do Relatório', format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })],
      ];

      // Drivers sheet data
      const driversData: (string | number)[][] = [
        ['Posição', 'Nome', 'Email', 'Telefone', 'Status', 'Total Fretes', 'Completos', 'Cancelados', 'Ativos', 'Taxa No Prazo (%)', 'Avaliação', 'Total Avaliações', 'Taxa Aceitação (%)', 'Tempo Resposta (h)', 'Receita (R$)', 'Distância (km)'],
        ...drivers.map((driver, index) => [
          index + 1,
          driver.driverName,
          driver.driverEmail || '-',
          driver.driverPhone || '-',
          driver.isOnline ? 'Online' : 'Offline',
          driver.totalFreights,
          driver.completedFreights,
          driver.cancelledFreights,
          driver.activeFreights,
          driver.onTimeRate.toFixed(1),
          driver.averageRating.toFixed(1),
          driver.totalRatings,
          driver.acceptanceRate.toFixed(1),
          driver.responseTime.toFixed(2),
          driver.totalRevenue.toFixed(2),
          driver.totalDistance.toFixed(1),
        ])
      ];

      exportToXlsx({
        fileName: `performance_motoristas_${format(new Date(), 'yyyy-MM-dd')}.xlsx`,
        sheets: [
          { name: 'Resumo', data: summaryData, columnWidths: [25, 20] },
          { name: 'Motoristas', data: driversData, columnWidths: [8, 25, 25, 15, 10, 12, 12, 12, 10, 15, 12, 15, 18, 18, 15, 15] }
        ]
      });

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

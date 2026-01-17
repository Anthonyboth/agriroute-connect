import React from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportToXlsx } from '@/lib/excel-export';
import { formatDate } from '@/lib/formatters';
import { toast } from 'sonner';

interface AssignmentReportExporterProps {
  assignments: any[]; // Simplified to avoid type conflicts
  companyName?: string;
}

export function AssignmentReportExporter({ assignments, companyName = 'Empresa' }: AssignmentReportExporterProps) {
  
  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      
      // Título
      doc.setFontSize(18);
      doc.text('Relatório de Vínculos Motorista ↔ Veículo', pageWidth / 2, 15, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(`${companyName}`, pageWidth / 2, 22, { align: 'center' });
      
      doc.setFontSize(10);
      doc.text(`Gerado em: ${formatDate(new Date().toISOString())}`, pageWidth / 2, 28, { align: 'center' });
      
      // Estatísticas
      const activeCount = assignments.filter(a => !a.removed_at).length;
      const primaryCount = assignments.filter(a => a.is_primary && !a.removed_at).length;
      
      doc.setFontSize(11);
      doc.text(`Total de Vínculos: ${assignments.length}`, 14, 38);
      doc.text(`Vínculos Ativos: ${activeCount}`, 14, 44);
      doc.text(`Vínculos Principais: ${primaryCount}`, 14, 50);
      
      const tableData = assignments.map((a: any) => [
        a.driver_profiles?.full_name || a.driver?.full_name || '-',
        a.driver_profiles?.phone || a.driver?.phone || '-',
        a.vehicles?.license_plate || a.vehicle?.license_plate || '-',
        a.vehicles?.vehicle_type || a.vehicle?.vehicle_type || '-',
        (a.vehicles?.max_capacity_tons || a.vehicle?.max_capacity_tons || 0).toString() + 't',
        a.is_primary ? 'Sim ⭐' : 'Não',
        a.removed_at ? 'Removido' : 'Ativo',
        formatDate(a.created_at)
      ]);
      
      autoTable(doc, {
        startY: 58,
        head: [['Motorista', 'Telefone', 'Placa', 'Tipo', 'Cap.', 'Principal', 'Status', 'Data Criação']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [34, 197, 94] },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 25 },
          2: { cellWidth: 20 },
          3: { cellWidth: 25 },
          4: { cellWidth: 15 },
          5: { cellWidth: 20 },
          6: { cellWidth: 20 },
          7: { cellWidth: 25 }
        }
      });
      
      doc.save(`vinculos_motorista_veiculo_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Relatório PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar relatório PDF');
    }
  };
  
  const exportToExcel = () => {
    try {
      // Sheet 1: Resumo
      const summaryData: (string | number)[][] = [
        ['Relatório de Vínculos Motorista ↔ Veículo', ''],
        ['Empresa:', companyName],
        ['Gerado em:', formatDate(new Date().toISOString())],
        ['', ''],
        ['Total de Vínculos:', assignments.length],
        ['Vínculos Ativos:', assignments.filter(a => !a.removed_at).length],
        ['Vínculos Removidos:', assignments.filter(a => a.removed_at).length],
        ['Vínculos Principais:', assignments.filter(a => a.is_primary && !a.removed_at).length],
      ];
      
      // Sheet 2: Detalhes
      const detailsData: (string | number)[][] = [
        ['Motorista', 'Telefone', 'Placa', 'Tipo de Veículo', 'Capacidade (t)', 'Principal', 'Status', 'Data Criação', 'Data Remoção']
      ];
      
      assignments.forEach((a: any) => {
        detailsData.push([
          a.driver_profiles?.full_name || a.driver?.full_name || '-',
          a.driver_profiles?.phone || a.driver?.phone || '',
          a.vehicles?.license_plate || a.vehicle?.license_plate || '-',
          a.vehicles?.vehicle_type || a.vehicle?.vehicle_type || '-',
          (a.vehicles?.max_capacity_tons || a.vehicle?.max_capacity_tons || 0).toString(),
          a.is_primary ? 'Sim' : 'Não',
          a.removed_at ? 'Removido' : 'Ativo',
          formatDate(a.created_at),
          a.removed_at ? formatDate(a.removed_at) : ''
        ]);
      });
      
      exportToXlsx({
        fileName: `vinculos_motorista_veiculo_${new Date().toISOString().split('T')[0]}.xlsx`,
        sheets: [
          { name: 'Resumo', data: summaryData, columnWidths: [30, 25] },
          { name: 'Detalhes', data: detailsData, columnWidths: [25, 15, 12, 18, 15, 12, 12, 15, 15] }
        ]
      });
      
      toast.success('Relatório Excel gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar Excel:', error);
      toast.error('Erro ao gerar relatório Excel');
    }
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Exportar Relatório
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="h-4 w-4 mr-2" />
          Exportar como PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar como Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

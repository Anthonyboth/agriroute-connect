import React from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportToXlsx } from '@/lib/excel-export';
import { Button } from '@/components/ui/button';
import { formatBRL, formatKm, formatTons, formatDate } from '@/lib/formatters';
import { FileText, Table } from 'lucide-react';
import { ReportData } from '@/hooks/useFreightReportData';
import { UI_TEXTS } from '@/lib/ui-texts';

interface FreightReportExporterProps {
  data: ReportData;
  reportTitle: string;
}

export const FreightReportExporter: React.FC<FreightReportExporterProps> = ({ 
  data, 
  reportTitle 
}) => {
  
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text(reportTitle, 14, 20);
    
    // Summary stats
    doc.setFontSize(12);
    let yPos = 35;
    doc.text(`Total de Fretes: ${data.summary.total}`, 14, yPos);
    yPos += 7;
    doc.text(`Valor Total: ${formatBRL(data.summary.totalValue)}`, 14, yPos);
    yPos += 7;
    doc.text(`Distância Total: ${formatKm(data.summary.totalDistance)}`, 14, yPos);
    yPos += 7;
    doc.text(`Peso Total: ${formatTons(data.summary.totalWeight)}`, 14, yPos);
    yPos += 7;
    doc.text(`Preço Médio: ${formatBRL(data.summary.avgPrice)}`, 14, yPos);
    yPos += 7;
    doc.text(`Distância Média: ${formatKm(data.summary.avgDistance)}`, 14, yPos);
    
    // Status breakdown
    yPos += 14;
    doc.text('Fretes por Status:', 14, yPos);
    yPos += 7;
    Object.entries(data.summary.byStatus).forEach(([status, count]) => {
      doc.text(`  ${status}: ${count}`, 14, yPos);
      yPos += 7;
    });
    
    // Freight table
    autoTable(doc, {
      startY: yPos + 10,
      head: [['ID', 'Carga', 'Origem', 'Destino', 'Data', 'Preço', 'Status']],
      body: data.freights.map(f => [
        f.id.substring(0, 8),
        f.cargo_type || 'N/A',
        f.origin_city || 'N/A',
        f.destination_city || 'N/A',
        formatDate(f.pickup_date),
        formatBRL(f.price),
        f.status
      ]),
      styles: { fontSize: 8 },
      theme: 'grid'
    });
    
    doc.save(`${reportTitle.toLowerCase().replace(/\s/g, '_')}_${Date.now()}.pdf`);
  };
  
  const exportToExcel = () => {
    // Summary sheet data
    const summaryData: (string | number | null)[][] = [
      ['Relatório', reportTitle],
      ['Data de Geração', new Date().toLocaleString('pt-BR')],
      ['', ''],
      ['Estatísticas Gerais', ''],
      ['Total de Fretes', data.summary.total],
      ['Valor Total (R$)', data.summary.totalValue],
      ['Distância Total (km)', data.summary.totalDistance],
      ['Peso Total (t)', data.summary.totalWeight],
      ['Preço Médio (R$)', data.summary.avgPrice],
      ['Distância Média (km)', data.summary.avgDistance],
      ['', ''],
      ['Fretes por Status', ''],
      ...Object.entries(data.summary.byStatus).map(([status, count]) => [status, count as number]),
      ['', ''],
      ['Fretes por Urgência', ''],
      ...Object.entries(data.summary.byUrgency).map(([urgency, count]) => [urgency, count as number])
    ];
    
    // Freights sheet data
    const freightsData: (string | number | null)[][] = [
      ['ID', 'Tipo de Carga', 'Peso (t)', 'Origem Cidade', 'Origem Estado', 'Destino Cidade', 'Destino Estado', 'Data Coleta', 'Data Entrega', 'Distância (km)', 'Preço (R$)', 'Status', 'Urgência', 'Motorista'],
      ...data.freights.map(f => [
        f.id,
        f.cargo_type || 'N/A',
        f.weight || 0,
        f.origin_city || 'N/A',
        f.origin_state || 'N/A',
        f.destination_city || 'N/A',
        f.destination_state || 'N/A',
        formatDate(f.pickup_date),
        formatDate(f.delivery_date),
        f.distance_km || 0,
        f.price || 0,
        f.status,
        f.urgency || 'LOW',
        f.profiles?.full_name || 'Aguardando'
      ])
    ];
    
    exportToXlsx({
      fileName: `${reportTitle.toLowerCase().replace(/\s/g, '_')}_${Date.now()}.xlsx`,
      sheets: [
        { name: 'Resumo', data: summaryData, columnWidths: [25, 20] },
        { name: 'Fretes Detalhados', data: freightsData, columnWidths: [36, 15, 10, 20, 10, 20, 10, 12, 12, 12, 12, 15, 10, 25] }
      ]
    });
  };
  
  return (
    <div className="flex gap-2" translate="no">
      <Button onClick={exportToPDF} variant="outline">
        <FileText className="mr-2 h-4 w-4" />
        {UI_TEXTS.EXPORTAR_PDF}
      </Button>
      <Button onClick={exportToExcel} variant="outline">
        <Table className="mr-2 h-4 w-4" />
        {UI_TEXTS.EXPORTAR_EXCEL}
      </Button>
    </div>
  );
};
